package com.englishflow.platform.template.reliability;

import java.lang.reflect.Field;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Dependency-free B14-CROSS-004 smoke test. Run with javac/java; it intentionally does not need
 * Spring, Kafka, a database, or a transport broker.
 */
public final class B14ReliabilityLedgerSmoke {

    private static final Instant START = Instant.parse("2026-08-22T00:00:00Z");

    private B14ReliabilityLedgerSmoke() {
    }

    public static void main(String[] args) {
        run();
        System.out.println("service-template B14-CROSS-004 reliability smoke: PASS");
    }

    public static void run() {
        MutableClock clock = new MutableClock(START);
        B14ReliabilityLedger.RetryPolicy policy = new B14ReliabilityLedger.RetryPolicy(
                3, Duration.ofSeconds(1), Duration.ofSeconds(4));
        B14ReliabilityLedger ledger = new B14ReliabilityLedger(8, policy, clock);

        schemaAndPartitionAreCanonical(ledger);
        duplicateEventsAreIdempotent(ledger, clock);
        outOfOrderEventsWaitForTheCheckpoint(ledger, clock);
        retryDlqManualRecoveryAndReplayAreBounded(ledger, clock);
        sagaCompensationIsMetadataOnlyAndIdempotent(ledger, clock);
        rawPayloadIsNotAStoredReliabilityField();
    }

    private static void schemaAndPartitionAreCanonical(B14ReliabilityLedger ledger) {
        ledger.registerSchemaWindow("orders.created.v1", "orders.event.v2",
                Set.of("orders.event.v01"));
        B14ReliabilityLedger.EventRecord legacy = event(ledger, " EVT-B14-CANONICAL-001 ",
                "Orders.Created.V1", "orders.event.v01", "Order", "ORDER-001", 1, "order-created");

        check("evt-b14-canonical-001".equals(legacy.eventId()), "eventId is normalized");
        check("orders.event.v1".equals(legacy.schemaVersion()), "legacy schema version is canonicalized");
        check(legacy.partition() == B14ReliabilityLedger.partitionFor("order", "order-001", 8),
                "aggregate partition is derived from canonical aggregate identity");
        check(legacy.partition() == event(ledger, "evt-b14-canonical-002", "orders.created.v1",
                "orders.event.v2", "order", "order-001", 2, "order-updated").partition(),
                "same aggregate stays on one partition");
        check(B14ReliabilityLedger.normalizeSchemaVersion("ORDERS.EVENT.V0002")
                .equals("orders.event.v2"), "schema leading zeroes are normalized");

        B14ReliabilityLedger.ProcessingResult accepted = ledger.process("consumer-schema", legacy,
                ignored -> { });
        check(accepted.status() == B14ReliabilityLedger.ProcessingStatus.APPLIED,
                "old schema inside the compatibility window is accepted");
    }

    private static void duplicateEventsAreIdempotent(B14ReliabilityLedger ledger, MutableClock clock) {
        B14ReliabilityLedger.EventRecord event = event(ledger, "evt-b14-dedupe-001", "orders.created.v1",
                "orders.event.v2", "order", "dedupe-order", 1, "same-fact");
        AtomicInteger executions = new AtomicInteger();
        B14ReliabilityLedger.ProcessingResult first = ledger.process("consumer-dedupe", event,
                ignored -> executions.incrementAndGet(), clock.instant());
        B14ReliabilityLedger.ProcessingResult duplicate = ledger.process("consumer-dedupe",
                event(ledger, " EVT-B14-DEDUPE-001 ", "orders.created.v1", "orders.event.v2",
                        "order", "dedupe-order", 1, "same-fact"), ignored -> executions.incrementAndGet(),
                clock.instant());

        check(first.status() == B14ReliabilityLedger.ProcessingStatus.APPLIED, "first event is applied");
        check(duplicate.status() == B14ReliabilityLedger.ProcessingStatus.DUPLICATE,
                "same eventId is deduplicated after application");
        check(executions.get() == 1, "duplicate never invokes the handler twice");
        expect(B14ReliabilityLedger.ReliabilityConflictException.class, () -> ledger.process(
                "consumer-dedupe", event(ledger, "evt-b14-dedupe-001", "orders.created.v1",
                        "orders.event.v2", "order", "dedupe-order", 1, "different-fact"), ignored -> { },
                clock.instant()));
        check(ledger.receipt("consumer-dedupe", "evt-b14-dedupe-001").status()
                == B14ReliabilityLedger.ReceiptStatus.APPLIED, "receipt remains authoritative after conflict");

        String requestFingerprint = B14ReliabilityLedger.sha256("command-fact");
        check(ledger.beginIdempotency("commerce.order", "command-b14-001", requestFingerprint,
                clock.instant()).status() == B14ReliabilityLedger.IdempotencyStatus.PROCESSING,
                "generic command idempotency starts in processing state");
        check(ledger.completeIdempotency("commerce.order", "command-b14-001", requestFingerprint,
                "ORDER_CREATED", clock.instant()).status() == B14ReliabilityLedger.IdempotencyStatus.COMPLETED,
                "generic command idempotency stores only a result code");
        check(ledger.beginIdempotency("commerce.order", "command-b14-001", requestFingerprint,
                clock.instant()).idempotentReplay(), "completed command replays idempotently");
        expect(B14ReliabilityLedger.ReliabilityConflictException.class, () -> ledger.beginIdempotency(
                "commerce.order", "command-b14-001", B14ReliabilityLedger.sha256("other-command"),
                clock.instant()));
    }

