package com.englishflow.learning;

import com.englishflow.learning.adapter.memory.InMemoryLearningFactStore;
import com.englishflow.learning.adapter.memory.InMemoryLearningIdGenerator;
import com.englishflow.learning.application.ApplyAssessmentLearningCommand;
import com.englishflow.learning.application.BuildReviewQueueCommand;
import com.englishflow.learning.application.CompleteLearningTaskCommand;
import com.englishflow.learning.application.CreateLearningPlanCommand;
import com.englishflow.learning.application.LearningCommandResult;
import com.englishflow.learning.application.LearningMasteryService;
import com.englishflow.learning.application.LearningPlanService;
import com.englishflow.learning.application.LearningProgressService;
import com.englishflow.learning.application.LearningReviewService;
import com.englishflow.learning.application.RecordProgressCommand;
import com.englishflow.learning.application.ResumeLearningPlanCommand;
import com.englishflow.learning.application.SubmitReviewCommand;
import com.englishflow.learning.domain.AuthorizationDecision;
import com.englishflow.learning.domain.ClientAuthorityClaims;
import com.englishflow.learning.domain.ConsentState;
import com.englishflow.learning.domain.IdempotencyKey;
import com.englishflow.learning.domain.LearningAccessPolicy;
import com.englishflow.learning.domain.LearningDecisionCode;
import com.englishflow.learning.domain.LearningDomainException;
import com.englishflow.learning.domain.LearningItemType;
import com.englishflow.learning.domain.LearningPlan;
import com.englishflow.learning.domain.LearningPlanStatus;
import com.englishflow.learning.domain.LearningPrincipalContext;
import com.englishflow.learning.domain.LearningProgress;
import com.englishflow.learning.domain.LearningRequestMetadata;
import com.englishflow.learning.domain.LearningSchema;
import com.englishflow.learning.domain.LearningTask;
import com.englishflow.learning.domain.LearningTaskStatus;
import com.englishflow.learning.domain.LearningTaskType;
import com.englishflow.learning.domain.LearningTenantScope;
import com.englishflow.learning.domain.MasteryProjection;
import com.englishflow.learning.domain.MasteryStage;
import com.englishflow.learning.domain.ReviewConfidence;
import com.englishflow.learning.domain.SrsStage;
import com.englishflow.learning.domain.SrsState;
import com.englishflow.learning.domain.Sm2Scheduler;
import com.englishflow.learning.domain.VerificationStage;
import com.englishflow.learning.port.AssessmentLearningEvent;
import com.englishflow.learning.port.LearnerTargetPort;
import com.englishflow.learning.port.PublishedContentPort;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.Set;

/**
 * Dependency-free B10-LRN-001 smoke test. It validates the domain/application slice only;
 * it deliberately makes no claim about Spring, MySQL, Kafka, Gateway or Java 25 runtime.
 */
public final class LearningDomainSmoke {

    private static final Instant NOW = Instant.parse("2026-08-22T00:00:00Z");
    private static final Clock CLOCK = Clock.fixed(NOW, ZoneOffset.UTC);
    private static final String PRINCIPAL = "prn_learning00000001";
    private static final LearningRequestMetadata REQUEST = new LearningRequestMetadata(
            "req-b10-learning-001", "0123456789abcdef0123456789abcdef");

    private LearningDomainSmoke() {
    }

    public static void main(String[] args) {
        testSchemaAndDefaultDeny();
        testDailyQuotaValidation();
        Fixture fixture = new Fixture();
        testPlanUniquenessAndTimezone(fixture);
        testSm2ReplayAndRules(fixture);
        testProgressAndIllegalTransitions(fixture);
        testAssessmentMasteryReplay(fixture);
        testDstCalendarArithmetic(fixture.context.scope());
        System.out.println("learning-service B10-LRN-001 smoke: PASS");
    }

