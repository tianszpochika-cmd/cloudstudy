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
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * The ordering the saga depends on, with the store faked.
 *
 * <p>The rule under test is that a step's compensation is recorded before the step runs. Recorded afterwards,
 * a crash in between leaves work with no way back; recorded first, the worst case is a compensation for work
 * that did not happen, which an operator can see and dismiss. The order of the writes is what these tests
 * assert, not merely the final state.
 */
class SagaServiceTest {

    private FakeStore store;
    private SagaService service;

    @BeforeEach
    void setUp() {
        store = new FakeStore();
        service = new SagaService(store, new SagaCompensationExecutor(store));
    }

    @Test
    void aCompensationIsRecordedBeforeItsStepRuns() {
        List<String> order = new ArrayList<>();
        store.observe = order;
        store.stepsOf = new ArrayList<>();

        service.start("enrolment", "corr-1", List.of(
                new SagaService.Step("charge-card", "refund-card", () -> order.add("ran:charge-card"))));

        // The write has to come first in the recorded sequence, not just exist by the end.
        assertEquals(List.of("planned:charge-card", "started:charge-card", "ran:charge-card", "completed:charge-card"),
                order);
    }

    @Test
    void aFailingStepMovesTheSagaToCompensatingWithSomethingToUndo() {
        SagaService.SagaView view = service.start("enrolment", "corr-2", List.of(
                new SagaService.Step("reserve-seat", "release-seat", () -> { }),
                new SagaService.Step("charge-card", "refund-card", () -> {
                    throw new IllegalStateException("card declined");
                })));

        assertEquals(SagaStatus.COMPENSATING.name(), view.status());
        assertEquals("charge-card", view.currentStep());
        // The reason survives so an operator can act on it rather than guessing why the saga stopped.
        assertEquals("card declined", view.lastErrorMessage());
    }

    @Test
    void everyStepCompletingLeavesTheSagaCompleted() {
        SagaService.SagaView view = service.start("enrolment", "corr-3", List.of(
                new SagaService.Step("reserve-seat", "release-seat", () -> { }),
                new SagaService.Step("charge-card", "refund-card", () -> { })));

        assertEquals(SagaStatus.COMPLETED.name(), view.status());
        assertTrue(view.steps().stream().allMatch((step) -> "COMPLETED".equals(step.get("status"))));
    }

    @Test
    void compensatingAFailedSagaRunsTheRecordedCompensationsInReverse() {
        SagaService.SagaView started = service.start("enrolment", "corr-4", List.of(
                new SagaService.Step("reserve-seat", "release-seat", () -> { }),
                new SagaService.Step("charge-card", "refund-card", () -> { }),
                new SagaService.Step("grant-access", "revoke-access", () -> {
                    throw new IllegalStateException("grant refused");
                })));
        assertEquals(SagaStatus.COMPENSATING.name(), started.status());

        List<String> applied = new ArrayList<>();
        SagaService.SagaView compensated = service.compensate(started.sagaId(), applied::add);

        // grant-access never completed, so its compensation must not run; the two that did run in reverse.
        assertEquals(List.of("refund-card", "release-seat"), applied);
        assertEquals(SagaStatus.COMPENSATED.name(), compensated.status());
    }

    @Test
    void compensatingASagaThatIsNotAwaitingCompensationIsRefused() {        SagaService.SagaView completed = service.start("enrolment", "corr-5", List.of(
                new SagaService.Step("reserve-seat", "release-seat", () -> { })));

        IllegalStateException refusal = assertThrows(IllegalStateException.class,
                () -> service.compensate(completed.sagaId(), (name) -> { }));

        assertTrue(refusal.getMessage().contains("not awaiting compensation"), refusal.getMessage());
    }

    @Test
    void theRecoverySweepSeesTheSagaAndItsStatusIsReported() {
        // A step has to complete before the failure, otherwise there is nothing to undo and the saga settles
        // as COMPENSATED by design rather than waiting for a compensation run.
        SagaService.SagaView failed = service.start("enrolment", "corr-6", List.of(
                new SagaService.Step("reserve-seat", "release-seat", () -> { }),
                new SagaService.Step("charge-card", "refund-card", () -> {
                    throw new IllegalStateException("timed out");
                })));

        assertEquals(SagaStatus.COMPENSATING.name(), failed.status());
        assertTrue(service.unfinished(10).contains(failed.sagaId()));
        assertTrue(SagaService.statusAfterFailure(List.of("charge-card"), Map.of("charge-card", "refund-card"))
                == SagaStatus.COMPENSATING);
        // And with nothing completed, the saga does not enter a compensating state whose only exit is a run
        // with no work to do.
        assertEquals(SagaStatus.COMPENSATED,
                SagaService.statusAfterFailure(List.of(), Map.of("charge-card", "refund-card")));
    }

