package com.englishflow.workflow.domain;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * The ordering rules that make compensation correct, tested without a database.
 *
 * <p>Compensating in the wrong order is the failure these tests exist to catch: undoing a step before the
 * step that depends on it leaves the two inconsistent, and it is the kind of mistake that only shows up
 * under a failure, which is exactly when nobody is watching.
 */
class SagaStateMachineTest {

    private static final Map<String, String> COMPENSATIONS = Map.of(
            "reserve-seat", "release-seat",
            "charge-card", "refund-card",
            "grant-access", "revoke-access");

    @Test
    void compensationsRunInReverseOrderOfCompletion() {
        List<String> completed = List.of("reserve-seat", "charge-card", "grant-access");

        assertEquals(List.of("revoke-access", "refund-card", "release-seat"),
                SagaStateMachine.compensationOrder(completed, COMPENSATIONS));
    }

    @Test
    void aStepThatNeverCompletedIsNeverCompensated() {
        // Only the first step ran, so only its compensation may run even though the other steps are known.
        List<String> completed = List.of("reserve-seat");

        assertEquals(List.of("release-seat"), SagaStateMachine.compensationOrder(completed, COMPENSATIONS));
    }

    @Test
    void aStepWithoutARecordedCompensationIsSkippedRatherThanInvented() {
        List<String> completed = List.of("reserve-seat", "send-email");

        // send-email has no compensation, so it contributes nothing; the receipt shows the gap rather than
        // this method guessing at an action nobody defined.
        assertEquals(List.of("release-seat"), SagaStateMachine.compensationOrder(completed, COMPENSATIONS));
    }

    @Test
    void aFailureWithNothingToUndoDoesNotEnterCompensating() {
        assertEquals(SagaStatus.COMPENSATED, SagaStateMachine.onStepFailed(List.of(), COMPENSATIONS));
        assertEquals(SagaStatus.COMPENSATED, SagaStateMachine.onStepFailed(List.of("send-email"), COMPENSATIONS));
    }

    @Test
    void aFailureWithSomethingToUndoEntersCompensating() {
        assertEquals(SagaStatus.COMPENSATING, SagaStateMachine.onStepFailed(List.of("charge-card"), COMPENSATIONS));
    }

    @Test
    void aFailedCompensationNeedsAnOperatorAndACompletedOneDoesNot() {
        assertEquals(SagaStatus.COMPENSATED, SagaStateMachine.onCompensationFinished(0));
        assertEquals(SagaStatus.COMPENSATION_FAILED, SagaStateMachine.onCompensationFinished(1));

        assertTrue(SagaStatus.COMPENSATION_FAILED.needsOperator());
        assertFalse(SagaStatus.COMPENSATED.needsOperator());
        assertFalse(SagaStatus.COMPLETED.needsOperator());
    }

    @Test
    void terminalStatesAreTheOnesNothingElseFollows() {
        assertTrue(SagaStatus.COMPLETED.isTerminal());
        assertTrue(SagaStatus.COMPENSATED.isTerminal());
        assertTrue(SagaStatus.COMPENSATION_FAILED.isTerminal());
        assertFalse(SagaStatus.STARTED.isTerminal());
        assertFalse(SagaStatus.RUNNING.isTerminal());
        assertFalse(SagaStatus.COMPENSATING.isTerminal());
    }

    @Test
    void anUnexpiredLeaseHeldByAnotherInstanceRefusesTheJob() {
        long now = 1_000_000L;

        assertFalse(SagaStateMachine.mayRunJob("instance-a", now + 60_000L, "instance-b", now),
                "another instance holds an unexpired lease");
        assertTrue(SagaStateMachine.mayRunJob("instance-a", now - 1L, "instance-b", now),
                "an expired lease is reclaimable so a crashed holder does not block the job forever");
        assertTrue(SagaStateMachine.mayRunJob("instance-a", now + 60_000L, "instance-a", now),
                "the holder may renew its own lease");
        assertTrue(SagaStateMachine.mayRunJob(null, null, "instance-b", now),
                "an unheld job is available");
    }
}
