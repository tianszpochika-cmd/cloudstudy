package com.englishflow.notification;

import com.englishflow.notification.adapter.memory.InMemoryDeliveryTransport;
import com.englishflow.notification.adapter.memory.InMemoryNotificationAuditEventStore;
import com.englishflow.notification.adapter.memory.InMemoryNotificationConsentStore;
import com.englishflow.notification.adapter.memory.InMemoryNotificationFactStore;
import com.englishflow.notification.adapter.memory.InMemoryNotificationIdGenerator;
import com.englishflow.notification.adapter.memory.InMemoryOutboxEventPort;
import com.englishflow.notification.adapter.memory.InMemoryTrustedEventReceiptStore;
import com.englishflow.notification.adapter.memory.InMemoryWorkflowPort;
import com.englishflow.notification.application.NotificationApplicationService;
import com.englishflow.notification.application.NotificationRecoveryApplicationService;
import com.englishflow.notification.application.NotificationRetryApplicationService;
import com.englishflow.notification.application.RequestMetadata;
import com.englishflow.notification.domain.NotificationAccessPolicy;
import com.englishflow.notification.domain.NotificationChannel;
import com.englishflow.notification.domain.NotificationDomainException;
import com.englishflow.notification.domain.NotificationPreference;
import com.englishflow.notification.domain.NotificationPrincipalContext;
import com.englishflow.notification.domain.RecoveryAction;
import com.englishflow.notification.domain.RecoveryCommand;
import com.englishflow.notification.domain.RetryDispatchStatus;
import com.englishflow.notification.domain.TrustedEventAllowlist;
import com.englishflow.notification.domain.TrustedEventEnvelope;
import com.englishflow.notification.domain.TrustedEventProcessingStatus;
import com.englishflow.notification.domain.WorkflowState;
import com.englishflow.notification.port.NotificationConsentPort;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.util.Map;
import java.util.Set;

/** Dependency-free B12-INF-003 smoke plus the existing B11 service seam. */
public final class NotificationB12TrustedEventSmoke {

    private static final Instant START = Instant.parse("2026-08-22T00:00:00Z");
    private static final String TENANT = "tenant-demo";
    private static final String PRINCIPAL = "prn_learner00000001";
    private static final String PRINCIPAL_TWO = "prn_learner00000002";
    private static final RequestMetadata METADATA = new RequestMetadata("req-b12-smoke", "trace-b12-smoke");

    private NotificationB12TrustedEventSmoke() {
    }

    public static void main(String[] args) {
        run();
    }

