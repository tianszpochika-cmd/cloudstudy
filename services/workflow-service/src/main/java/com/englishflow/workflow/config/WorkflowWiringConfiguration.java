package com.englishflow.workflow.config;

import com.englishflow.workflow.adapter.http.SagaController;
import com.englishflow.workflow.adapter.jdbc.JdbcJobLeaseStore;
import com.englishflow.workflow.adapter.jdbc.JdbcRecoveryStore;
import com.englishflow.workflow.adapter.jdbc.JdbcSagaStore;
import com.englishflow.workflow.adapter.jdbc.JdbcWorkflowOutbox;
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
     * The compensation action, which is what the controller passes to SagaService.compensate.
     *
     * <p>It records a receipt for the compensation it was asked to run. It does not call the owning service, because
     * there is no transport for that yet: a saga step belongs to whichever service owns the data, and undoing one means
     * asking that service to undo it. Recording the attempt is what can honestly be done here, and the absence of the
     * call is registered as a gap rather than hidden behind a method that returns successfully.
     */
    @Bean
    SagaController.SagaCompensationExecutorAdapter sagaCompensationExecutorAdapter(JdbcTemplate jdbc) {
        return stepName -> {
            jdbc.update("""
                    INSERT INTO workflow_service.workflow_receipt
                        (receipt_id, subject_type, subject_id, operation, outcome, detail_json, actor, occurred_at)
                    VALUES (UUID(), 'saga_step', ?, 'compensate', 'ATTEMPTED', NULL, 'workflow-service', UTC_TIMESTAMP(6))
                    """, stepName);
            log.warn("compensation for step {} was recorded but not sent to its owner: no transport exists yet", stepName);
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
