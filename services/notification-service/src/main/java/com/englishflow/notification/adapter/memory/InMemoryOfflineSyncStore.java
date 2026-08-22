package com.englishflow.notification.adapter.memory;

import com.englishflow.notification.domain.OfflineChange;
import com.englishflow.notification.domain.OfflineSyncReceipt;
import com.englishflow.notification.domain.NotificationPrincipalContext;
import com.englishflow.notification.domain.SyncCursor;
import com.englishflow.notification.domain.SyncFailureState;
import com.englishflow.notification.port.OfflineSyncStore;
import com.englishflow.notification.port.OfflineSyncStoreException;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;

/** Local adapter with deterministic fault injection for offline recovery tests. */
public final class InMemoryOfflineSyncStore implements OfflineSyncStore {

    private final Map<String, SyncCursor> cursors = new LinkedHashMap<>();
    private final Map<String, OfflineSyncReceipt> byEvent = new LinkedHashMap<>();
    private final Map<String, OfflineSyncReceipt> bySequence = new LinkedHashMap<>();
    private SyncFailureState failureState;

    @Override
    public synchronized Optional<OfflineSyncReceipt> findByClientEventId(NotificationPrincipalContext context,
            String clientEventId) {
        return Optional.ofNullable(byEvent.get(eventKey(context, clientEventId)));
    }

    @Override
    public synchronized Optional<OfflineSyncReceipt> findByClientSequence(NotificationPrincipalContext context,
            long clientSeq) {
        return Optional.ofNullable(bySequence.get(sequenceKey(context, clientSeq)));
    }

    @Override
    public synchronized SyncCursor cursor(NotificationPrincipalContext context) {
        return cursors.computeIfAbsent(scopeKey(context), ignored -> SyncCursor.initial(
                context.tenantId(), context.principalId(), context.deviceId(), java.time.Instant.EPOCH));
    }

    @Override
    public synchronized void accept(NotificationPrincipalContext context, OfflineChange change,
            SyncCursor expectedCursor, OfflineSyncReceipt receipt, SyncCursor nextCursor) {
        if (failureState != null) {
            throw new OfflineSyncStoreException(failureState);
        }
        String scope = scopeKey(context);
        SyncCursor current = cursors.computeIfAbsent(scope, ignored -> SyncCursor.initial(
                context.tenantId(), context.principalId(), context.deviceId(), java.time.Instant.EPOCH));
        if (!current.equals(expectedCursor)) {
            throw new IllegalStateException("sync cursor changed before the atomic append");
        }
        if (byEvent.containsKey(eventKey(context, change.clientEventId()))
                || bySequence.containsKey(sequenceKey(context, change.clientSeq()))) {
            throw new IllegalStateException("sync receipt already exists");
        }
        byEvent.put(eventKey(context, change.clientEventId()), receipt);
        bySequence.put(sequenceKey(context, change.clientSeq()), receipt);
        cursors.put(scope, nextCursor);
    }

    @Override
    public synchronized Optional<SyncFailureState> failureState() {
        return Optional.ofNullable(failureState);
    }

    public synchronized void failWith(SyncFailureState nextFailureState) {
        this.failureState = nextFailureState;
    }

    public synchronized void recoverStorage() {
        this.failureState = null;
    }

    private static String scopeKey(NotificationPrincipalContext context) {
        return context.tenantId() + '|' + context.principalId() + '|' + context.deviceId();
    }

    private static String eventKey(NotificationPrincipalContext context, String eventId) {
        return scopeKey(context) + '|' + eventId;
    }

    private static String sequenceKey(NotificationPrincipalContext context, long sequence) {
        return scopeKey(context) + '|' + sequence;
    }
}
