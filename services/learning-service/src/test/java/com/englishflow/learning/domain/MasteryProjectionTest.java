package com.englishflow.learning.domain;

import org.junit.jupiter.api.Test;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** MasteryProjection replayable apply(), idempotency and stage ladder. */
class MasteryProjectionTest {

    private static final Instant NOW = Instant.parse("2026-08-22T00:00:00Z");
    private static final LearningTenantScope SCOPE =
            LearningTenantScope.forPhaseOne("prn_learningtest0001", 7001);

    private static MasteryEvidence evidence(String id, boolean correct, int score,
            VerificationStage stage) {
        return new MasteryEvidence(id, SCOPE, LearningItemType.GRAMMAR, 71001, 8001, correct, score,
                "assessment.answer_scored", "assessment.rule.v1", stage, NOW);
    }

    @Test
    void emptyProjectionHasSaneDefaults() {
        MasteryProjection p = MasteryProjection.empty(SCOPE, LearningItemType.GRAMMAR, 71001, NOW);
        assertThat(p.stage()).isEqualTo(MasteryStage.NEW);
        assertThat(p.score()).isZero();
        assertThat(p.attemptCount()).isZero();
        assertThat(p.correctCount()).isZero();
        assertThat(p.version()).isZero();
        assertThat(p.verificationStage()).isEqualTo(VerificationStage.D0);
        assertThat(p.appliedEvidenceIds()).isEmpty();
    }

    @Test
    void firstCorrectEvidenceAdvancesToLearning() {
        MasteryProjection p = MasteryProjection.empty(SCOPE, LearningItemType.GRAMMAR, 71001, NOW)
                .apply(evidence("ev-00000000000001", true, 100, VerificationStage.D1)).projection();
        assertThat(p.attemptCount()).isEqualTo(1);
        assertThat(p.correctCount()).isEqualTo(1);
        assertThat(p.score()).isEqualTo(100);
        assertThat(p.stage()).isEqualTo(MasteryStage.LEARNING);
        assertThat(p.version()).isEqualTo(1);
        assertThat(p.appliedEvidenceIds()).containsExactly("ev-00000000000001");
    }

    @Test
    void threePerfectD7AttemptsReachConsolidated() {
        MasteryProjection p = MasteryProjection.empty(SCOPE, LearningItemType.GRAMMAR, 71001, NOW);
        p = p.apply(evidence("ev-00000000000001", true, 95, VerificationStage.D1)).projection();
        p = p.apply(evidence("ev-00000000000002", true, 95, VerificationStage.D7)).projection();
        assertThat(p.stage()).isEqualTo(MasteryStage.LEARNING); // attempts=2
        p = p.apply(evidence("ev-00000000000003", true, 100, VerificationStage.D7)).projection();
        assertThat(p.stage()).isEqualTo(MasteryStage.CONSOLIDATED);
        assertThat(p.version()).isEqualTo(3);
    }

    @Test
    void threePerfectD1AttemptsReachMastered() {
        MasteryProjection p = MasteryProjection.empty(SCOPE, LearningItemType.GRAMMAR, 71001, NOW);
        p = p.apply(evidence("ev-00000000000001", true, 90, VerificationStage.D1)).projection();
        p = p.apply(evidence("ev-00000000000002", true, 90, VerificationStage.D1)).projection();
        assertThat(p.stage()).isEqualTo(MasteryStage.LEARNING);
        p = p.apply(evidence("ev-00000000000003", true, 90, VerificationStage.D1)).projection();
        assertThat(p.stage()).isEqualTo(MasteryStage.MASTERED);
    }

    @Test
    void scoreIsWeightedRollingAverage() {
        MasteryProjection p = MasteryProjection.empty(SCOPE, LearningItemType.GRAMMAR, 71001, NOW);
        p = p.apply(evidence("ev-00000000000001", true, 50, VerificationStage.D1)).projection();
        p = p.apply(evidence("ev-00000000000002", true, 100, VerificationStage.D1)).projection();
        assertThat(p.score()).isEqualTo(75); // round((50*1 + 100)/2)
    }