    private static void outOfOrderEventsWaitForTheCheckpoint(B14ReliabilityLedger ledger,
            MutableClock clock) {
        B14ReliabilityLedger.EventRecord first = event(ledger, "evt-b14-order-001", "orders.created.v1",
                "orders.event.v2", "order", "ordered-order", 1, "ordered-one");
        B14ReliabilityLedger.EventRecord second = event(ledger, "evt-b14-order-002", "orders.created.v1",
                "orders.event.v2", "order", "ordered-order", 2, "ordered-two");
        StringBuilder order = new StringBuilder();
        B14ReliabilityLedger.ProcessingResult buffered = ledger.process("consumer-order", second,
                ignored -> order.append('2'), clock.instant());
        check(buffered.status() == B14ReliabilityLedger.ProcessingStatus.BUFFERED,
                "future event is buffered at a partition gap");
        check(ledger.cursor("consumer-order", second.partition()).nextSequence() == 1,
                "cursor does not jump over a missing sequence");
        check(ledger.observedCursor("consumer-order", second.partition()).nextSequence() == 3,
                "observed transport cursor is separate from the applied checkpoint");

        B14ReliabilityLedger.ProcessingResult appliedFirst = ledger.process("consumer-order", first,
                ignored -> order.append('1'), clock.instant());
        B14ReliabilityLedger.ProcessingResult appliedSecond = ledger.process("consumer-order", second,
                ignored -> order.append('2'), clock.instant());
        check(appliedFirst.status() == B14ReliabilityLedger.ProcessingStatus.APPLIED,
                "missing event advances the checkpoint");
        check(appliedSecond.status() == B14ReliabilityLedger.ProcessingStatus.APPLIED,
                "buffered event applies after its gap is filled");
        check("12".equals(order.toString()), "handler execution follows the partition order");
        check(ledger.cursor("consumer-order", first.partition()).nextSequence() == 3,
                "cursor is a contiguous next-sequence checkpoint");
        check(ledger.process("consumer-order", first, ignored -> order.append('x'), clock.instant()).status()
                == B14ReliabilityLedger.ProcessingStatus.DUPLICATE, "checkpointed replay is idempotent");
    }