    private static void testSchemaAndDefaultDeny() {
        assertTrue(LearningSchema.ownedFacts().contains("srs_state"),
                "SRS state is learning-owned");
        assertTrue(LearningSchema.ownedFacts().contains("mastery_projection"),
                "mastery projection is learning-owned");
        expectSchemaReject(() -> LearningSchema.requireOwnedFact("content_version"),
                "learning schema rejects content facts");

        LearningAccessPolicy policy = new LearningAccessPolicy(CLOCK);
        AuthorizationDecision missing = policy.authorize(null, "learning.plan.read",
                "learning-plan", "1000", "platform", PRINCIPAL);
        assertEquals(LearningDecisionCode.MISSING_PRINCIPAL, missing.code(),
                "missing principal is denied");

        LearningPrincipalContext clientOverride = new LearningPrincipalContext(
                LearningTenantScope.forPhaseOne(PRINCIPAL, 7001), "phase-1", Set.of("learner"),
                Set.of("learning.plan.read"), ConsentState.GRANTED, false,
                new ClientAuthorityClaims("other-tenant", null, null));
        AuthorizationDecision denied = policy.authorize(clientOverride, "learning.plan.read",
                "learning-plan", "1000", "platform", PRINCIPAL);
        assertEquals(LearningDecisionCode.CLIENT_AUTHORITY_REJECTED, denied.code(),
                "client tenant override is denied");

        AuthorizationDecision tenantMismatch = policy.authorize(
                LearningTestPrincipals.phaseOne(PRINCIPAL, 7001), "learning.plan.read",
                "learning-plan", "1000", "other-tenant", PRINCIPAL);
        assertEquals(LearningDecisionCode.TENANT_MISMATCH, tenantMismatch.code(),
                "cross-tenant access is denied");
    }

    private static void testDailyQuotaValidation() {
        expectIllegalArgument(() -> new LearnerTargetPort.LearnerTargetSnapshot(
                        LearningTenantScope.forPhaseOne(PRINCIPAL, 7001), 7001,
                        "foundation", 60, "Asia/Shanghai", 8001, 1),
                "learner target rejects the retired 60-minute quota");
        expectIllegalArgument(() -> LearningPlan.draft(
                        9001, LearningTenantScope.forPhaseOne(PRINCIPAL, 7001), 7001,
                        "foundation", 8001, 1, "Asia/Shanghai", 60, List.of(), NOW),
                "learning plan rejects the retired 60-minute quota");
    }

    private static void testPlanUniquenessAndTimezone(Fixture fixture) {
        CreateLearningPlanCommand create = new CreateLearningPlanCommand(
                9001, 8001, key("plan-b10-20260822-01"), REQUEST);
        LearningCommandResult<LearningPlan> first = fixture.plans.createPlan(fixture.context, create);
        LearningCommandResult<LearningPlan> replay = fixture.plans.createPlan(fixture.context, create);

        assertFalse(first.replayed(), "first plan write is new");
        assertTrue(replay.replayed(), "same idempotency key replays plan");
        assertEquals(first.value().planId(), replay.value().planId(), "plan id is stable on replay");
        assertEquals(LearningPlanStatus.DRAFT, first.value().status(), "new plan starts as draft");

        LearningCommandResult<LearningPlan> resumed = fixture.plans.resumePlan(fixture.context,
                new ResumeLearningPlanCommand(first.value().planId(), first.value().version(),
                        key("plan-b10-resume-20260822"), REQUEST));
        assertEquals(LearningPlanStatus.ACTIVE, resumed.value().status(), "plan resumes to active");
        assertEquals(2L, resumed.value().version(), "resume increments plan version");

        LearningCommandResult<LearningPlan> samePlanDifferentKey = fixture.plans.createPlan(fixture.context,
                new CreateLearningPlanCommand(9001, 8001, key("plan-b10-20260822-02"), REQUEST));
        assertEquals(first.value().planId(), samePlanDifferentKey.value().planId(),
                "planning key prevents a second plan");

        var queue = fixture.plans.buildReviewQueue(fixture.context,
                new BuildReviewQueueCommand(9001, LocalDate.of(2026, 8, 22), 20,
                        key("queue-b10-20260822"), REQUEST));
        assertEquals("Asia/Shanghai", queue.value().timeZoneId(),
                "queue preserves the validated learner timezone");
        assertTrue(queue.value().items().isEmpty(), "no SRS item exists before the first review");
    }

