package com.englishflow.workflow.config;

import com.englishflow.workflow.adapter.jdbc.WorkflowTables;
import com.englishflow.workflow.adapter.http.SagaController;
import com.englishflow.workflow.adapter.jdbc.JdbcJobLeaseStore;
import com.englishflow.workflow.adapter.jdbc.JdbcRecoveryStore;
import com.englishflow.workflow.adapter.jdbc.JdbcSagaStore;
import com.englishflow.workflow.adapter.jdbc.JdbcWorkflowOutbox;
import com.englishflow.workflow.application.CompensationTransport;
import com.englishflow.workflow.application.ManualRecoveryService;
import com.englishflow.workflow.application.SagaCompensationExecutor;
import com.englishflow.workflow.application.SagaService;
import com.englishflow.workflow.domain.SagaStore;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * Wires the workflow service.
 *
 * <p>None of these classes carries a stereotype, and the tests build them by hand, so the tests were green while the
 * application could not start at all: the controllers are annotated and needed beans nothing provided. This class is
 * the missing half. It is a configuration rather than annotations on the classes so that the tests keep constructing
 * them directly, which is how they were written.
 *
 * <p>{@code holder} identifies the instance taking a job lease or claiming an outbox row; two processes must not share
 * one, so it is the service name and the port rather than something constant.
 */
@Configuration(proxyBeanMethods = false)
public class WorkflowWiringConfiguration {

    private static final Logger log = LoggerFactory.getLogger(WorkflowWiringConfiguration.class);

    @Bean
    ManualRecoveryService.RecoveryStore recoveryStore(JdbcTemplate jdbc) {
        return new JdbcRecoveryStore(jdbc);
    }

    @Bean
    ManualRecoveryService manualRecoveryService(ManualRecoveryService.RecoveryStore store) {
        return new ManualRecoveryService(store);
    }

    @Bean
    SagaStore sagaStore(JdbcTemplate jdbc) {
        return new JdbcSagaStore(jdbc);
    }

    @Bean
    SagaCompensationExecutor sagaCompensationExecutor(SagaStore store) {
        return new SagaCompensationExecutor(store);
    }

    @Bean
    SagaService sagaService(SagaStore store, SagaCompensationExecutor executor) {
        return new SagaService(store, executor);
    }

    /**
     * Step execution stays receipt-recorded: saga steps are operator-driven and the
     * receipt is their audit trail. Only compensations (the path that used to
     * mis-record success) go through the refusing transport below.
     */
    @Bean
    SagaController.SagaCompensationExecutorAdapter sagaCompensationExecutorAdapter(JdbcTemplate jdbc) {
        return stepName -> {
            jdbc.update(WorkflowTables.sql("""
                    INSERT INTO workflow_service.workflow_receipt
                        (receipt_id, subject_type, subject_id, operation, outcome, detail_json, actor, occurred_at)
                    VALUES (UUID(), 'saga_step', ?, 'compensate', 'ATTEMPTED', NULL, 'workflow-service', UTC_TIMESTAMP(6))
                    """), stepName);
            log.warn("step {} recorded as a receipt; owner work stays operator-driven (see compensation transport)", stepName);
        };
    }

    /**
     * The compensation transport: the only path from a failed saga to its owners.
     *
     * <p>No owner transport exists yet, so every compensation is refused loudly:
     * the refusal is recorded as a receipt and the executor moves the saga to
     * COMPENSATION_FAILED (operator-visible) instead of mis-recording APPLIED.
     * Owner transports plug in here as M2-006 follow-up without touching the
     * executor: replace the throw with the owner call for the names this
     * service knows how to send.
     */
    @Bean
    CompensationTransport sagaCompensationTransport(JdbcTemplate jdbc) {
        return compensationName -> {
            jdbc.update(WorkflowTables.sql("""
                    INSERT INTO workflow_service.workflow_receipt
                        (receipt_id, subject_type, subject_id, operation, outcome, detail_json, actor, occurred_at)
                    VALUES (UUID(), 'saga_step', ?, 'compensate', 'REFUSED_NO_TRANSPORT', NULL, 'workflow-service', UTC_TIMESTAMP(6))
                    """), compensationName);
            throw new IllegalStateException(
                    "no compensation transport for '" + compensationName + "'");
        };
    }

    @Bean
    JdbcJobLeaseStore jobLeaseStore(JdbcTemplate jdbc, @Value("${workflow.holder:workflow-service}") String holder) {
        return new JdbcJobLeaseStore(jdbc, holder);
    }

    @Bean
    JdbcWorkflowOutbox workflowOutbox(JdbcTemplate jdbc, @Value("${workflow.holder:workflow-service}") String holder) {
        return new JdbcWorkflowOutbox(jdbc, holder);
    }
}
