package com.englishflow.workflow.adapter.http;

import com.englishflow.workflow.application.SagaService;
import com.englishflow.workflow.domain.SagaStatus;
import com.englishflow.workflow.domain.SagaStore;
import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * The HTTP boundary, exercised through the controller rather than through a running server.
 *
 * <p>What matters here is not routing but that the boundary cannot express something the domain forbids: a
 * compensation for a saga that is not awaiting one is refused, and starting a saga cannot smuggle in a step
 * that runs without its compensation having been recorded first. The heavy behaviour lives in SagaService and
 * is tested there; this checks the boundary does not add a way around it.
 */
class SagaControllerTest {

    /** A store that keeps just enough state for the boundary tests. */
    private static final class MinimalStore implements SagaStore {
        final Map<String, String> status = new java.util.LinkedHashMap<>();
        final Map<String, List<Step>> steps = new java.util.LinkedHashMap<>();
        List<Step> current;

        @Override
        public void start(String sagaId, String sagaName, String correlationId) {
            status.put(sagaId, SagaStatus.STARTED.name());
            steps.put(sagaId, new ArrayList<>());
            current = steps.get(sagaId);
        }

        @Override
        public void recordStepPlanned(String sagaId, String stepName, int stepOrder, String compensationName) {
            Step step = new Step();
            step.name = stepName;
            step.status = "PLANNED";
            step.compensation = compensationName;
            step.compensationState = "PENDING";
            current.add(step);
        }

        @Override
        public void markStepStarted(String sagaId, String stepName) {
            step(stepName).status = "RUNNING";
        }

        @Override
        public void markStepCompleted(String sagaId, String stepName) {
            step(stepName).status = "COMPLETED";
        }

        @Override
        public void markStepFailed(String sagaId, String stepName, String errorCode, String errorMessage) {
            Step step = step(stepName);
            step.status = "FAILED";
            step.errorCode = errorCode;
        }

        @Override
        public void markCompensation(String sagaId, String stepName, boolean succeeded, String errorMessage) {
            step(stepName).compensationState = succeeded ? "APPLIED" : "FAILED";
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
                    .map((step) -> new SagaStepRecord(sagaId, step.name, 1, step.status, step.compensation,
                            step.compensationState, 1, step.errorCode, null))
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
            return current.stream().filter((step) -> step.name.equals(name)).findFirst().orElseThrow();
        }

        static final class Step {
            String name;
            String status;
            String compensation;
            String compensationState;
            String errorCode;
        }
    }

    private static SagaController controller(MinimalStore store, List<String> ran) {
        return new SagaController(new SagaService(store, new com.englishflow.workflow.application.SagaCompensationExecutor(store)),
                ran::add);
    }

    @Test
    void startingASagaRunsItsStepsAndReportsTheState() {
        MinimalStore store = new MinimalStore();
        List<String> ran = new ArrayList<>();

        ResponseEntity<Map<String, Object>> response = controller(store, ran).start(
                new SagaController.StartSagaBody("enrolment", "corr-1", List.of(
                        new SagaController.StepBody("reserve-seat", "release-seat"))));

        assertEquals(201, response.getStatusCode().value());
        assertEquals("COMPLETED", response.getBody().get("status"));
        assertEquals(List.of("reserve-seat"), ran);
    }

    @Test
    void compensatingThroughTheBoundaryIsRefusedWhenTheSagaIsNotAwaitingIt() {
        MinimalStore store = new MinimalStore();
        List<String> ran = new ArrayList<>();
        SagaController controller = controller(store, ran);
        String sagaId = (String) controller.start(new SagaController.StartSagaBody("enrolment", "corr-2",
                List.of(new SagaController.StepBody("reserve-seat", "release-seat")))).getBody().get("sagaId");

        // The saga completed, so there is nothing to compensate and the boundary must say so rather than
        // silently doing nothing.
        assertThrows(IllegalStateException.class, () -> controller.compensate(sagaId));
    }

    @Test
    void theBoundaryExposesWhatIsStillInFlight() {
        MinimalStore store = new MinimalStore();
        List<String> ran = new ArrayList<>();
        SagaController controller = controller(store, ran);
        controller.start(new SagaController.StartSagaBody("enrolment", "corr-3",
                List.of(new SagaController.StepBody("charge-card", "refund-card"))));

        // The step ran and completed, so nothing is in flight and the sweep is empty.
        assertTrue(controller.unfinished().getBody().isEmpty());
    }
}