    private static void testSm2ReplayAndRules(Fixture fixture) {
        LearningCommandResult<LearningReviewService.ReviewApplication> first = fixture.reviews.submit(
                fixture.context, review(9001, 70001, 0, ReviewConfidence.CERTAIN,
                        "2026-08-22T01:00:00Z", "review-b10-20260822-01"));
        LearningCommandResult<LearningReviewService.ReviewApplication> replay = fixture.reviews.submit(
                fixture.context, review(9001, 70001, 0, ReviewConfidence.CERTAIN,
                        "2026-08-22T01:00:00Z", "review-b10-20260822-01"));

        assertFalse(first.replayed(), "first review is new");
        assertTrue(replay.replayed(), "same review idempotency key replays");
        assertEquals(first.value().event().reviewEventId(), replay.value().event().reviewEventId(),
                "replayed review keeps one review fact");
        assertEquals(SrsStage.LEARNING, first.value().after().stage(), "first SM-2 stage is learning");
        assertEquals(1, first.value().after().intervalDays(), "first SM-2 interval is one day");
        assertEquals(3, fixture.store.outboxEvents().size(),
                "queue plus review accepted and SRS state events are emitted once");
        try {
            fixture.reviews.submit(fixture.context, new SubmitReviewCommand(
                    9001, LearningItemType.VOCAB, 70001, 8001, 2, ReviewConfidence.CERTAIN,
                    Instant.parse("2026-08-22T01:00:00Z"), 0,
                    key("review-b10-20260822-01"), REQUEST));
            throw new AssertionError("one idempotency key cannot represent another review");
        } catch (LearningDomainException exception) {
            assertEquals(LearningDecisionCode.IDEMPOTENCY_CONFLICT, exception.code(),
                    "review idempotency conflict code");
        }
        var dueQueue = fixture.plans.buildReviewQueue(fixture.context,
                new BuildReviewQueueCommand(9001, LocalDate.of(2026, 8, 23), 20,
                        key("queue-b10-20260823"), REQUEST));
        assertEquals(1, dueQueue.value().items().size(),
                "the first review enters the next learner-local-day queue");
        assertEquals(9001L, dueQueue.value().items().get(0).targetId(),
                "SRS keeps the learner target boundary");
        assertEquals(70001L, dueQueue.value().items().get(0).itemId(),
                "SRS keeps the content item identity");

        reviewAt(fixture, "2026-08-23T01:00:00Z", 2, "review-b10-20260823-02");
        reviewAt(fixture, "2026-08-26T01:00:00Z", 3, "review-b10-20260826-03");
        reviewAt(fixture, "2026-09-02T01:00:00Z", 4, "review-b10-20260902-04");
        LearningCommandResult<LearningReviewService.ReviewApplication> mastered = reviewAt(
                fixture, "2026-09-17T01:00:00Z", 5, "review-b10-20260917-05");
        assertEquals(SrsStage.MASTERED, mastered.value().after().stage(),
                "SM-2 reaches mastered after the canonical interval ladder");

        LearningCommandResult<LearningReviewService.ReviewApplication> guessed = reviewAt(
                fixture, "2026-10-17T01:00:00Z", 6, "review-b10-20261017-06", ReviewConfidence.GUESSED);
        assertEquals(2, guessed.value().event().effectiveQuality(),
                "guessed confidence caps an otherwise perfect answer");
        assertEquals(SrsStage.LEARNING, guessed.value().after().stage(),
                "guessed review returns mastered item to learning");

        try {
            Sm2Scheduler.review(guessed.value().after(), 3, ReviewConfidence.CERTAIN,
                    Instant.parse("2026-10-16T01:00:00Z"));
            throw new AssertionError("out-of-order review must fail");
        } catch (LearningDomainException exception) {
            assertEquals(LearningDecisionCode.REVIEW_OUT_OF_ORDER, exception.code(),
                    "out-of-order review code");
        }
        try {
            Sm2Scheduler.review(guessed.value().after(), 4, ReviewConfidence.CERTAIN,
                    Instant.parse("2026-10-18T01:00:00Z"));
            throw new AssertionError("invalid quality must fail");
        } catch (LearningDomainException exception) {
            assertEquals(LearningDecisionCode.INVALID_REVIEW, exception.code(),
                    "invalid quality code");
        }
        try {
            SrsStage.assertTransition(SrsStage.NEW, SrsStage.MASTERED);
            throw new AssertionError("illegal SRS transition must fail");
        } catch (LearningDomainException exception) {
            assertEquals(LearningDecisionCode.INVALID_STATE_TRANSITION, exception.code(),
                    "illegal SRS transition code");
        }
    }