    @Test
    void duplicateEvidenceIsReplayedAsNoOp() {
        MasteryProjection p = MasteryProjection.empty(SCOPE, LearningItemType.GRAMMAR, 71001, NOW);
        MasteryProjection.ApplyResult first = p.apply(evidence("ev-00000000000001", true, 100,
                VerificationStage.D1));
        assertThat(first.replayed()).isFalse();

        MasteryProjection.ApplyResult replay = first.projection()
                .apply(evidence("ev-00000000000001", true, 100, VerificationStage.D1));
        assertThat(replay.replayed()).isTrue();
        assertThat(replay.projection()).isSameAs(first.projection());
        assertThat(replay.projection().version()).isEqualTo(1);
        assertThat(replay.projection().attemptCount()).isEqualTo(1);
    }

    @Test
    void evidenceOutsideScopeIsRejected() {
        MasteryProjection p = MasteryProjection.empty(SCOPE, LearningItemType.GRAMMAR, 71001, NOW);
        MasteryEvidence other = new MasteryEvidence("ev-00000000000001",
                LearningTenantScope.forPhaseOne("prn_other0000000002", 7002), LearningItemType.GRAMMAR,
                71001, 8001, true, 100, "assessment.answer_scored", "assessment.rule.v1",
                VerificationStage.D1, NOW);
        assertThatThrownBy(() -> p.apply(other))
                .isInstanceOf(LearningDomainException.class)
                .satisfies(e -> assertThat(((LearningDomainException) e).code())
                        .isEqualTo(LearningDecisionCode.OWNER_MISMATCH));
    }

    @Test
    void evidenceForAnotherItemIsRejected() {
        MasteryProjection p = MasteryProjection.empty(SCOPE, LearningItemType.GRAMMAR, 71001, NOW);
        MasteryEvidence other = evidence("ev-00000000000001", true, 100, VerificationStage.D1);
        MasteryEvidence wrong = new MasteryEvidence(other.evidenceId(), other.scope(),
                LearningItemType.PHRASE, 71099, 8001, true, 100, "assessment.answer_scored",
                "assessment.rule.v1", VerificationStage.D1, NOW);
        assertThatThrownBy(() -> p.apply(wrong))
                .isInstanceOf(LearningDomainException.class)
                .satisfies(e -> assertThat(((LearningDomainException) e).code())
                        .isEqualTo(LearningDecisionCode.MASTERY_INVALID));
    }

    @Test
    void olderContentVersionIsRejected() {
        MasteryProjection p = new MasteryProjection(SCOPE, LearningItemType.GRAMMAR, 71001, 8002,
                MasteryStage.NEW, 0, 0, 0, 0, VerificationStage.D0, "assessment.rule.v1", NOW,
                java.util.Set.of());
        MasteryEvidence older = new MasteryEvidence("ev-00000000000001", SCOPE,
                LearningItemType.GRAMMAR, 71001, 8001, true, 100, "assessment.answer_scored",
                "assessment.rule.v1", VerificationStage.D1, NOW);
        assertThatThrownBy(() -> p.apply(older))
                .isInstanceOf(LearningDomainException.class)
                .satisfies(e -> assertThat(((LearningDomainException) e).code())
                        .isEqualTo(LearningDecisionCode.CONTENT_VERSION_MISMATCH));
    }

    @Test
    void constructorRejectsInvalidCounts() {
        assertThatThrownBy(() -> new MasteryProjection(SCOPE, LearningItemType.GRAMMAR, 71001, 8001,
                MasteryStage.NEW, 0, 1, 2, 0, VerificationStage.D0, "assessment.rule.v1", NOW,
                java.util.Set.of()))
                .isInstanceOf(IllegalArgumentException.class); // correct>attempt
        assertThatThrownBy(() -> new MasteryProjection(SCOPE, LearningItemType.GRAMMAR, 71001, 8001,
                MasteryStage.NEW, 101, 0, 0, 0, VerificationStage.D0, "assessment.rule.v1", NOW,
                java.util.Set.of()))
                .isInstanceOf(IllegalArgumentException.class); // score>100
        assertThatThrownBy(() -> new MasteryProjection(SCOPE, LearningItemType.GRAMMAR, 71001, 8001,
                MasteryStage.NEW, 0, 0, 0, 0, VerificationStage.D0, "", NOW, java.util.Set.of()))
                .isInstanceOf(IllegalArgumentException.class); // blank ruleVersion
    }

    @Test
    void constructorRejectsNullEvidence() {
        MasteryProjection p = MasteryProjection.empty(SCOPE, LearningItemType.GRAMMAR, 71001, NOW);
        assertThatThrownBy(() -> p.apply(null)).isInstanceOf(NullPointerException.class);
    }
}