    public static void run() {
        MutableClock clock = new MutableClock(START);
        InMemoryNotificationFactStore facts = new InMemoryNotificationFactStore();
        InMemoryWorkflowPort workflow = new InMemoryWorkflowPort();
        InMemoryDeliveryTransport transport = new InMemoryDeliveryTransport();
        InMemoryOutboxEventPort events = new InMemoryOutboxEventPort();
        InMemoryNotificationAuditEventStore audit = new InMemoryNotificationAuditEventStore();
        InMemoryNotificationConsentStore consents = new InMemoryNotificationConsentStore();
        InMemoryTrustedEventReceiptStore receipts = new InMemoryTrustedEventReceiptStore();
        InMemoryNotificationIdGenerator ids = new InMemoryNotificationIdGenerator();
        NotificationAccessPolicy access = new NotificationAccessPolicy();
        NotificationApplicationService notifications = new NotificationApplicationService(
                facts, workflow, transport, events, ids, access, clock, 3, Duration.ofSeconds(5), audit, consents);
        TrustedEventApplicationServiceFixture fixture = new TrustedEventApplicationServiceFixture(
                notifications, facts, receipts, consents, workflow, events, audit, ids, clock, access);
        NotificationRetryApplicationService retry = fixture.retry;
        NotificationRecoveryApplicationService recovery = fixture.recovery;

        NotificationPrincipalContext consumer = new NotificationPrincipalContext(
                TENANT, "svc_learning", "svc-worker", Set.of("service"),
                Set.of("notification.event.consume", "notification.retry"));
        NotificationPrincipalContext operator = new NotificationPrincipalContext(
                TENANT, "ops_operator", "ops-worker", Set.of("operator"),
                Set.of("notification.recovery"));

        consents.setConsent(TENANT, PRINCIPAL, NotificationChannel.IN_APP, true);
        TrustedEventEnvelope delayed = event("evt-b12-review-0001", "dedupe-b12-review-0001", PRINCIPAL,
                START.plusSeconds(30));
        var queued = fixture.consumer.consume(consumer, delayed, METADATA);
        check(queued.status() == TrustedEventProcessingStatus.QUEUED, "trusted event queues a template message");
        check(queued.messageId() != null && queued.workflowTaskId() != null, "queue returns owned workflow metadata");
        check(fixture.consumer.consume(consumer, delayed, METADATA).status()
                == TrustedEventProcessingStatus.DUPLICATE, "event replay is deduplicated by receipt");

        var delayedResult = retry.dispatch(consumer, queued.workflowTaskId(), METADATA);
        check(delayedResult.status() == RetryDispatchStatus.DELAYED, "delivery does not run before notBefore");
        clock.advanceSeconds(31);
        transport.failNext("PROVIDER_TIMEOUT");
        var scheduled = retry.dispatch(consumer, queued.workflowTaskId(), METADATA);
        check(scheduled.status() == RetryDispatchStatus.RETRY_SCHEDULED
                && scheduled.delivery().attempt().retryable(), "retryable provider failure schedules backoff");
        var beforeBackoff = retry.dispatch(consumer, queued.workflowTaskId(), METADATA);
        check(beforeBackoff.status() == RetryDispatchStatus.DELAYED, "retry backoff is enforced by worker");
        clock.advanceTo(scheduled.nextAttemptAt().plusSeconds(1));
        var delivered = retry.dispatch(consumer, queued.workflowTaskId(), METADATA);
        check(delivered.status() == RetryDispatchStatus.DELIVERED
                && delivered.workflow().state() == WorkflowState.SUCCEEDED, "due retry delivers once");

        var consentRevokedQueued = fixture.consumer.consume(consumer,
                event("evt-b12-review-consent-revoked", "dedupe-b12-review-consent-revoked", PRINCIPAL, null),
                METADATA);
        consents.setConsent(TENANT, PRINCIPAL, NotificationChannel.IN_APP, false);
        var consentRevoked = retry.dispatch(consumer, consentRevokedQueued.workflowTaskId(), METADATA);
        if (consentRevoked.status() == RetryDispatchStatus.DELAYED) {
            clock.advanceTo(consentRevoked.nextAttemptAt().plusSeconds(1));
            consentRevoked = retry.dispatch(consumer, consentRevokedQueued.workflowTaskId(), METADATA);
        }
        check(consentRevoked.status() == RetryDispatchStatus.CANCELLED
                && consentRevoked.delivery() != null
                && !consentRevoked.delivery().attempt().retryable(),
                "consent revoked after queue prevents sending and retry");
        consents.setConsent(TENANT, PRINCIPAL, NotificationChannel.IN_APP, true);

        var terminalQueued = fixture.consumer.consume(consumer,
                event("evt-b12-review-terminal", "dedupe-b12-review-terminal", PRINCIPAL, null), METADATA);
        transport.failNextTerminal("INVALID_PROVIDER_CONFIGURATION");
        var terminal = retry.dispatch(consumer, terminalQueued.workflowTaskId(), METADATA);
        check(terminal.status() == RetryDispatchStatus.DEAD_LETTER
                && !terminal.delivery().attempt().retryable(), "terminal failure bypasses retry backoff");

        facts.savePreference(new NotificationPreference(TENANT, PRINCIPAL, "learning.review.due",
                NotificationChannel.IN_APP, false, "zh-CN", 1, clock.instant()));
        var preferenceFiltered = fixture.consumer.consume(consumer,
                event("evt-b12-review-0002", "dedupe-b12-review-0002", PRINCIPAL, null), METADATA);
        check(preferenceFiltered.status() == TrustedEventProcessingStatus.FILTERED
                && preferenceFiltered.messageId() == null, "opt-out produces no message or send");

        var consentFiltered = fixture.consumer.consume(consumer,
                event("evt-b12-review-0003", "dedupe-b12-review-0003", PRINCIPAL_TWO, null), METADATA);
        check(consentFiltered.status() == TrustedEventProcessingStatus.FILTERED
                && "CONSENT_NOT_GRANTED".equals(consentFiltered.reasonCode()),
                "missing channel consent fails closed");

        facts.savePreference(new NotificationPreference(TENANT, PRINCIPAL, "learning.review.due",
                NotificationChannel.IN_APP, true, "zh-CN", 2, clock.instant()));
        consents.setConsent(TENANT, PRINCIPAL, NotificationChannel.IN_APP, true);
        var dlqQueued = fixture.consumer.consume(consumer,
                event("evt-b12-review-0004", "dedupe-b12-review-0004", PRINCIPAL, null), METADATA);
        String dlqTaskId = dlqQueued.workflowTaskId();
        for (int index = 0; index < 3; index++) {
            transport.failNext("PROVIDER_TIMEOUT");
            var attempt = retry.dispatch(consumer, dlqTaskId, METADATA);
            if (index < 2) {
                check(attempt.status() == RetryDispatchStatus.RETRY_SCHEDULED, "retry remains bounded before DLQ");
                clock.advanceTo(attempt.nextAttemptAt().plusSeconds(1));
            } else {
                check(attempt.status() == RetryDispatchStatus.DEAD_LETTER
                        && !attempt.delivery().attempt().retryable(), "max retries move delivery to DLQ");
            }
        }
        NotificationPrincipalContext unauthorized = new NotificationPrincipalContext(
                TENANT, "learner", "learner-device", Set.of("learner"), Set.of("notification.retry"));
        expect(NotificationDomainException.Code.FORBIDDEN, () -> recovery.recover(unauthorized,
                new RecoveryCommand(dlqTaskId, RecoveryAction.REPLAY, "operator-replay"), METADATA));
        NotificationPrincipalContext wrongTenantOperator = new NotificationPrincipalContext(
                "tenant-other", "ops_operator", "ops-worker", Set.of("operator"),
                Set.of("notification.recovery"));
        expect(NotificationDomainException.Code.FORBIDDEN, () -> recovery.recover(wrongTenantOperator,
                new RecoveryCommand(dlqTaskId, RecoveryAction.REPLAY, "operator-replay"), METADATA));
        var recovered = recovery.recover(operator,
                new RecoveryCommand(dlqTaskId, RecoveryAction.REPLAY, "operator-replay"), METADATA);
        check(recovered.state() == WorkflowState.QUEUED, "authorized manual recovery requeues DLQ");
        var recoveredDelivery = retry.dispatch(consumer, dlqTaskId, METADATA);
        check(recoveredDelivery.status() == RetryDispatchStatus.DELIVERED,
                "replayed DLQ can be delivered with a fresh idempotency phase");

        TrustedEventEnvelope unknown = new TrustedEventEnvelope("evt-b12-unknown-0001", "client.fake.v1",
                "client.event.v1", 1, clock.instant(), "fake", "fake-aggregate", "client",
                "trace-b12-unknown", "req-b12-unknown", "client.event.v1", "dedupe-b12-unknown",
                TENANT, PRINCIPAL, null, null, NotificationChannel.IN_APP, null, Map.of());
        check(fixture.consumer.consume(consumer, unknown, METADATA).status()
                == TrustedEventProcessingStatus.REJECTED, "unknown event is rejected by exact allowlist");

        check(!audit.events().isEmpty(), "immutable audit events are written");
        check(audit.events().stream().anyMatch(value -> "notification.manual_recovery".equals(value.action())),
                "manual recovery is auditable");
        for (var event : events.events()) {
            check(event.attributes().keySet().stream().noneMatch(key -> key.toLowerCase().contains("payload")
                    || key.toLowerCase().contains("body") || key.toLowerCase().contains("audio")),
                    "ordinary outbox events contain no raw notification text/media");
        }
        System.out.println("notification-service B12-INF-003 smoke: PASS");
    }