    private static void testProgressAndIllegalTransitions(Fixture fixture) {
        LearningPlan plan = fixture.plans.createPlan(fixture.context,
                new CreateLearningPlanCommand(9001, 8001, key("plan-b10-progress-01"), REQUEST)).value();
        long taskId = plan.tasks().stream().filter(task -> task.taskType() == LearningTaskType.VOCABULARY_REVIEW)
                .findFirst().orElseThrow().taskId();
        LearningCommandResult<LearningProgress> progress = fixture.progress.record(fixture.context,
                new RecordProgressCommand(plan.planId(), taskId, 2, 1, 30, 0,
                        key("progress-b10-20260822"), REQUEST));
        assertEquals(50, progress.value().percent(), "progress projection percent");

        try {
            fixture.progress.record(fixture.context,
                    new RecordProgressCommand(plan.planId(), taskId, 2, 2, 10, 0,
                            key("progress-b10-stale-01"), REQUEST));
            throw new AssertionError("stale progress version must fail");
        } catch (LearningDomainException exception) {
            assertEquals(LearningDecisionCode.VERSION_CONFLICT, exception.code(),
                    "progress optimistic version code");
        }

        LearningTask skipped = new LearningTask(9999, LearningTaskType.READING, 80001, 8001,
                LocalDate.of(2026, 8, 22), LearningTaskStatus.SKIPPED, 0, 0, NOW);
        try {
            skipped.complete(NOW);
            throw new AssertionError("skipped task cannot transition to completed");
        } catch (LearningDomainException exception) {
            assertEquals(LearningDecisionCode.INVALID_STATE_TRANSITION, exception.code(),
                    "illegal task transition code");
        }

        LearningPlan draftPlan = fixture.plans.createPlan(fixture.context,
                new CreateLearningPlanCommand(9002, 8001, key("plan-b10-draft-01"), REQUEST)).value();
        long draftTaskId = draftPlan.tasks().get(0).taskId();
        try {
            fixture.plans.completeTask(fixture.context,
                    new CompleteLearningTaskCommand(draftPlan.planId(), draftTaskId, draftPlan.version(),
                            key("task-b10-before-resume"), REQUEST));
            throw new AssertionError("draft plan task completion must fail");
        } catch (LearningDomainException exception) {
            assertEquals(LearningDecisionCode.INVALID_STATE_TRANSITION, exception.code(),
                    "draft plan transition code");
        }
    }

    private static void testAssessmentMasteryReplay(Fixture fixture) {
        AssessmentLearningEvent event = new AssessmentLearningEvent(
                "assessment-b10-0001", fixture.context.scope(), LearningItemType.GRAMMAR, 71001,
                8001, true, 100, "assessment.answer_scored", "assessment.rule.v1",
                VerificationStage.D1, NOW);
        ApplyAssessmentLearningCommand command = new ApplyAssessmentLearningCommand(
                event, key("assessment-b10-20260822"), REQUEST);
        LearningCommandResult<MasteryProjection> first = fixture.mastery.applyAssessment(
                fixture.context, command);
        LearningCommandResult<MasteryProjection> replay = fixture.mastery.applyAssessment(
                fixture.context, command);
        assertFalse(first.replayed(), "first assessment evidence is new");
        assertTrue(replay.replayed(), "same assessment idempotency key replays");
        assertEquals(1L, first.value().version(), "mastery projection advances once");
        assertEquals(MasteryStage.LEARNING, first.value().stage(), "first evidence is learning stage");

        LearningCommandResult<MasteryProjection> eventReplayWithNewKey = fixture.mastery.applyAssessment(
                fixture.context, new ApplyAssessmentLearningCommand(
                        event, key("assessment-b10-20260822-2"), REQUEST));
        assertFalse(eventReplayWithNewKey.replayed(), "new command key reaches projection replay guard");
        assertEquals(1L, eventReplayWithNewKey.value().version(),
                "same assessment event cannot double-count mastery");
    }

