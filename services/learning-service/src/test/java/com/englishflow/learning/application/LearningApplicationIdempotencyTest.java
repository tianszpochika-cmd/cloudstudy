package com.englishflow.learning.application;

import com.englishflow.learning.adapter.memory.InMemoryLearningFactStore;
import com.englishflow.learning.adapter.memory.InMemoryLearningIdGenerator;
import com.englishflow.learning.domain.IdempotencyKey;
import com.englishflow.learning.domain.LearningAccessPolicy;
import com.englishflow.learning.domain.LearningDecisionCode;
import com.englishflow.learning.domain.LearningDomainException;
import com.englishflow.learning.domain.LearningItemType;
import com.englishflow.learning.domain.LearningPlan;
import com.englishflow.learning.domain.LearningPlanStatus;
import com.englishflow.learning.domain.LearningPrincipalContext;
import com.englishflow.learning.domain.LearningRequestMetadata;
import com.englishflow.learning.domain.LearningTaskType;
import com.englishflow.learning.domain.LearningTenantScope;
import com.englishflow.learning.domain.MasteryProjection;
import com.englishflow.learning.domain.MasteryStage;
import com.englishflow.learning.domain.ReviewConfidence;
import com.englishflow.learning.domain.SrsStage;
import com.englishflow.learning.domain.VerificationStage;
import com.englishflow.learning.port.AssessmentLearningEvent;
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

/** Application boundary idempotency and state-machine enforcement on an in-memory store. */
class LearningApplicationIdempotencyTest {

    private static final Instant NOW = Instant.parse("2026-08-22T00:00:00Z");
    private static final Clock CLOCK = Clock.fixed(NOW, ZoneOffset.UTC);
    private static final String PRINCIPAL = "prn_learningtest0001";
    private static final LearningRequestMetadata REQUEST = LearningRequestMetadata.none();

    private static final class Fixture {
        final InMemoryLearningFactStore store = new InMemoryLearningFactStore();
        final LearningPrincipalContext context = LearningPrincipalContext.phaseOne(PRINCIPAL, 7001);
        final LearningPlanService plans;
        final LearningReviewService reviews;
        final LearningProgressService progress;
        final LearningMasteryService mastery;

        Fixture() {
            LearnerTargetPort targetPort = (principal, targetId) -> Optional.of(
                    new LearnerTargetPort.LearnerTargetSnapshot(principal.scope(), targetId,
                            "foundation", 30, "Asia/Shanghai", 8001, 1));
            PublishedContentPort contentPort = (principal, versionId) -> Optional.of(
                    new PublishedContentPort.PublishedContentSnapshot(versionId, 11, "b10-foundation",
                            Set.of("LEARNER"), List.of(
                                    new PublishedContentPort.LearningSeedItem(LearningItemType.VOCAB,
                                            70001, LearningTaskType.VOCABULARY_REVIEW,
                                            LocalDate.of(2026, 8, 22)),
                                    new PublishedContentPort.LearningSeedItem(LearningItemType.GRAMMAR,
                                            71001, LearningTaskType.GRAMMAR_PRACTICE,
                                            LocalDate.of(2026, 8, 22)))));
            LearningAccessPolicy policy = new LearningAccessPolicy(CLOCK);
            InMemoryLearningIdGenerator ids = new InMemoryLearningIdGenerator();
            plans = new LearningPlanService(store, targetPort, contentPort, ids, policy, CLOCK);
            reviews = new LearningReviewService(store, targetPort, contentPort, ids, policy, CLOCK);
            progress = new LearningProgressService(store, policy, CLOCK);
            mastery = new LearningMasteryService(store, policy, CLOCK);
        }
    }

    private static IdempotencyKey key(String value) {
        return new IdempotencyKey(value);
    }