    private static void retryDlqManualRecoveryAndReplayAreBounded(B14ReliabilityLedger ledger,
            MutableClock clock) {
        B14ReliabilityLedger.EventRecord retryEvent = event(ledger, "evt-b14-retry-001", "orders.created.v1",
                "orders.event.v2", "order", "retry-order", 1, "retry-fact");
        AtomicInteger retryExecutions = new AtomicInteger();
        B14ReliabilityLedger.EventHandler eventuallyHealthy = ignored -> {
            if (retryExecutions.incrementAndGet() < 3) {
                throw B14ReliabilityLedger.ProcessingFailure.retryable("PROVIDER_TIMEOUT");
            }
        };
        B14ReliabilityLedger.ProcessingResult first = ledger.process("consumer-retry", retryEvent,
                eventuallyHealthy, clock.instant());
        check(first.status() == B14ReliabilityLedger.ProcessingStatus.RETRY_SCHEDULED
                && first.attempt() == 1, "retryable failure consumes one bounded attempt");
        check(ledger.process("consumer-retry", retryEvent, eventuallyHealthy, clock.instant()).status()
                == B14ReliabilityLedger.ProcessingStatus.RETRY_NOT_DUE, "backoff prevents hot looping");
        clock.advance(Duration.ofSeconds(1));
        check(ledger.process("consumer-retry", retryEvent, eventuallyHealthy, clock.instant()).status()
                == B14ReliabilityLedger.ProcessingStatus.RETRY_SCHEDULED, "second attempt is also bounded");
        clock.advance(Duration.ofSeconds(2));
        check(ledger.process("consumer-retry", retryEvent, eventuallyHealthy, clock.instant()).status()
                == B14ReliabilityLedger.ProcessingStatus.APPLIED, "third attempt can succeed");

        B14ReliabilityLedger.EventRecord dlqEvent = event(ledger, "evt-b14-dlq-001", "orders.created.v1",
                "orders.event.v2", "order", "dlq-order", 1, "dlq-fact");
        AtomicInteger dlqExecutions = new AtomicInteger();
        B14ReliabilityLedger.EventHandler failTwiceThenFail = ignored -> {
            dlqExecutions.incrementAndGet();
            throw B14ReliabilityLedger.ProcessingFailure.retryable("DOWNSTREAM_UNAVAILABLE");
        };
        check(ledger.process("consumer-dlq", dlqEvent, failTwiceThenFail, clock.instant()).status()
                == B14ReliabilityLedger.ProcessingStatus.RETRY_SCHEDULED, "DLQ attempt one is retryable");
        clock.advance(Duration.ofSeconds(1));
        check(ledger.process("consumer-dlq", dlqEvent, failTwiceThenFail, clock.instant()).status()
                == B14ReliabilityLedger.ProcessingStatus.RETRY_SCHEDULED, "DLQ attempt two is retryable");
        clock.advance(Duration.ofSeconds(2));
        B14ReliabilityLedger.ProcessingResult dead = ledger.process("consumer-dlq", dlqEvent,
                failTwiceThenFail, clock.instant());
        check(dead.status() == B14ReliabilityLedger.ProcessingStatus.DEAD_LETTER,
                "retry budget moves the event to DLQ");
        check(ledger.deadLetters().size() == 1 && ledger.deadLetters().get(0).dlqId().equals(dead.dlqId()),
                "DLQ stores metadata and a stable identifier");

        B14ReliabilityLedger.ManualRecoveryResult manual = ledger.requestManualRecovery("consumer-dlq",
                dlqEvent.eventId(), "operator-b14", "recovery-b14-001", "REVIEW_REQUIRED", clock.instant());
        check(ledger.receipt("consumer-dlq", dlqEvent.eventId()).status()
                == B14ReliabilityLedger.ReceiptStatus.MANUAL_RECOVERY, "operator recovery is explicit");
        check(ledger.requestManualRecovery("consumer-dlq", dlqEvent.eventId(), "operator-b14",
                "recovery-b14-001", "REVIEW_REQUIRED", clock.instant()).idempotentReplay(),
                "manual recovery command is idempotent");
        check(manual.dlqId() != null, "manual recovery keeps the DLQ reference");

        B14ReliabilityLedger.ReplayResult replay = ledger.requestReplay("consumer-dlq",
                dlqEvent.eventId(), "replay-b14-001", "OPERATOR_APPROVED", clock.instant());
        check(ledger.requestReplay("consumer-dlq", dlqEvent.eventId(), "replay-b14-001",
                "OPERATOR_APPROVED", clock.instant()).idempotentReplay(), "replay command is idempotent");
        check(ledger.receipt("consumer-dlq", dlqEvent.eventId()).status()
                == B14ReliabilityLedger.ReceiptStatus.REPLAY_QUEUED, "replay queues a fresh bounded attempt");
        B14ReliabilityLedger.ProcessingResult replayed = ledger.process("consumer-dlq", dlqEvent,
                ignored -> { }, clock.instant());
        check(replayed.status() == B14ReliabilityLedger.ProcessingStatus.APPLIED && replayed.replayed(),
                "replayed DLQ event applies exactly once after recovery");
        check(replay.replayId().equals(replayed.replayId()), "replay has a separate stable operation identity");
        check(ledger.deadLetters().isEmpty() && replay.replayCount() == 1,
                "successful replay removes the active DLQ entry");
        check(dlqExecutions.get() == 3, "failed handler was not invoked during metadata-only replay test");
    }

