package com.englishflow.notification.application;

import com.englishflow.notification.domain.NotificationAccessPolicy;
import com.englishflow.notification.domain.NotificationDomainException;
import com.englishflow.notification.domain.NotificationOutboxEvent;
import com.englishflow.notification.domain.NotificationPrincipalContext;
import com.englishflow.notification.domain.OfflineChange;
import com.englishflow.notification.domain.OfflineSyncReceipt;
import com.englishflow.notification.domain.OfflineSyncResult;
import com.englishflow.notification.domain.OfflineVector;
import com.englishflow.notification.domain.RecoveryCommand;
import com.englishflow.notification.domain.RecoveryResult;
import com.englishflow.notification.domain.SafeEventAttributes;
import com.englishflow.notification.domain.SyncConflict;
import com.englishflow.notification.domain.SyncCursor;
import com.englishflow.notification.domain.SyncFailureState;
import com.englishflow.notification.port.OfflineSyncStore;
import com.englishflow.notification.port.OfflineSyncStoreException;
import com.englishflow.notification.port.NotificationIdGenerator;
import com.englishflow.notification.port.OutboxEventPort;
import com.englishflow.notification.port.WorkflowPort;

import java.time.Clock;
import java.time.Instant;
import java.util.Map;

/**
 * Offline cursor/dedupe/conflict use cases. Source services continue to own
 * learning/content facts; this service persists only sync metadata and receipts.
 */
public final class OfflineSyncApplicationService {

    private static final String OFFLINE_AGGREGATE = "offline-change";
    private final OfflineSyncStore store;
    private final WorkflowPort workflow;
    private final OutboxEventPort events;
    private final NotificationIdGenerator ids;
    private final NotificationAccessPolicy access;
    private final Clock clock;

    public OfflineSyncApplicationService(OfflineSyncStore store, WorkflowPort workflow,
            OutboxEventPort events, NotificationIdGenerator ids, NotificationAccessPolicy access, Clock clock) {
        this.store = store;
        this.workflow = workflow;
        this.events = events;
        this.ids = ids;
        this.access = access;
        this.clock = clock;
    }