    private static void testDstCalendarArithmetic(LearningTenantScope scope) {
        Instant beforeDst = Instant.parse("2026-03-08T06:30:00Z");
        SrsState state = SrsState.newState(9901, scope, LearningItemType.VOCAB, 9001, 70099, 8001,
                "America/New_York", beforeDst);
        var result = Sm2Scheduler.review(state, 3, ReviewConfidence.CERTAIN, beforeDst);
        assertEquals(LocalDate.of(2026, 3, 9),
                result.dueAt().atZone(ZoneId.of("America/New_York")).toLocalDate(),
                "SRS uses the learner local calendar day across DST");
        assertEquals(Duration.ofHours(23), Duration.between(beforeDst, result.dueAt()),
                "DST spring-forward preserves local plus-one-day semantics");
    }

    private static LearningCommandResult<LearningReviewService.ReviewApplication> reviewAt(
            Fixture fixture, String instant, int expectedVersion, String key) {
        return reviewAt(fixture, instant, expectedVersion, key, ReviewConfidence.CERTAIN);
    }

    private static LearningCommandResult<LearningReviewService.ReviewApplication> reviewAt(
            Fixture fixture, String instant, int expectedVersion, String key,
            ReviewConfidence confidence) {
        return fixture.reviews.submit(fixture.context, review(9001, 70001, expectedVersion,
                confidence, instant, key));
    }

    private static SubmitReviewCommand review(long targetId, long itemId, int expectedVersion,
            ReviewConfidence confidence, String instant, String key) {
        return new SubmitReviewCommand(targetId, LearningItemType.VOCAB, itemId, 8001, 3,
                confidence, Instant.parse(instant), expectedVersion, key(key), REQUEST);
    }

    private static IdempotencyKey key(String value) {
        return new IdempotencyKey(value);
    }

    private static void expectSchemaReject(Runnable action, String message) {
        try {
            action.run();
            throw new AssertionError(message + " must fail");
        } catch (IllegalArgumentException expected) {
            // Schema boundary rejects foreign facts before an application decision exists.
        }
    }

    private static void expectIllegalArgument(Runnable action, String message) {
        try {
            action.run();
            throw new AssertionError(message + " must fail");
        } catch (IllegalArgumentException expected) {
            // Shared Phase 1 quota validation rejects values outside the frozen set.
        }
    }

    private static void assertTrue(boolean value, String message) {
        if (!value) {
            throw new AssertionError(message);
        }
    }

    private static void assertFalse(boolean value, String message) {
        assertTrue(!value, message);
    }

    private static void assertEquals(Object expected, Object actual, String message) {
        if (!java.util.Objects.equals(expected, actual)) {
            throw new AssertionError(message + ": expected " + expected + " but was " + actual);
        }
    }

    private static final class Fixture {
        private final InMemoryLearningFactStore store = new InMemoryLearningFactStore();
        private final LearningPrincipalContext context = LearningTestPrincipals.phaseOne(PRINCIPAL, 7001);
        private final LearningPlanService plans;
        private final LearningReviewService reviews;
        private final LearningProgressService progress;
        private final LearningMasteryService mastery;

        private Fixture() {
            LearnerTargetPort targetPort = (principal, targetId) -> Optional.of(
                    new LearnerTargetPort.LearnerTargetSnapshot(
                            principal.scope(), targetId, "foundation", 30, "Asia/Shanghai",
                            8001, 1));
            PublishedContentPort contentPort = (principal, versionId) -> Optional.of(
                    new PublishedContentPort.PublishedContentSnapshot(
                            versionId, 11, "b10-foundation", Set.of("LEARNER"), List.of(
                                    new PublishedContentPort.LearningSeedItem(
                                            LearningItemType.VOCAB, 70001, LearningTaskType.VOCABULARY_REVIEW,
                                            LocalDate.of(2026, 8, 22)),
                                    new PublishedContentPort.LearningSeedItem(
                                            LearningItemType.GRAMMAR, 71001, LearningTaskType.GRAMMAR_PRACTICE,
                                            LocalDate.of(2026, 8, 22)))));
            LearningAccessPolicy policy = new LearningAccessPolicy(CLOCK);
            InMemoryLearningIdGenerator ids = new InMemoryLearningIdGenerator();
            plans = new LearningPlanService(store, targetPort, contentPort, ids, policy, CLOCK);
            reviews = new LearningReviewService(store, targetPort, contentPort, ids, policy, CLOCK);
            progress = new LearningProgressService(store, policy, CLOCK);
            mastery = new LearningMasteryService(store, policy, CLOCK);
        }
    }
}
