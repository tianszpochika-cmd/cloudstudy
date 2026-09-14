package com.englishflow.workflow.domain;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * The saga state machine, as pure logic.
 *
 * <p>It is separated from persistence so the ordering rules can be tested without a database, and so the
 * service cannot compensate in the wrong order merely because a query returned rows in a different order.
 * The rule that matters: compensations run in reverse of the order the steps completed, and a step that
 * never completed is never compensated.
 */
public final class SagaStateMachine {

    private SagaStateMachine() {
    }

    /**
     * The compensations to run for a saga that is failing, most recent step first.
     *
     * @param completedSteps step names in the order they completed
     * @param compensationByStep the compensation recorded for each step before it was attempted
     * @return compensation names in the order they must run
     */
    public static List<String> compensationOrder(List<String> completedSteps, Map<String, String> compensationByStep) {
        List<String> order = new ArrayList<>();
        for (int index = completedSteps.size() - 1; index >= 0; index -= 1) {
            String step = completedSteps.get(index);
            String compensation = compensationByStep.get(step);
            // A step with no recorded compensation is skipped rather than guessed at. If it changed
            // something, that change is not compensatable by this saga and the gap should be visible in
            // the receipt rather than hidden behind an invented action.
            if (compensation != null && !compensation.isBlank()) {
                order.add(compensation);
            }
        }
        return List.copyOf(order);
    }

    /**
     * The status after a step fails.
     *
     * <p>A saga with nothing to compensate is completed-with-failure rather than compensating, so it does
     * not enter a state whose only exit is a compensation run that has no work to do.
     */
    public static SagaStatus onStepFailed(List<String> completedSteps, Map<String, String> compensationByStep) {
        return compensationOrder(completedSteps, compensationByStep).isEmpty()
                ? SagaStatus.COMPENSATED
                : SagaStatus.COMPENSATING;
    }

    /**
     * The status after a compensation run finishes.
     *
     * @param failedCompensations compensations that did not succeed
     */
    public static SagaStatus onCompensationFinished(int failedCompensations) {
        return failedCompensations == 0 ? SagaStatus.COMPENSATED : SagaStatus.COMPENSATION_FAILED;
    }

    /**
     * Whether a leased job may run.
     *
     * <p>A lease held by someone else and not yet expired is a refusal, not a reason to run anyway: two
     * instances running the same job is the failure this lease exists to prevent. An expired lease is
     * reclaimable, so a crashed holder does not block the job forever.
     */
    public static boolean mayRunJob(String leaseOwner, Long leaseExpiresAtEpochMillis, String self, long nowEpochMillis) {
        if (leaseOwner == null || leaseOwner.isBlank()) {
            return true;
        }
        if (leaseOwner.equals(self)) {
            return true;
        }
        return leaseExpiresAtEpochMillis != null && leaseExpiresAtEpochMillis <= nowEpochMillis;
    }
}
