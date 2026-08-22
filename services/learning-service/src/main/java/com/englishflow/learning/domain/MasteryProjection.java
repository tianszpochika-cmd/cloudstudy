package com.englishflow.learning.domain;

import java.time.Instant;
import java.util.LinkedHashSet;
import java.util.Objects;
import java.util.Set;

/** Replayable learner projection; duplicate assessment/event evidence is a no-op. */
public record MasteryProjection(
        LearningTenantScope scope,
        LearningItemType itemType,
        long itemId,
        long contentVersionId,
        MasteryStage stage,
        int score,
        int attemptCount,
        int correctCount,
        long version,
        VerificationStage verificationStage,
        String ruleVersion,
        Instant lastEvidenceAt,
        Set<String> appliedEvidenceIds) {

    private static final int MAX_REPLAY_KEYS = 256;

    public MasteryProjection {
        Objects.requireNonNull(scope, "scope is required");
        Objects.requireNonNull(itemType, "itemType is required");
        if (itemId < 1 || contentVersionId < 1 || score < 0 || score > 100 || attemptCount < 0 || correctCount < 0
                || correctCount > attemptCount || version < 0) {
            throw new IllegalArgumentException("mastery projection values are invalid");
        }
        Objects.requireNonNull(stage, "stage is required");
        Objects.requireNonNull(verificationStage, "verificationStage is required");
        if (ruleVersion == null || ruleVersion.isBlank() || ruleVersion.length() > 64) {
            throw new IllegalArgumentException("ruleVersion is required and bounded");
        }
        Objects.requireNonNull(lastEvidenceAt, "lastEvidenceAt is required");
        appliedEvidenceIds = appliedEvidenceIds == null
                ? Set.of()
                : Set.copyOf(new LinkedHashSet<>(appliedEvidenceIds));
        if (appliedEvidenceIds.size() > MAX_REPLAY_KEYS) {
            throw new IllegalArgumentException("replay key history is bounded");
        }
    }

    public static MasteryProjection empty(LearningTenantScope scope, LearningItemType itemType,
            long itemId, Instant now) {
            return new MasteryProjection(scope, itemType, itemId, 1, MasteryStage.NEW, 0,
                0, 0, 0, VerificationStage.D0, "mastery.rule.v1", now, Set.of());
    }

    public ApplyResult apply(MasteryEvidence evidence) {
        Objects.requireNonNull(evidence, "evidence is required");
        if (!scope.equals(evidence.scope())) {
            throw new LearningDomainException(LearningDecisionCode.OWNER_MISMATCH,
                    "evidence is outside the verified tenant/owner/user scope");
        }
        if (evidence.itemType() != itemType || evidence.itemId() != itemId) {
            throw new LearningDomainException(LearningDecisionCode.MASTERY_INVALID,
                    "evidence is for another mastery item");
        }
        if (evidence.contentVersionId() < contentVersionId) {
            throw new LearningDomainException(LearningDecisionCode.CONTENT_VERSION_MISMATCH,
                    "mastery evidence cannot move to an older content version");
        }
        if (appliedEvidenceIds.contains(evidence.evidenceId())) {
            return new ApplyResult(this, true);
        }
        int nextAttempts = attemptCount + 1;
        int nextCorrect = correctCount + (evidence.correct() ? 1 : 0);
        int nextScore = Math.max(0, Math.min(100,
                (int) Math.round((score * (double) attemptCount + evidence.evidenceScore()) / nextAttempts)));
        MasteryStage nextStage = MasteryStage.from(nextScore, nextAttempts,
                evidence.verificationStage());
        MasteryStage.assertTransition(stage, nextStage);
        LinkedHashSet<String> keys = new LinkedHashSet<>(appliedEvidenceIds);
        keys.add(evidence.evidenceId());
        while (keys.size() > MAX_REPLAY_KEYS) {
            keys.remove(keys.iterator().next());
        }
        MasteryProjection next = new MasteryProjection(
                scope, itemType, itemId, evidence.contentVersionId(), nextStage, nextScore, nextAttempts, nextCorrect,
                version + 1, evidence.verificationStage(), evidence.ruleVersion(), evidence.observedAt(), keys);
        return new ApplyResult(next, false);
    }

    public record ApplyResult(MasteryProjection projection, boolean replayed) {
    }
}
