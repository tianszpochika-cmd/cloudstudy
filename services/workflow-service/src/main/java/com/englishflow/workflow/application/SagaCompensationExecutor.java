package com.englishflow.workflow.application;

import com.englishflow.workflow.domain.SagaStateMachine;
import com.englishflow.workflow.domain.SagaStatus;
import com.englishflow.workflow.domain.SagaStore;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Runs a saga's compensations after a step failed.
 *
 * <p>The executor is deliberately not a transaction. A compensation calls into another owner, and those calls
 * cannot be rolled back together; the receipt is what makes the outcome knowable. So each compensation is
 * recorded as it finishes, and a compensation that fails marks the saga as needing an operator rather than
 * being retried in a loop that would keep calling a failing dependency.
 *
 * <p>Idempotence matters here for a different reason than elsewhere: the recovery sweep may pick up the same
 * saga twice if the process dies mid-run, so a compensation already recorded as APPLIED is skipped rather
 * than run again. Running it twice is the one outcome that must not happen, because a refund applied twice is
 * a real loss.
 */
public class SagaCompensationExecutor {

    /** The outcome of a compensation run. */
    public record Outcome(String sagaId, List<String> attempted, List<String> skipped, List<String> failed,
                          SagaStatus status) {
    }

    private final SagaStore store;

    public SagaCompensationExecutor(SagaStore store) {
        this.store = store;
    }

    /**
     * Compensates a saga's completed steps, most recent first.
     *
     * @param compensate the action to take for one compensation name
     */
    public Outcome compensate(String sagaId, CompensationAction compensate) {
        List<SagaStore.SagaStepRecord> steps = store.steps(sagaId);
        Map<String, String> compensations = SagaStore.completedCompensations(steps);
        List<String> order = SagaStateMachine.compensationOrder(
                steps.stream().map(SagaStore.SagaStepRecord::stepName).toList(), compensations);

        List<String> attempted = new ArrayList<>();
        List<String> skipped = new ArrayList<>();
        List<String> failed = new ArrayList<>();

        // Completed steps in reverse, paired with the compensation recorded for them.
        List<String> completedSteps = steps.stream()
                .filter((step) -> "COMPLETED".equals(step.status()))
                .map(SagaStore.SagaStepRecord::stepName)
                .toList();
        for (int index = completedSteps.size() - 1; index >= 0; index -= 1) {
            String step = completedSteps.get(index);
            String compensation = compensations.get(step);
            if (compensation == null) {
                continue;
            }
            SagaStore.SagaStepRecord record = steps.stream()
                    .filter((candidate) -> candidate.stepName().equals(step)).findFirst().orElseThrow();
            if ("APPLIED".equals(record.compensationState())) {
                // Already compensated by an earlier run that died before finishing the rest.
                skipped.add(compensation);
                continue;
            }
            attempted.add(compensation);
            try {
                compensate.apply(compensation);
                store.markCompensation(sagaId, step, true, null);
            } catch (RuntimeException failure) {
                store.markCompensation(sagaId, step, false, message(failure));
                failed.add(compensation);
            }
        }

        SagaStatus status = SagaStateMachine.onCompensationFinished(failed.size());
        store.updateStatus(sagaId, status, null, failed.isEmpty() ? null : "COMPENSATION_FAILED",
                failed.isEmpty() ? null : "failed compensations: " + String.join(", ", failed));
        return new Outcome(sagaId, List.copyOf(attempted), List.copyOf(skipped), List.copyOf(failed), status);
    }

    /** Records that a saga failed and moves it to compensating, without running anything. */
    public SagaStatus markFailed(String sagaId, String currentStep, String errorCode, String errorMessage) {
        List<SagaStore.SagaStepRecord> steps = store.steps(sagaId);
        SagaStatus status = SagaStateMachine.onStepFailed(
                SagaStore.completedCompensations(steps).keySet().stream().toList(),
                SagaStore.completedCompensations(steps));
        store.updateStatus(sagaId, status, currentStep, errorCode, errorMessage);
        return status;
    }

    private static String message(RuntimeException failure) {
        String value = failure.getMessage();
        return value == null ? failure.getClass().getSimpleName() : value.substring(0, Math.min(255, value.length()));
    }

    /** The action to take for one compensation. */
    @FunctionalInterface
    public interface CompensationAction {
        void apply(String compensationName);
    }
}