    @Test
    void planWriteIsIdempotentAndPlanningKeyIsUnique() {
        Fixture f = new Fixture();
        LearningCommandResult<LearningPlan> first = f.plans.createPlan(f.context,
                new CreateLearningPlanCommand(9001, 8001, key("plan-20260822-01"), REQUEST));
        LearningCommandResult<LearningPlan> replay = f.plans.createPlan(f.context,
                new CreateLearningPlanCommand(9001, 8001, key("plan-20260822-01"), REQUEST));

        assertThat(first.replayed()).isFalse();
        assertThat(replay.replayed()).isTrue();
        assertThat(replay.value().planId()).isEqualTo(first.value().planId());
        assertThat(first.value().status()).isEqualTo(LearningPlanStatus.DRAFT);

        // A different idempotency key for the same learner/target/content returns the SAME plan.
        LearningCommandResult<LearningPlan> secondKey = f.plans.createPlan(f.context,
                new CreateLearningPlanCommand(9001, 8001, key("plan-20260822-02"), REQUEST));
        assertThat(secondKey.value().planId()).isEqualTo(first.value().planId());

        LearningCommandResult<LearningPlan> resumed = f.plans.resumePlan(f.context,
                new ResumeLearningPlanCommand(first.value().planId(), first.value().version(),
                        key("plan-resume-20260822"), REQUEST));
        assertThat(resumed.value().status()).isEqualTo(LearningPlanStatus.ACTIVE);
        assertThat(resumed.value().version()).isEqualTo(2);
    }

    @Test
    void reviewWriteIsIdempotentAndReachesMastered() {
        Fixture f = new Fixture();
        LearningCommandResult<LearningReviewService.ReviewApplication> first = f.reviews.submit(
                f.context, review(9001, 70001, 0, ReviewConfidence.CERTAIN, "2026-08-22T01:00:00Z",
                        "review-20260822-01"));
        LearningCommandResult<LearningReviewService.ReviewApplication> replay = f.reviews.submit(
                f.context, review(9001, 70001, 0, ReviewConfidence.CERTAIN, "2026-08-22T01:00:00Z",
                        "review-20260822-01"));

        assertThat(first.replayed()).isFalse();
        assertThat(replay.replayed()).isTrue();
        assertThat(replay.value().event().reviewEventId()).isEqualTo(first.value().event().reviewEventId());
        assertThat(first.value().after().stage()).isEqualTo(SrsStage.LEARNING);

        submit(f, 9001, 70001, 2, "2026-08-23T01:00:00Z", "review-20260823-02");
        submit(f, 9001, 70001, 3, "2026-08-26T01:00:00Z", "review-20260826-03");
        submit(f, 9001, 70001, 4, "2026-09-02T01:00:00Z", "review-20260902-04");
        LearningCommandResult<LearningReviewService.ReviewApplication> mastered = submit(f, 9001,
                70001, 5, "2026-09-17T01:00:00Z", "review-20260917-05");
        assertThat(mastered.value().after().stage()).isEqualTo(SrsStage.MASTERED);

        // Same idempotency key cannot represent a second, different review.
        assertThatThrownBy(() -> f.reviews.submit(f.context, new SubmitReviewCommand(9001,
                LearningItemType.VOCAB, 70001, 8001, 2, ReviewConfidence.CERTAIN,
                Instant.parse("2026-08-23T01:00:00Z"), 0, key("review-20260822-01"), REQUEST)))
                .isInstanceOf(LearningDomainException.class)
                .satisfies(e -> assertThat(((LearningDomainException) e).code())
                        .isEqualTo(LearningDecisionCode.IDEMPOTENCY_CONFLICT));
    }

    @Test
    void reviewEntersNextLearnerLocalDayQueue() {
        Fixture f = new Fixture();
        f.reviews.submit(f.context, review(9001, 70001, 0, ReviewConfidence.CERTAIN,
                "2026-08-22T01:00:00Z", "review-20260822-01"));
        LearningCommandResult<com.englishflow.learning.domain.ReviewQueueSnapshot> queue = f.plans
                .buildReviewQueue(f.context, new BuildReviewQueueCommand(9001,
                        LocalDate.of(2026, 8, 23), 20, key("queue-20260823-01"), REQUEST));
        assertThat(queue.value().items()).hasSize(1);
        assertThat(queue.value().items().get(0).itemId()).isEqualTo(70001);
    }

