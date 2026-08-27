package com.englishflow.platform.template.b17.reliability;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;

/**
 * Saga coordinator contract. It emits commands/compensation intents and never receives a domain
 * persistence adapter, table writer, transaction manager or Kafka RPC client.
 */
public final class SagaCoordinator {
    public enum State { STARTED, STEP_COMPLETED, COMPENSATION_REQUIRED, MANUAL_RECOVERY, COMPLETED }

    public record Command(String sagaId, String step, String idempotencyKey, Map<String, String> safeArguments) {
        public Command {
            sagaId = required(sagaId, "sagaId");
            step = required(step, "step");
            idempotencyKey = required(idempotencyKey, "idempotencyKey");
            safeArguments = safeArguments == null ? Map.of() : Map.copyOf(safeArguments);
        }
    }

    public record RecoveryTask(String sagaId, String reasonCode, Instant createdAt, boolean assessmentFactPreserved) {
        public RecoveryTask {
            sagaId = required(sagaId, "sagaId");
            reasonCode = required(reasonCode, "reasonCode");
            Objects.requireNonNull(createdAt, "createdAt");
        }
    }

    public interface CommandPort { void send(Command command); }
    public interface CompensationPort { void compensate(RecoveryTask task); }

    private final int maxSagas;
    private final Map<String, State> states = new LinkedHashMap<>();
    private final CommandPort commands;
    private final CompensationPort compensations;

    public SagaCoordinator(int maxSagas, CommandPort commands, CompensationPort compensations) {
        if (maxSagas < 1) throw new IllegalArgumentException("maxSagas must be positive");
        this.maxSagas = maxSagas;
        this.commands = Objects.requireNonNull(commands, "commands");
        this.compensations = Objects.requireNonNull(compensations, "compensations");
    }

    public synchronized State start(String sagaId, Command command) {
        required(sagaId, "sagaId");
        Objects.requireNonNull(command, "command");
        if (!sagaId.equals(command.sagaId())) throw new IllegalArgumentException("command saga mismatch");
        if (!states.containsKey(sagaId) && states.size() >= maxSagas) throw new IllegalStateException("saga capacity reached");
        State current = states.get(sagaId);
        if (current != null) return current;
        states.put(sagaId, State.STARTED);
        commands.send(command);
        return State.STARTED;
    }

    public synchronized State completeStep(String sagaId, Command command) {
        State current = requiredState(sagaId);
        if (current == State.COMPENSATION_REQUIRED || current == State.MANUAL_RECOVERY) throw new IllegalStateException("saga requires recovery");
        commands.send(command);
        states.put(sagaId, State.STEP_COMPLETED);
        return State.STEP_COMPLETED;
    }

    public synchronized RecoveryTask fail(String sagaId, String reasonCode, Instant now) {
        requiredState(sagaId);
        RecoveryTask task = new RecoveryTask(sagaId, reasonCode, now, true);
        states.put(sagaId, State.COMPENSATION_REQUIRED);
        compensations.compensate(task);
        return task;
    }

    public synchronized void markManualRecovery(String sagaId) {
        requiredState(sagaId);
        states.put(sagaId, State.MANUAL_RECOVERY);
    }

    public synchronized State state(String sagaId) { return requiredState(sagaId); }

    private State requiredState(String sagaId) {
        State state = states.get(required(sagaId, "sagaId"));
        if (state == null) throw new IllegalArgumentException("unknown saga");
        return state;
    }

    private static String required(String value, String field) {
        if (value == null || value.isBlank()) throw new IllegalArgumentException(field + " is required");
        return value.trim();
    }
}
