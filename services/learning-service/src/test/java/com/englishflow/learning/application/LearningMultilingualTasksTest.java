package com.englishflow.learning.application;

import com.englishflow.learning.LearningTestPrincipals;
import com.englishflow.learning.adapter.memory.InMemoryLearningFactStore;
import com.englishflow.learning.adapter.memory.InMemoryLearningIdGenerator;
import com.englishflow.learning.domain.IdempotencyKey;
import com.englishflow.learning.domain.LearningAccessPolicy;
import com.englishflow.learning.domain.LearningItemType;
import com.englishflow.learning.domain.LearningPlan;
import com.englishflow.learning.domain.LearningPrincipalContext;
import com.englishflow.learning.domain.LearningRequestMetadata;
import com.englishflow.learning.domain.LearningTaskType;
import com.englishflow.learning.domain.ReviewConfidence;
import com.englishflow.learning.domain.SrsStage;
import com.englishflow.learning.port.LearnerTargetPort;
import com.englishflow.learning.port.PublishedContentPort;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * B4-06 multilingual tasks: new LISTENING_DICTATION/SPEAKING_SHADOW plan tasks
 * and sentence-level SRS eligibility for French sentence rows.
 */
class LearningMultilingualTasksTest {

    private static final Instant NOW = Instant.parse("2026-08-22T00:00:00Z");
    private static final Clock CLOCK = Clock.fixed(NOW, ZoneOffset.UTC);
    private static final String PRINCIPAL = "prn_learningtest0001";
    private static final LearningRequestMetadata REQUEST = LearningRequestMetadata.none();

    private static final class Fixture {
        final InMemoryLearningFactStore store = new InMemoryLearningFactStore();
        final LearningPrincipalContext context = LearningTestPrincipals.phaseOne(PRINCIPAL, 7001);
        final LearningPlanService plans;
        final LearningReviewService reviews;

        Fixture() {
            LearnerTargetPort targetPort = (principal, targetId) -> Optional.of(
                    new LearnerTargetPort.LearnerTargetSnapshot(principal.scope(), targetId,
                            "language_cert", 30, "Asia/Shanghai", 8001, 1));
            PublishedContentPort contentPort = (principal, versionId) -> Optional.of(
                    new PublishedContentPort.PublishedContentSnapshot(versionId, 11, "b10-french", Set.of("LEARNER"),
                            List.of(
                                    new PublishedContentPort.LearningSeedItem(LearningItemType.SENTENCE,
                                            72001, LearningTaskType.LISTENING_DICTATION,
                                            LocalDate.of(2026, 8, 22)),
                                    new PublishedContentPort.LearningSeedItem(LearningItemType.SENTENCE,
                                            72002, LearningTaskType.SPEAKING_SHADOW,
                                            LocalDate.of(2026, 8, 22))), 1L));
            LearningAccessPolicy policy = new LearningAccessPolicy(CLOCK);
            InMemoryLearningIdGenerator ids = new InMemoryLearningIdGenerator();
            plans = new LearningPlanService(store, targetPort, contentPort, ids, policy, CLOCK);
            reviews = new LearningReviewService(store, targetPort, contentPort, ids, policy, CLOCK);
        }
    }

    private static IdempotencyKey key(String value) {
        return new IdempotencyKey(value);
    }

    @Test
    void newInteractionTasksEnterThePlan() {
        Fixture f = new Fixture();
        LearningPlan plan = f.plans.createPlan(f.context,
                new CreateLearningPlanCommand(9001, 8001, key("plan-fr-20260822"), REQUEST)).value();

        assertThat(plan.tasks()).hasSize(2);
        assertThat(plan.tasks().stream().map(task -> task.taskType()).toList())
                .containsExactlyInAnyOrder(
                        LearningTaskType.LISTENING_DICTATION, LearningTaskType.SPEAKING_SHADOW);
    }

    @Test
    void frenchSentenceEntersSrs() {
        Fixture f = new Fixture();
        LearningCommandResult<LearningReviewService.ReviewApplication> applied = f.reviews.submit(
                f.context, new SubmitReviewCommand(9001, LearningItemType.SENTENCE, 72001, 8001, 3,
                        ReviewConfidence.CERTAIN, Instant.parse("2026-08-22T01:00:00Z"), 0,
                        key("review-sentence-01"), REQUEST));

        assertThat(applied.replayed()).isFalse();
        assertThat(applied.value().after().stage()).isEqualTo(SrsStage.LEARNING);
    }

    @Test
    void historicalEligibilityIsUnchanged() {
        assertThat(LearningItemType.VOCAB.srsEligible()).isTrue();
        assertThat(LearningItemType.PHRASE.srsEligible()).isTrue();
        assertThat(LearningItemType.EXPRESSION.srsEligible()).isTrue();
        assertThat(LearningItemType.GRAMMAR.srsEligible()).isFalse();
        assertThat(LearningItemType.READING.srsEligible()).isFalse();
    }

    @Test
    void ineligibleItemTypeStillCannotEnterSrs() {
        assertThatThrownBy(() -> new SubmitReviewCommand(9001, LearningItemType.GRAMMAR, 71001, 8001, 3,
                ReviewConfidence.CERTAIN, Instant.parse("2026-08-22T01:00:00Z"), 0,
                key("review-grammar-01"), REQUEST))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