    public OfflineSyncResult sync(NotificationPrincipalContext context, OfflineChange change,
            RequestMetadata metadata) {
        access.requirePermission(context, "sync.write");
        access.requireOwner(context, change.tenantId(), change.principalId());
        SyncCursor cursor = store.cursor(context);

        var existingEvent = store.findByClientEventId(context, change.clientEventId());
        if (existingEvent.isPresent()) {
            if (!existingEvent.get().fingerprint().equals(change.fingerprint())) {
                throw new NotificationDomainException(NotificationDomainException.Code.IDEMPOTENCY_CONFLICT,
                        "clientEventId was reused with a different change");
            }
            return OfflineSyncResult.replayed(change, cursor, existingEvent.get().serverVersion(),
                    metadata.traceId());
        }
        var existingSequence = store.findByClientSequence(context, change.clientSeq());
        if (existingSequence.isPresent()) {
            throw new NotificationDomainException(NotificationDomainException.Code.SEQUENCE_CONFLICT,
                    "clientSeq is already assigned to another client event");
        }

        long expectedClientSeq = cursor.lastClientSeq() + 1;
        if (change.clientSeq() != expectedClientSeq) {
            return conflict(change, cursor, new SyncConflict(
                    change.clientSeq() < expectedClientSeq ? "CLIENT_SEQUENCE_REWIND" : "CLIENT_SEQUENCE_GAP",
                    cursor.serverVersion(), cursor.vector(), expectedClientSeq), metadata);
        }
        if (change.baseVersion() != cursor.serverVersion()) {
            return conflict(change, cursor, new SyncConflict(
                    change.baseVersion() < cursor.serverVersion() ? "BASE_VERSION_STALE" : "BASE_VERSION_AHEAD",
                    cursor.serverVersion(), cursor.vector(), expectedClientSeq), metadata);
        }
        OfflineVector.Relation vectorRelation = change.vector().relationTo(cursor.vector());
        if (vectorRelation == OfflineVector.Relation.DOMINATED_BY
                || vectorRelation == OfflineVector.Relation.CONCURRENT) {
            return conflict(change, cursor, new SyncConflict(
                    vectorRelation == OfflineVector.Relation.CONCURRENT ? "VECTOR_CONCURRENT" : "VECTOR_STALE",
                    cursor.serverVersion(), cursor.vector(), expectedClientSeq), metadata);
        }

        SyncFailureState failure = store.failureState().orElse(null);
        if (failure != null) {
            return OfflineSyncResult.failed(change, cursor, failure, metadata.traceId());
        }

        Instant now = clock.instant();
        SyncCursor nextCursor = cursor.advance(change, now);
        OfflineSyncReceipt receipt = new OfflineSyncReceipt(change.clientEventId(), change.fingerprint(),
                change.clientSeq(), com.englishflow.notification.domain.SyncStatus.APPLIED,
                nextCursor.serverVersion(), now);
        try {
            store.accept(context, change, cursor, receipt, nextCursor);
        } catch (OfflineSyncStoreException exception) {
            return OfflineSyncResult.failed(change, cursor, exception.failureState(), metadata.traceId());
        } catch (IllegalStateException exception) {
            SyncCursor changedCursor = store.cursor(context);
            return conflict(change, changedCursor, new SyncConflict("SERVER_CURSOR_CHANGED",
                    changedCursor.serverVersion(), changedCursor.vector(), changedCursor.lastClientSeq() + 1),
                    metadata);
        }

        workflow.enqueue(context.tenantId(), context.principalId(), "OFFLINE_SYNC_RECONCILIATION",
                OFFLINE_AGGREGATE, change.clientEventId(), 3, now);
        appendEvent("sync.enqueued.v1", change.clientEventId(), context, metadata,
                Map.of("clientEventId", change.clientEventId(), "clientSeq", Long.toString(change.clientSeq()),
                        "entityType", change.entityType(), "serverVersion", Long.toString(nextCursor.serverVersion())));
        return OfflineSyncResult.applied(change, nextCursor, metadata.traceId());
    }

    public SyncCursor cursor(NotificationPrincipalContext context) {
        access.requirePermission(context, "notification.read");
        return store.cursor(context);
    }

    public RecoveryResult recover(NotificationPrincipalContext context, RecoveryCommand command,
            RequestMetadata metadata) {
        access.requirePermission(context, "sync.write");
        var task = workflow.find(command.taskId()).orElseThrow(() ->
                new NotificationDomainException(NotificationDomainException.Code.NOT_FOUND,
                        "workflow task was not found"));
        access.requireOwner(context, task.tenantId(), task.principalId());
        RecoveryResult result = workflow.recover(command, clock.instant());
        appendEvent("sync.recovery_requested.v1", result.taskId(), context, metadata,
                Map.of("taskId", result.taskId(), "action", result.action().name(),
                        "state", result.state().name()));
        return result;
    }

    private OfflineSyncResult conflict(OfflineChange change, SyncCursor cursor, SyncConflict conflict,
            RequestMetadata metadata) {
        appendEvent("sync.conflict_detected.v1", change.clientEventId(),
                new NotificationPrincipalContext(change.tenantId(), change.principalId(), change.deviceId(),
                        java.util.Set.of(), java.util.Set.of()), metadata,
                Map.of("clientEventId", change.clientEventId(), "clientSeq", Long.toString(change.clientSeq()),
                        "reason", conflict.reason(), "serverVersion", Long.toString(cursor.serverVersion())));
        return OfflineSyncResult.conflict(change, cursor, conflict, metadata.traceId());
    }

    private void appendEvent(String eventName, String aggregateId, NotificationPrincipalContext context,
            RequestMetadata metadata, Map<String, String> attributes) {
        events.append(new NotificationOutboxEvent(ids.next("evt"), eventName, OFFLINE_AGGREGATE, aggregateId,
                context.tenantId(), context.principalId(), metadata.traceId(), metadata.requestId(),
                clock.instant(), SafeEventAttributes.copy(attributes)));
    }
}