    private static TrustedEventEnvelope event(String eventId, String dedupeKey, String principalId,
            Instant notBefore) {
        return new TrustedEventEnvelope(eventId, "learning.review.scheduled.v1", "learning.event.v1", 1,
                START, "learning_review_queue", "queue-" + eventId, "learning-service", "trace-b12-event",
                "req-b12-event", "learning.event.v1", dedupeKey, TENANT, principalId,
                "learning.review.due", "zh-CN", NotificationChannel.IN_APP, notBefore,
                Map.of("queueItemId", "queue-" + eventId, "itemId", "item-1001", "source", "REVIEW",
                        "state", "REVIEW_QUEUE", "dueAt", START.toString(), "queueVersion", "1"));
    }

    private static void expect(NotificationDomainException.Code code, Runnable action) {
        try {
            action.run();
        } catch (NotificationDomainException exception) {
            if (exception.code() == code) return;
            throw exception;
        }
        throw new AssertionError("expected " + code);
    }

    private static void check(boolean condition, String message) {
        if (!condition) throw new AssertionError(message);
    }

    private static final class TrustedEventApplicationServiceFixture {
        private final com.englishflow.notification.application.TrustedEventApplicationService consumer;
        private final NotificationRetryApplicationService retry;
        private final NotificationRecoveryApplicationService recovery;

        private TrustedEventApplicationServiceFixture(NotificationApplicationService notifications,
                InMemoryNotificationFactStore facts, InMemoryTrustedEventReceiptStore receipts,
                NotificationConsentPort consents, InMemoryWorkflowPort workflow,
                InMemoryOutboxEventPort events, InMemoryNotificationAuditEventStore audit,
                InMemoryNotificationIdGenerator ids, Clock clock, NotificationAccessPolicy access) {
            this.consumer = new com.englishflow.notification.application.TrustedEventApplicationService(
                    notifications, facts, receipts, consents, TrustedEventAllowlist.standard(), access, events,
                    audit, ids, workflow, clock);
            this.retry = new NotificationRetryApplicationService(notifications, facts, workflow, access, events,
                    audit, ids, clock);
            this.recovery = new NotificationRecoveryApplicationService(notifications, facts, consents, workflow,
                    access, events, audit, ids, clock);
        }
    }

    private static final class MutableClock extends Clock {
        private Instant current;

        private MutableClock(Instant current) {
            this.current = current;
        }

        @Override
        public ZoneId getZone() {
            return ZoneId.of("UTC");
        }

        @Override
        public Clock withZone(ZoneId zone) {
            return this;
        }

        @Override
        public Instant instant() {
            return current;
        }

        private void advanceSeconds(long seconds) {
            current = current.plusSeconds(seconds);
        }

        private void advanceTo(Instant target) {
            if (target.isAfter(current)) current = target;
        }
    }
}
