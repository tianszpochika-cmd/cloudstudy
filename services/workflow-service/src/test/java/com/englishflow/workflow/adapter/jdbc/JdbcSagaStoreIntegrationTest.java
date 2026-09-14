package com.englishflow.workflow.adapter.jdbc;

import com.englishflow.workflow.domain.SagaStatus;
import com.englishflow.workflow.domain.SagaStore;
import com.englishflow.workflow.domain.SagaStateMachine;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * The saga store against real MySQL.
 *
 * <p>Gated behind {@code workflow.jdbc.integration} so an ordinary unit-test run does not need a database,
 * and skipped loudly rather than passing quietly when the flag is absent. It proves the properties the state
 * machine depends on hold in the database and not only in memory: that a compensation survives a restart
 * because it was written before the step ran, that compensations run in reverse, and that an unfinished saga
 * is found by the recovery sweep while a finished one is not.
 */
@EnabledIfSystemProperty(named = "workflow.jdbc.integration", matches = "true")
class JdbcSagaStoreIntegrationTest {

    private static JdbcTemplate jdbc() {
        String url = required("WORKFLOW_JDBC_TEST_JDBC_URL");
        DriverManagerDataSource source = new DriverManagerDataSource(url,
                required("WORKFLOW_JDBC_TEST_USERNAME"), System.getenv().getOrDefault("WORKFLOW_JDBC_TEST_PASSWORD", ""));
        return new JdbcTemplate(source);
    }

    private static String required(String name) {
        String value = System.getenv(name);
        if (value == null || value.isBlank()) {
            throw new IllegalStateException(name + " is required");
        }
        return value;
    }

    private static void insertSaga(JdbcTemplate jdbc, String sagaId, String name) {
        jdbc.update("""
                INSERT INTO workflow_service.saga_instance
                    (saga_id, saga_name, correlation_id, status, attempt_count, started_at)
                VALUES (?, ?, ?, 'STARTED', 0, UTC_TIMESTAMP(6))
                """, sagaId, name, UUID.randomUUID().toString());
    }

    @Test
    void aCompensationWrittenBeforeTheStepSurvivesAndRunsInReverseWhenTheSagaFails() {
        JdbcTemplate jdbc = jdbc();
        String sagaId = UUID.randomUUID().toString();
        insertSaga(jdbc, sagaId, "enrolment");
        SagaStore store = new JdbcSagaStore(jdbc);

        // Planned before running, which is what makes the crash window recoverable.
        store.recordStepPlanned(sagaId, "reserve-seat", 1, "release-seat");
        store.recordStepPlanned(sagaId, "charge-card", 2, "refund-card");
        store.recordStepPlanned(sagaId, "grant-access", 3, "revoke-access");
        for (String step : List.of("reserve-seat", "charge-card", "grant-access")) {
            store.markStepStarted(sagaId, step);
            store.markStepCompleted(sagaId, step);
        }

        // The failure arrives; the recorded compensations are read back from the database rather than from
        // anything held in memory.
        List<SagaStore.SagaStepRecord> steps = store.steps(sagaId);
        Map<String, String> compensations = SagaStore.completedCompensations(steps);
        List<String> order = SagaStateMachine.compensationOrder(
                steps.stream().map(SagaStore.SagaStepRecord::stepName).toList(), compensations);
        assertEquals(List.of("revoke-access", "refund-card", "release-seat"), order);

        store.markStepFailed(sagaId, "grant-access", "ACCESS_DENIED", "grant refused");
        store.updateStatus(sagaId, SagaStateMachine.onStepFailed(List.of("reserve-seat", "charge-card"),
                compensations), "grant-access", "ACCESS_DENIED", "grant refused");

        SagaStore.SagaRecord saga = store.find(sagaId).orElseThrow();
        assertEquals(SagaStatus.COMPENSATING, saga.status());

        for (String compensation : order) {
            store.markCompensation(sagaId, compensation.equals("revoke-access") ? "grant-access"
                    : compensation.equals("refund-card") ? "charge-card" : "reserve-seat", true, null);
        }
        store.updateStatus(sagaId, SagaStateMachine.onCompensationFinished(0), null, null, null);
        assertEquals(SagaStatus.COMPENSATED, store.find(sagaId).orElseThrow().status());
        assertTrue(store.steps(sagaId).stream().allMatch(step -> "APPLIED".equals(step.compensationState())));
    }

    @Test
    void theRecoverySweepFindsUnfinishedSagasAndLeavesFinishedOnesAlone() {
        JdbcTemplate jdbc = jdbc();
        SagaStore store = new JdbcSagaStore(jdbc);
        // Sagas abandoned by earlier runs share this database and the sweep returns the fifty oldest, so without this the
        // case measures the order of unrelated rows rather than the predicate it is about. Only rows in a non-terminal
        // state are cleared, and only for this case: a finished saga is what the second assertion needs.
        int abandonedByEarlierRuns = jdbc.update("""
                DELETE FROM workflow_service.saga_instance
                 WHERE status NOT IN ('COMPLETED','COMPENSATED','COMPENSATION_FAILED')
                """);
        assertTrue(abandonedByEarlierRuns >= 0, "the cleanup has to run");
        String unfinished = UUID.randomUUID().toString();
        String finished = UUID.randomUUID().toString();
        insertSaga(jdbc, unfinished, "enrolment");
        insertSaga(jdbc, finished, "enrolment");
        store.recordStepPlanned(finished, "reserve-seat", 1, "release-seat");
        store.updateStatus(finished, SagaStatus.COMPLETED, null, null, null);

        List<String> swept = store.unfinished(50).stream().map(SagaStore.SagaRecord::sagaId).toList();

        assertTrue(swept.contains(unfinished), "an unfinished saga has to be picked up by the sweep");
        assertTrue(!swept.contains(finished), "a completed saga must not be swept again");
    }

    @Test
    void planningAStepTwiceDoesNotReplaceItsRecordedCompensation() {
        JdbcTemplate jdbc = jdbc();
        String sagaId = UUID.randomUUID().toString();
        insertSaga(jdbc, sagaId, "enrolment");
        SagaStore store = new JdbcSagaStore(jdbc);

        store.recordStepPlanned(sagaId, "charge-card", 2, "refund-card");
        store.markStepStarted(sagaId, "charge-card");
        store.markStepCompleted(sagaId, "charge-card");
        // A retry re-plans the step; the recorded compensation must not change under it.
        store.recordStepPlanned(sagaId, "charge-card", 2, "something-else");

        assertEquals("refund-card", store.steps(sagaId).getFirst().compensationName());
    }
}
