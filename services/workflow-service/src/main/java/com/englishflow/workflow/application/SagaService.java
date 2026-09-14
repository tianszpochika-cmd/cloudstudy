package com.englishflow.workflow.application;

import com.englishflow.workflow.domain.SagaStateMachine;
import com.englishflow.workflow.domain.SagaStatus;
import com.englishflow.workflow.domain.SagaStore;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Runs a saga: it plans each step with its compensation, runs the steps in order, and compensates in reverse
 * when one fails.
 *
 * <p>Two rules shape the code. A step's compensation is recorded before the step runs, so a crash in between
 * leaves a compensation for work that may not have happened — recoverable — rather than work with no way
 * back. And the compensation runs through the executor, which refuses to apply one twice, because the
 * compensation calls another owner and a refund applied twice is a real loss.
 */
public class SagaService {

    /** A step to run, with the compensation that undoes it. */
    public record Step(String name, String compensation, StepAction action) {
    }

    /** What a caller sees. */
    public record SagaView(String sagaId, String status, String currentStep, List<Map<String, Object>> steps,
                           String lastErrorCode, String lastErrorMessage) {

        static SagaView of(SagaStore.SagaRecord saga, List<SagaStore.SagaStepRecord> steps) {
            List<Map<String, Object>> rows = new ArrayList<>();
            for (SagaStore.SagaStepRecord step : steps) {
                Map<String, Object> row = new LinkedHashMap<>();
                row.put("step", step.stepName());
                row.put("order", step.stepOrder());
                row.put("status", step.status());
                row.put("compensation", step.compensationName());
                row.put("compensationState", step.compensationState());
                row.put("attemptCount", step.attemptCount());
                row.put("lastErrorCode", step.lastErrorCode());
                rows.add(row);
            }
            return new SagaView(saga.sagaId(), saga.status().name(), saga.currentStep(), rows,
                    saga.lastErrorCode(), saga.lastErrorMessage());
        }

        public Map<String, Object> toMap() {
            Map<String, Object> map = new LinkedHashMap<>();
            map.put("sagaId", sagaId);
            map.put("status", status);
            map.put("currentStep", currentStep);
            map.put("steps", steps);
            map.put("lastErrorCode", lastErrorCode);
            map.put("lastErrorMessage", lastErrorMessage);
            return map;
        }
    }

    private final SagaStore store;
    private final SagaCompensationExecutor executor;

    public SagaService(SagaStore store, SagaCompensationExecutor executor) {
        this.store = store;
        this.executor = executor;
    }

    /** Starts a saga and runs its steps until one fails or they all complete. */
    public SagaView start(String sagaName, String correlationId, List<Step> steps) {
        String sagaId = UUID.randomUUID().toString();
        store.start(sagaId, sagaName, correlationId);
        store.updateStatus(sagaId, SagaStatus.RUNNING, null, null, null);

        int order = 1;
        for (Step step : steps) {
            // Recorded before the action runs, which is the ordering the crash window depends on.
            store.recordStepPlanned(sagaId, step.name(), order, step.compensation());
            store.markStepStarted(sagaId, step.name());
            try {
                step.action().run();
                store.markStepCompleted(sagaId, step.name());
            } catch (RuntimeException failure) {
                String message = failure.getMessage() == null ? failure.getClass().getSimpleName()
                        : failure.getMessage().substring(0, Math.min(255, failure.getMessage().length()));
                store.markStepFailed(sagaId, step.name(), "STEP_FAILED", message);
                // The saga moves to compensating; the caller decides whether to compensate now or let the
                // recovery sweep pick it up, which is why the two are separate calls.
                executor.markFailed(sagaId, step.name(), "STEP_FAILED", message);
                return find(sagaId);
            }
            order += 1;
        }

        store.updateStatus(sagaId, SagaStatus.COMPLETED, null, null, null);
        return find(sagaId);
    }

    /** Compensates a failed saga, most recent completed step first. */
    public SagaView compensate(String sagaId, SagaCompensationExecutor.CompensationAction action) {
        SagaStore.SagaRecord saga = store.find(sagaId).orElseThrow(() -> new IllegalArgumentException("no saga " + sagaId));
        if (saga.status() != SagaStatus.COMPENSATING) {
            // Refused rather than ignored: compensating a saga that is not compensating would either do
            // nothing or undo work that is still wanted, and both are worse than an error the caller can read.
            throw new IllegalStateException("a saga in state " + saga.status() + " is not awaiting compensation");
        }
        executor.compensate(sagaId, action);
        return find(sagaId);
    }

    /** Reads a saga and its steps. */
    public SagaView find(String sagaId) {
        SagaStore.SagaRecord saga = store.find(sagaId).orElseThrow(() -> new IllegalArgumentException("no saga " + sagaId));
        return SagaView.of(saga, store.steps(sagaId));
    }

    /** Sagas still in flight, oldest first, for the recovery sweep. */
    public List<String> unfinished(int limit) {
        return store.unfinished(limit).stream().map(SagaStore.SagaRecord::sagaId).toList();
    }

    /** Whether a saga's status means an operator has to act. */
    public static boolean needsOperator(SagaStatus status) {
        return status.needsOperator();
    }

    /** Whether nothing further is expected. */
    public static boolean isTerminal(SagaStatus status) {
        return status.isTerminal();
    }

    /** The domain's answer for what a saga should become after a failure, exposed for callers. */
    public static SagaStatus statusAfterFailure(List<String> completedSteps, Map<String, String> compensations) {
        return SagaStateMachine.onStepFailed(completedSteps, compensations);
    }

    /** The action to take for one step. */
    @FunctionalInterface
    public interface StepAction {
        void run();
    }
}