    @Test
    void aFailingCompensationLeavesTheSagaFailedInsteadOfFakeSuccess() {
        SagaService.SagaView started = service.start("enrolment", "corr-7", List.of(
                new SagaService.Step("reserve-seat", "release-seat", () -> { }),
                new SagaService.Step("charge-card", "refund-card", () -> {
                    throw new IllegalStateException("card declined");
                })));
        assertEquals(SagaStatus.COMPENSATING.name(), started.status());

        // The transport refuses: no owner was called, so the saga must surface
        // COMPENSATION_FAILED for an operator rather than mis-record APPLIED.
        SagaService.SagaView finished = service.compensate(started.sagaId(), (name) -> {
            throw new IllegalStateException("no compensation transport for '" + name + "'");
        });

        assertEquals(SagaStatus.COMPENSATION_FAILED.name(), finished.status());
    }

    /** A store that records the order of every write, which is what the ordering test asserts. */
    private static final class FakeStore implements SagaStore {
        final Map<String, String> status = new LinkedHashMap<>();
        final Map<String, List<Step>> steps = new LinkedHashMap<>();
        List<String> observe;
        List<Step> stepsOf;

        @Override
        public void start(String sagaId, String sagaName, String correlationId) {
            status.put(sagaId, SagaStatus.STARTED.name());
            steps.put(sagaId, new ArrayList<>());
            stepsOf = steps.get(sagaId);
        }

        @Override
        public void recordStepPlanned(String sagaId, String stepName, int stepOrder, String compensationName) {
            if (observe != null) observe.add("planned:" + stepName);
            Step step = new Step();
            step.name = stepName;
            step.order = stepOrder;
            step.status = "PLANNED";
            step.compensation = compensationName;
            step.compensationState = "PENDING";
            stepsOf.add(step);
        }

        @Override
        public void markStepStarted(String sagaId, String stepName) {
            if (observe != null) observe.add("started:" + stepName);
            step(stepName).status = "RUNNING";
        }

        @Override
        public void markStepCompleted(String sagaId, String stepName) {
            if (observe != null) observe.add("completed:" + stepName);
            step(stepName).status = "COMPLETED";
        }

        @Override
        public void markStepFailed(String sagaId, String stepName, String errorCode, String errorMessage) {
            Step step = step(stepName);
            step.status = "FAILED";
            step.lastErrorCode = errorCode;
            step.lastErrorMessage = errorMessage;
        }

        @Override
        public void markCompensation(String sagaId, String stepName, boolean succeeded, String errorMessage) {
            Step step = step(stepName);
            step.compensationState = succeeded ? "APPLIED" : "FAILED";
            step.lastErrorMessage = errorMessage;
        }

        @Override
        public void updateStatus(String sagaId, SagaStatus next, String currentStep, String errorCode, String errorMessage) {
            status.put(sagaId, next.name());
            this.currentStep = currentStep;
            this.errorCode = errorCode;
            this.errorMessage = errorMessage;
        }

        String currentStep;
        String errorCode;
        String errorMessage;

        @Override
        public Optional<SagaRecord> find(String sagaId) {
            return Optional.of(new SagaRecord(sagaId, "enrolment", "corr", SagaStatus.valueOf(status.get(sagaId)),
                    currentStep, 1, errorCode, errorMessage));
        }

        @Override
        public List<SagaStepRecord> steps(String sagaId) {
            return steps.get(sagaId).stream()
                    .map((step) -> new SagaStepRecord(sagaId, step.name, step.order, step.status, step.compensation,
                            step.compensationState, 1, step.lastErrorCode, step.lastErrorMessage))
                    .toList();
        }

        @Override
        public List<SagaRecord> unfinished(int limit) {
            return status.entrySet().stream()
                    .filter((entry) -> !SagaStatus.valueOf(entry.getValue()).isTerminal())
                    .map((entry) -> new SagaRecord(entry.getKey(), "enrolment", "corr",
                            SagaStatus.valueOf(entry.getValue()), currentStep, 1, errorCode, errorMessage))
                    .toList();
        }

        private Step step(String name) {
            return stepsOf.stream().filter((candidate) -> candidate.name.equals(name)).findFirst().orElseThrow();
        }

        static final class Step {
            String name;
            int order;
            String status;
            String compensation;
            String compensationState;
            String lastErrorCode;
            String lastErrorMessage;
        }
    }
}
