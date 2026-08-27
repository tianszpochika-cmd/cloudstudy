package com.englishflow.platform.template.b17.reliability;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/** Pure Java B17 reliability smoke; it does not claim Kafka or MySQL runtime evidence. */
public final class B17ReliabilitySmoke {
    private static final Instant NOW = Instant.parse("2026-08-23T00:00:00Z");

    public static void main(String[] args) {
        ReliableEvent event = event(1, "event-1", "idem-1");
        InMemoryOutboxStore outbox = new InMemoryOutboxStore(8, 2);
        outbox.append(event, NOW);
        outbox.append(event, NOW);
        require(outbox.size() == 1, "outbox enqueue must dedupe");
        OutboxEntry leased = outbox.leaseReady(NOW, Duration.ofSeconds(30), 10).getFirst();
        OutboxEntry retry = outbox.retryOrDlq(leased.event().eventId(), NOW, Duration.ZERO);
        OutboxEntry leasedAgain = outbox.leaseReady(NOW, Duration.ofSeconds(30), 10).getFirst();
        OutboxEntry dlq = outbox.retryOrDlq(leasedAgain.event().eventId(), NOW, Duration.ZERO);
        require(retry.state() == OutboxEntry.State.PENDING, "first failure must retry");
        require(dlq.state() == OutboxEntry.State.DLQ, "bounded attempts must reach DLQ");
        require(outbox.replay(event.eventId(), NOW).state() == OutboxEntry.State.PENDING, "DLQ replay must be explicit");

        EventDeliveryLedger ledger = new EventDeliveryLedger();
        List<String> applied = new ArrayList<>();
        require(ledger.deliver(event, received -> applied.add(received.eventId())) == EventDeliveryLedger.Result.APPLIED,
                "first event must apply");
        require(ledger.deliver(event, received -> applied.add(received.eventId())) == EventDeliveryLedger.Result.DUPLICATE,
                "duplicate event must be ignored");
        require(applied.size() == 1, "duplicate event must not invoke consumer twice");
        require(ledger.deliver(event(3, "event-3", "idem-3"), ignored -> {}) == EventDeliveryLedger.Result.BUFFERED,
                "aggregate gap must buffer");

        List<String> commands = new ArrayList<>();
        List<SagaCoordinator.RecoveryTask> recoveries = new ArrayList<>();
        SagaCoordinator saga = new SagaCoordinator(4, command -> commands.add(command.step()), recoveries::add);
        saga.start("saga-1", new SagaCoordinator.Command("saga-1", "assessment", "cmd-1", Map.of("attemptId", "attempt-1")));
        saga.completeStep("saga-1", new SagaCoordinator.Command("saga-1", "projection", "cmd-2", Map.of("eventId", "event-1")));
        saga.fail("saga-1", "PROJECTION_TIMEOUT", NOW);
        require(saga.state("saga-1") == SagaCoordinator.State.COMPENSATION_REQUIRED, "failed saga requires compensation");
        require(recoveries.size() == 1 && recoveries.getFirst().assessmentFactPreserved(), "compensation preserves source facts");
        require(commands.size() == 2, "workflow only emits commands");
        System.out.println("B17 reliability smoke: PASS");
    }

    private static ReliableEvent event(long sequence, String eventId, String idempotencyKey) {
        return new ReliableEvent(eventId, "trace-1", "1", "learning.mastery.projected.v1", "task-1", sequence,
                idempotencyKey, NOW, Map.of("subject", "user-1", "projectionVersion", Long.toString(sequence)));
    }

    private static void require(boolean condition, String message) {
        if (!condition) throw new AssertionError(message);
    }
}
