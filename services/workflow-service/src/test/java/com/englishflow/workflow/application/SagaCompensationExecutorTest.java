package com.englishflow.workflow.application;

import com.englishflow.workflow.domain.SagaStatus;
import com.englishflow.workflow.domain.SagaStore;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * The executor's rules, with the store faked so the assertions are about ordering and idempotence rather
 * than about MySQL. The database side is covered separately by the gated store test.
 *
 * <p>The rule that matters most: a compensation already applied is never applied again. The recovery sweep
 * can pick up the same saga after a crash, and a refund applied twice is a real loss rather than a
 * duplicated log line.
 */
class SagaCompensationExecutorTest {

    private FakeStore store;
    private SagaCompensationExecutor executor;

    @BeforeEach
    void setUp() {
        store = new FakeStore();
        executor = new SagaCompensationExecutor(store);
    }

    @Test
    void compensationsRunMostRecentFirstAndTheSagaEndsCompensated() {
        store.addStep("charge-card", "COMPLETED", "refund-card");
        store.addStep("grant-access", "COMPLETED", "revoke-access");
        List<String> applied = new ArrayList<>();

        SagaCompensationExecutor.Outcome outcome = executor.compensate("s-1", applied::add);

        assertEquals(List.of("revoke-access", "refund-card"), applied, "most recent step is undone first");
        assertEquals(List.of("revoke-access", "refund-card"), outcome.attempted());
        assertEquals(SagaStatus.COMPENSATED, outcome.status());
        assertEquals(SagaStatus.COMPENSATED, store.status);
    }

    @Test
    void aCompensationAlreadyAppliedIsSkippedRatherThanRunAgain() {
        store.addStep("charge-card", "COMPLETED", "refund-card");
        store.addStep("grant-access", "COMPLETED", "revoke-access");
        // An earlier run refunded and then died before revoking: charge-card is steps[0] and is the one
        // already compensated.
        store.steps.get(0).compensationState = "APPLIED";
        List<String> applied = new ArrayList<>();

        SagaCompensationExecutor.Outcome outcome = executor.compensate("s-2", applied::add);

        assertEquals(List.of("revoke-access"), applied, "the refund must not happen twice");
        assertEquals(List.of("refund-card"), outcome.skipped());
        assertEquals(SagaStatus.COMPENSATED, outcome.status());
    }

    @Test
    void aStepThatNeverCompletedIsNotCompensated() {
        store.addStep("charge-card", "COMPLETED", "refund-card");
        store.addStep("grant-access", "FAILED", "revoke-access");
        List<String> applied = new ArrayList<>();

        executor.compensate("s-3", applied::add);

        assertEquals(List.of("refund-card"), applied, "the step that failed did its work undone already");
    }

    @Test
    void aFailingCompensationIsRecordedAndNeedsAnOperator() {
        store.addStep("charge-card", "COMPLETED", "refund-card");
        store.addStep("grant-access", "COMPLETED", "revoke-access");

        SagaCompensationExecutor.Outcome outcome = executor.compensate("s-4", (name) -> {
            if (name.equals("refund-card")) {
                throw new IllegalStateException("payment provider unavailable");
            }
        });

        assertEquals(List.of("refund-card"), outcome.failed());
        assertEquals(SagaStatus.COMPENSATION_FAILED, outcome.status());
        assertTrue(outcome.status().needsOperator(), "a failed compensation is not a finished saga");
        assertEquals("payment provider unavailable", store.steps.get(0).lastErrorMessage,
                "the reason has to survive so an operator can act on it");
    }

    @Test
    void aFailureWithNothingToUndoDoesNotCallAnythingAndStillSettles() {
        store.addStep("send-email", "FAILED", null);
        List<String> applied = new ArrayList<>();

        SagaCompensationExecutor.Outcome outcome = executor.compensate("s-5", applied::add);

        assertTrue(applied.isEmpty());
        assertEquals(SagaStatus.COMPENSATED, outcome.status());
    }

    @Test
    void markingAFailureWithSomethingToUndoEntersCompensatingRatherThanFinished() {
        store.addStep("charge-card", "COMPLETED", "refund-card");

        SagaStatus status = executor.markFailed("s-6", "charge-card", "CARD_DECLINED", "declined");

        assertEquals(SagaStatus.COMPENSATING, status);
        assertEquals("CARD_DECLINED", store.lastErrorCode);
    }

    /** A store that keeps steps in memory, so the executor's rules can be tested without a database. */
    private static final class FakeStore implements SagaStore {
        final List<Step> steps = new ArrayList<>();
        SagaStatus status = SagaStatus.STARTED;
        String lastErrorCode;

        void addStep(String name, String status, String compensation) {
            Step step = new Step();
            step.stepName = name;
            step.status = status;
            step.compensationName = compensation;
            step.compensationState = "PENDING";
            step.stepOrder = steps.size() + 1;
            steps.add(step);
        }

        @Override
        public void recordStepPlanned(String sagaId, String stepName, int stepOrder, String compensationName) {
            throw new UnsupportedOperationException();
        }

        @Override
        public void markStepStarted(String sagaId, String stepName) {
            throw new UnsupportedOperationException();
        }

        @Override
        public void markStepCompleted(String sagaId, String stepName) {
            throw new UnsupportedOperationException();
        }

        @Override
        public void markStepFailed(String sagaId, String stepName, String errorCode, String errorMessage) {
            throw new UnsupportedOperationException();
        }

        @Override
        public void markCompensation(String sagaId, String stepName, boolean succeeded, String errorMessage) {
            Step step = steps.stream().filter((candidate) -> candidate.stepName.equals(stepName)).findFirst().orElseThrow();
            step.compensationState = succeeded ? "APPLIED" : "FAILED";
            step.lastErrorMessage = errorMessage;
        }

        @Override
        public void updateStatus(String sagaId, SagaStatus status, String currentStep, String errorCode, String errorMessage) {
            this.status = status;
            this.lastErrorCode = errorCode;
        }

        @Override
        public Optional<SagaRecord> find(String sagaId) {
            return Optional.empty();
        }

        @Override
        public List<SagaStepRecord> steps(String sagaId) {
            return steps.stream()
                    .map((step) -> new SagaStepRecord("s", step.stepName, step.stepOrder, step.status,
                            step.compensationName, step.compensationState, 1, null, step.lastErrorMessage))
                    .toList();
        }

        @Override
        public List<SagaRecord> unfinished(int limit) {
            return List.of();
        }

        static final class Step {
            String stepName;
            int stepOrder;
            String status;
            String compensationName;
            String compensationState;
            String lastErrorMessage;
        }
    }
}