    @Test
    void assessmentMasteryIsIdempotentAndDoesNotDoubleCount() {
        Fixture f = new Fixture();
        AssessmentLearningEvent event = new AssessmentLearningEvent("assessment-event-0001",
                f.context.scope(), LearningItemType.GRAMMAR, 71001, 8001, true, 100,
                "assessment.answer_scored", "assessment.rule.v1", VerificationStage.D1, NOW);
        LearningCommandResult<MasteryProjection> first = f.mastery.applyAssessment(f.context,
                new ApplyAssessmentLearningCommand(event, key("assessment-20260822-01"), REQUEST));
        LearningCommandResult<MasteryProjection> replay = f.mastery.applyAssessment(f.context,
                new ApplyAssessmentLearningCommand(event, key("assessment-20260822-01"), REQUEST));

        assertThat(first.replayed()).isFalse();
        assertThat(replay.replayed()).isTrue();
        assertThat(first.value().version()).isEqualTo(1);
        assertThat(first.value().stage()).isEqualTo(MasteryStage.LEARNING);

        // A fresh command key carrying the SAME event must not double-count mastery.
        LearningCommandResult<MasteryProjection> newKey = f.mastery.applyAssessment(f.context,
                new ApplyAssessmentLearningCommand(event, key("assessment-20260822-02"), REQUEST));
        assertThat(newKey.replayed()).isFalse();
        assertThat(newKey.value().version()).isEqualTo(1);
    }

    @Test
    void progressWriteRejectsStaleVersionAndIsIdempotentOnSameKey() {
        Fixture f = new Fixture();
        LearningPlan plan = f.plans.createPlan(f.context,
                new CreateLearningPlanCommand(9001, 8001, key("plan-progress-01"), REQUEST)).value();
        long taskId = plan.tasks().get(0).taskId();

        LearningCommandResult<com.englishflow.learning.domain.LearningProgress> first =
                f.progress.record(f.context, new RecordProgressCommand(plan.planId(), taskId, 2, 1,
                        30, 0, key("progress-20260822-01"), REQUEST));
        assertThat(first.value().percent()).isEqualTo(50);

        // Same key replays.
        LearningCommandResult<com.englishflow.learning.domain.LearningProgress> replay =
                f.progress.record(f.context, new RecordProgressCommand(plan.planId(), taskId, 2, 1,
                        30, 0, key("progress-20260822-01"), REQUEST));
        assertThat(replay.replayed()).isTrue();

        // A different key with a stale expectedVersion triggers a version conflict.
        assertThatThrownBy(() -> f.progress.record(f.context, new RecordProgressCommand(
                plan.planId(), taskId, 2, 2, 10, 0, key("progress-stale-01"), REQUEST)))
                .isInstanceOf(LearningDomainException.class)
                .satisfies(e -> assertThat(((LearningDomainException) e).code())
                        .isEqualTo(LearningDecisionCode.VERSION_CONFLICT));
    }

    @Test
    void completingTaskOnDraftPlanIsRejected() {
        Fixture f = new Fixture();
        LearningPlan draft = f.plans.createPlan(f.context,
                new CreateLearningPlanCommand(9002, 8001, key("plan-draft-20260822"), REQUEST)).value();
        long taskId = draft.tasks().get(0).taskId();
        assertThatThrownBy(() -> f.plans.completeTask(f.context, new CompleteLearningTaskCommand(
                draft.planId(), taskId, draft.version(), key("task-before-resume"), REQUEST)))
                .isInstanceOf(LearningDomainException.class)
                .satisfies(e -> assertThat(((LearningDomainException) e).code())
                        .isEqualTo(LearningDecisionCode.INVALID_STATE_TRANSITION));
    }

    private static LearningCommandResult<LearningReviewService.ReviewApplication> submit(
            Fixture f, long targetId, long itemId, int expectedVersion, String instant,
            String keyValue) {
        return f.reviews.submit(f.context, review(targetId, itemId, expectedVersion,
                ReviewConfidence.CERTAIN, instant, keyValue));
    }

    private static SubmitReviewCommand review(long targetId, long itemId, int expectedVersion,
            ReviewConfidence confidence, String instant, String keyValue) {
        return new SubmitReviewCommand(targetId, LearningItemType.VOCAB, itemId, 8001, 3,
                confidence, Instant.parse(instant), expectedVersion, key(keyValue), REQUEST);
    }
}