    private static void sagaCompensationIsMetadataOnlyAndIdempotent(B14ReliabilityLedger ledger,
            MutableClock clock) {
        List<B14ReliabilityLedger.SagaStep> steps = List.of(
                new B14ReliabilityLedger.SagaStep("reserve", "reserve.entitlement", "release.entitlement"),
                new B14ReliabilityLedger.SagaStep("charge", "charge.order", "refund.order"));
        B14ReliabilityLedger.SagaSnapshot started = ledger.startSaga("saga-b14-001", "order",
                "saga-order", steps, "saga-start-b14-001", clock.instant());
        check(started.state() == B14ReliabilityLedger.SagaState.RUNNING, "Saga starts in running state");
        check(ledger.startSaga("saga-b14-001", "order", "saga-order", steps, "saga-start-b14-001",
                clock.instant()).equals(started), "Saga start is idempotent");
        ledger.markSagaStepApplied("saga-b14-001", "reserve", clock.instant());
        ledger.markSagaStepApplied("saga-b14-001", "charge", clock.instant());
        check(ledger.completeSaga("saga-b14-001", clock.instant()).state()
                == B14ReliabilityLedger.SagaState.COMPLETED, "Saga completes after all steps apply");
        B14ReliabilityLedger.SagaSnapshot compensating = ledger.requestCompensation("saga-b14-001",
                "compensate-b14-001", "ORDER_CANCELLED", clock.instant());
        check(compensating.state() == B14ReliabilityLedger.SagaState.COMPENSATING,
                "compensation is an explicit state transition");
        ledger.markSagaStepCompensated("saga-b14-001", "charge", clock.instant());
        check(ledger.markSagaStepCompensated("saga-b14-001", "reserve", clock.instant()).state()
                == B14ReliabilityLedger.SagaState.COMPENSATED, "all applied steps compensate");
        check(ledger.requestCompensation("saga-b14-001", "compensate-b14-001", "ORDER_CANCELLED",
                clock.instant()).equals(compensating), "compensation request is idempotent");

        ledger.startSaga("saga-b14-002", "order", "manual-order", steps, "saga-start-b14-002",
                clock.instant());
        ledger.markSagaStepApplied("saga-b14-002", "reserve", clock.instant());
        check(ledger.requestSagaManualRecovery("saga-b14-002", "saga-recovery-b14-002", "COMPENSATION_BLOCKED",
                clock.instant()).state() == B14ReliabilityLedger.SagaState.MANUAL_RECOVERY,
                "blocked compensation enters manual recovery without guessing a business outcome");
    }

    private static void rawPayloadIsNotAStoredReliabilityField() {
        for (Field field : B14ReliabilityLedger.EventRecord.class.getDeclaredFields()) {
            check(!field.getName().toLowerCase().contains("payload"), "event record has no raw payload field");
        }
        for (Field field : B14ReliabilityLedger.DeadLetter.class.getDeclaredFields()) {
            check(!field.getName().toLowerCase().contains("payload"), "DLQ record has no raw payload field");
        }
        check(B14ReliabilityLedger.sha256("private-answer").length() == 64,
                "only a bounded fingerprint is available to the ledger");
    }

    private static B14ReliabilityLedger.EventRecord event(B14ReliabilityLedger ledger, String eventId,
            String eventType, String schemaVersion, String aggregateType, String aggregateId,
            long sequence, String metadata) {
        return B14ReliabilityLedger.event(eventId, eventType, schemaVersion, aggregateType, aggregateId,
                sequence, B14ReliabilityLedger.sha256(metadata), START, "trace-b14-smoke", ledger.partitionCount());
    }

    private static void expect(Class<? extends Throwable> type, Runnable action) {
        try {
            action.run();
        } catch (Throwable failure) {
            if (type.isInstance(failure)) return;
            throw new AssertionError("expected " + type.getSimpleName() + " but got " + failure, failure);
        }
        throw new AssertionError("expected " + type.getSimpleName());
    }

    private static void check(boolean condition, String message) {
        if (!condition) throw new AssertionError(message);
    }

    private static final class MutableClock extends Clock {
        private Instant current;

        private MutableClock(Instant current) {
            this.current = current;
        }

        private void advance(Duration amount) {
            current = current.plus(amount);
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
    }
}
