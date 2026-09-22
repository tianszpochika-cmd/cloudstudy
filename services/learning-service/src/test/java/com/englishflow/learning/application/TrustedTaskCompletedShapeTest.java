package com.englishflow.learning.application;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.time.LocalDate;

import org.junit.jupiter.api.Test;

import com.englishflow.learning.domain.LearningOutboxEvent;
import com.englishflow.learning.domain.LearningRequestMetadata;
import com.englishflow.learning.domain.LearningTask;
import com.englishflow.learning.domain.LearningTaskStatus;
import com.englishflow.learning.domain.LearningTaskType;
import com.englishflow.learning.domain.LearningTenantScope;

/**
 * M5-013 trusted payload: the relay forwards verbatim, so the factory must
 * already carry the canonical consumer identity (subjectRef/completionId) and
 * string-typed ids. Payloads carry pins and digests, never raw answers/audio.
 */
class TrustedTaskCompletedShapeTest {

    @Test
    void trustedPayloadCarriesConsumerIdentityAsStrings() {
        LearningTenantScope scope = LearningTenantScope.forPhaseOne("prn_t21_shape_probe_0001", 9001L);
        LearningTask task = new LearningTask(7001L, LearningTaskType.VOCABULARY_REVIEW, 71001L, 8001L,
                LocalDate.parse("2026-09-21"), LearningTaskStatus.COMPLETED, 100, 3, Instant.now());
        LearningOutboxEvent event = LearningEventFactory.trustedTaskCompleted(scope, task, 5L,
                "P1_TASK_COMPLETION_V1", LearningRequestMetadata.none(), Instant.now());

        assertThat(event.eventType()).isEqualTo("learning.task.completed.v2");
        assertThat(event.payload().get("subjectRef")).isEqualTo("prn_t21_shape_probe_0001");
        assertThat(event.payload().get("completionId")).isEqualTo("7001");
        assertThat(event.payload().get("taskId")).isEqualTo("7001");
        assertThat(event.payload().get("completionVersion")).isEqualTo("3");
        assertThat(event.payload().get("taskStatus")).isEqualTo("COMPLETED");
        assertThat(event.payload().get("completionFact")).isEqualTo("SERVER_SETTLED");
        assertThat(event.payload().get("completionRuleVersion")).isEqualTo("P1_TASK_COMPLETION_V1");
        assertThat(event.dedupeKey()).isEqualTo("trusted-task-completed-7001-v3");
    }
}
