package com.englishflow.learning.application;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import javax.sql.DataSource;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.transaction.support.TransactionTemplate;

import com.englishflow.learning.LearningTestPrincipals;
import com.englishflow.learning.adapter.jdbc.JdbcLearningFactStore;
import com.englishflow.learning.adapter.memory.InMemoryLearningIdGenerator;
import com.englishflow.learning.domain.IdempotencyKey;
import com.englishflow.learning.domain.LearningAccessPolicy;
import com.englishflow.learning.domain.LearningItemType;
import com.englishflow.learning.domain.LearningPlan;
import com.englishflow.learning.domain.LearningPrincipalContext;
import com.englishflow.learning.domain.LearningRequestMetadata;
import com.englishflow.learning.domain.LearningTaskType;
import com.englishflow.learning.port.LearnerTargetPort;
import com.englishflow.learning.port.PublishedContentPort;

import tools.jackson.databind.ObjectMapper;

/**
 * M5-013 trusted flow against real MySQL (opt-in): completing a task through
 * the application service appends the canonical v2 outbox row (subjectRef /
 * completionId / string ids) that the relay forwards verbatim.
 *
 * <p>Enable with {@code -Dlearning.relay.integration=true} plus
 * {@code LEARNING_RELAY_TEST_JDBC_URL/USER/PASSWORD} pointing at the real
 * {@code learning_service} schema. Plan/task rows are cleaned up; the v2
 * outbox row stays as relay evidence for the synthetic subject.
 */
@EnabledIfSystemProperty(named = "learning.relay.integration", matches = "true")
class TrustedCompletionFlowIntegrationTest {

    private static final Instant NOW = Instant.parse("2026-09-21T00:00:00Z");
    private static final Clock CLOCK = Clock.fixed(NOW, ZoneOffset.UTC);
    private static final String PRINCIPAL = "prn_t21_flow_probe_0001";
    private static final LearningRequestMetadata REQUEST = LearningRequestMetadata.none();

    @Test
    void completingATaskAppendsCanonicalV2OutboxRow() throws Exception {
        DataSource dataSource = new DriverManagerDataSource(required("LEARNING_RELAY_TEST_JDBC_URL"),
                required("LEARNING_RELAY_TEST_JDBC_USER"), required("LEARNING_RELAY_TEST_JDBC_PASSWORD"));
        JdbcTemplate jdbc = new JdbcTemplate(dataSource);
        TransactionTemplate transactions =
                new TransactionTemplate(new DataSourceTransactionManager(dataSource));
        JdbcLearningFactStore store = new JdbcLearningFactStore(jdbc, transactions, new ObjectMapper());

        LearnerTargetPort targetPort = (principal, targetId) -> Optional.of(
                new LearnerTargetPort.LearnerTargetSnapshot(principal.scope(), targetId,
                        "language_cert", 30, "Asia/Shanghai", 8001, 1));
        PublishedContentPort contentPort = (principal, versionId) -> Optional.of(
                new PublishedContentPort.PublishedContentSnapshot(versionId, 11, "t21-content", Set.of("LEARNER"),
                        List.of(new PublishedContentPort.LearningSeedItem(LearningItemType.SENTENCE,
                                72001, LearningTaskType.LISTENING_DICTATION,
                                LocalDate.of(2026, 9, 21)))));
        LearningPlanService plans = new LearningPlanService(store, targetPort, contentPort,
                new InMemoryLearningIdGenerator(), new LearningAccessPolicy(CLOCK), CLOCK);
        LearningPrincipalContext context = LearningTestPrincipals.phaseOne(PRINCIPAL, 7001);

        LearningPlan plan = plans.createPlan(context,
                new CreateLearningPlanCommand(9001, 8001, new IdempotencyKey("t21-plan-key-0001-long"), REQUEST)).value();
        LearningPlan active = plans.resumePlan(context, new ResumeLearningPlanCommand(plan.planId(),
                plan.version(), new IdempotencyKey("t21-resume-key-0001-long"), REQUEST)).value();
        long taskId = active.tasks().get(0).taskId();
        plans.completeTask(context, new CompleteLearningTaskCommand(active.planId(), taskId,
                active.version(), new IdempotencyKey("t21-complete-key-0001-long"), REQUEST));

        List<String> rows = jdbc.query(
                "SELECT payload_json FROM learning_service.learning_runtime_outbox_event "
                        + "WHERE tenant_id = 'platform' AND principal_id = ? AND event_type = 'learning.task.completed.v2' "
                        + "ORDER BY created_at DESC LIMIT 5",
                (rs, rowNum) -> rs.getString("payload_json"), PRINCIPAL);
        assertThat(rows).isNotEmpty();
        tools.jackson.databind.JsonNode payload =
                new tools.jackson.databind.ObjectMapper().readTree(rows.get(0));
        assertThat(payload.path("subjectRef").asText()).isEqualTo(PRINCIPAL);
        assertThat(payload.path("completionId").asText()).isEqualTo(String.valueOf(taskId));
        assertThat(payload.path("taskId").asText()).isEqualTo(String.valueOf(taskId));
        assertThat(payload.path("completionVersion").asText()).isNotBlank();
        assertThat(payload.path("taskStatus").asText()).isEqualTo("COMPLETED");
        assertThat(payload.path("completionFact").asText()).isEqualTo("SERVER_SETTLED");
        assertThat(payload.path("completionRuleVersion").asText()).isEqualTo("P1_TASK_COMPLETION_V1");

        // Keep the outbox row as relay evidence; remove the plan/task working rows.
        jdbc.update("DELETE FROM learning_service.learning_runtime_task WHERE tenant_id = 'platform' "
                + "AND principal_id = ? AND learning_plan_id = ?", PRINCIPAL, plan.planId());
        jdbc.update("DELETE FROM learning_service.learning_runtime_plan WHERE tenant_id = 'platform' "
                + "AND principal_id = ? AND plan_id = ?", PRINCIPAL, plan.planId());
    }

    private static String required(String name) {
        // NOTE: pass these as environment variables (the local Maven launcher
        // mangles dotted -D keys, and these names are dot-free).
        String value = System.getenv(name);
        if (value == null || value.isBlank()) {
            throw new AssertionError(name + " env var is required");
        }
        return value;
    }
}
