package com.englishflow.assessment.domain;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Explainable rule-derived mistake fact owned by assessment; learning owns later SRS projection. */
public final class AssessmentMistake {
    public enum MistakeStatus { PENDING_RETRY, DELAY_VERIFY_D1, DELAY_VERIFY_D7, MASTERED, REOPENED }
    public enum MasteryStatus { NEW, LEARNING, MASTERED, CONSOLIDATED }

    private final long mistakeId;
    private final String tenantId;
    private final String ownerSubjectId;
    private final long itemId;
    private final long questionId;
    private final String errorCategory;
    private final String ruleVersion;
    private final String answerHash;
    private final List<Map<String, Object>> reasonTrace = new ArrayList<>();
    private int wrongCount;
    private MistakeStatus mistakeStatus = MistakeStatus.PENDING_RETRY;
    private MasteryStatus masteryStatus = MasteryStatus.LEARNING;
    private Instant firstErrorAt;
    private Instant lastErrorAt;
    private Instant nextActionAt;

    public AssessmentMistake(long mistakeId, AssessmentPrincipal owner, long itemId, long questionId,
                             String errorCategory, String ruleVersion, String answerHash, Instant occurredAt) {
        if (mistakeId < 1 || itemId < 1 || questionId < 1) throw AssessmentDomainException.invalid("ASM_MISTAKE_INVALID", "mistake identifiers are invalid");
        this.mistakeId = mistakeId;
        this.tenantId = owner.tenantId();
        this.ownerSubjectId = owner.subjectId();
        this.itemId = itemId;
        this.questionId = questionId;
        this.errorCategory = token(errorCategory, "errorCategory");
        this.ruleVersion = token(ruleVersion, "ruleVersion");
        this.answerHash = token(answerHash, "answerHash");
        this.firstErrorAt = occurredAt;
        this.lastErrorAt = occurredAt;
        this.nextActionAt = occurredAt;
        this.wrongCount = 1;
        reasonTrace.add(Map.of("ruleVersion", ruleVersion, "errorCategory", errorCategory, "occurredAt", occurredAt.toString()));
    }

    /** Rehydrates a mistake fact without changing its server-derived history. */
    public static AssessmentMistake restore(long mistakeId, AssessmentPrincipal owner, long itemId,
                                            long questionId, String errorCategory, String ruleVersion,
                                            String answerHash, int wrongCount, MistakeStatus mistakeStatus,
                                            MasteryStatus masteryStatus, Instant firstErrorAt, Instant lastErrorAt,
                                            Instant nextActionAt, List<Map<String, Object>> restoredReasonTrace) {
        if (wrongCount < 1 || firstErrorAt == null || lastErrorAt == null || nextActionAt == null
                || mistakeStatus == null || masteryStatus == null) {
            throw AssessmentDomainException.invalid("ASM_PERSISTENCE_CORRUPT", "persisted mistake state is invalid");
        }
        AssessmentMistake mistake = new AssessmentMistake(mistakeId, owner, itemId, questionId, errorCategory,
                ruleVersion, answerHash, firstErrorAt);
        mistake.wrongCount = wrongCount;
        mistake.mistakeStatus = mistakeStatus;
        mistake.masteryStatus = masteryStatus;
        mistake.lastErrorAt = lastErrorAt;
        mistake.nextActionAt = nextActionAt;
        mistake.reasonTrace.clear();
        if (restoredReasonTrace != null) {
            for (Map<String, Object> trace : restoredReasonTrace) {
                mistake.reasonTrace.add(Map.copyOf(SafePayloads.copyMap(trace)));
            }
        }
        return mistake;
    }

    public boolean hasSourceAttempt(String sourceAttemptId) {
        if (sourceAttemptId == null || sourceAttemptId.isBlank()) return false;
        for (Map<String, Object> trace : reasonTrace) {
            Object value = trace.get("sourceAttemptId");
            if (value != null && sourceAttemptId.equals(String.valueOf(value))) return true;
        }
        return false;
    }

    /** Records which attempt created or repeated this mistake. A second pass of the same attempt is a no-op. */
    public void tagSourceAttempt(String sourceAttemptId) {
        if (sourceAttemptId == null || sourceAttemptId.isBlank() || hasSourceAttempt(sourceAttemptId)) return;
        if (!reasonTrace.isEmpty()) {
            Map<String, Object> updated = new LinkedHashMap<>(reasonTrace.get(reasonTrace.size() - 1));
            if (!updated.containsKey("sourceAttemptId")) {
                updated.put("sourceAttemptId", sourceAttemptId);
                reasonTrace.set(reasonTrace.size() - 1, Map.copyOf(updated));
                return;
            }
        }
        reasonTrace.add(Map.of(
                "ruleVersion", ruleVersion,
                "errorCategory", errorCategory,
                "sourceAttemptId", sourceAttemptId,
                "occurredAt", lastErrorAt.toString()));
    }

    public void mergeWrong(Instant occurredAt, String additionalCategory) {
        wrongCount++;
        lastErrorAt = occurredAt;
        nextActionAt = occurredAt;
        if (mistakeStatus == MistakeStatus.MASTERED) mistakeStatus = MistakeStatus.REOPENED;
        mistakeStatus = MistakeStatus.PENDING_RETRY;
        masteryStatus = MasteryStatus.LEARNING;
        reasonTrace.add(Map.of("ruleVersion", ruleVersion, "errorCategory", additionalCategory, "occurredAt", occurredAt.toString()));
    }

    public void markD0Corrected(Instant correctedAt) {
        if (mistakeStatus != MistakeStatus.PENDING_RETRY && mistakeStatus != MistakeStatus.REOPENED) {
            throw AssessmentDomainException.conflict("ASM_MISTAKE_STATE_CONFLICT", "D0 correction is not due");
        }
        mistakeStatus = MistakeStatus.DELAY_VERIFY_D1;
        nextActionAt = correctedAt.plusSeconds(24 * 60 * 60);
    }

    public void markD1Passed(Instant verifiedAt) {
        if (mistakeStatus != MistakeStatus.DELAY_VERIFY_D1) throw AssessmentDomainException.conflict("ASM_MISTAKE_STATE_CONFLICT", "D1 is not pending");
        mistakeStatus = MistakeStatus.DELAY_VERIFY_D7;
        nextActionAt = verifiedAt.plusSeconds(7 * 24 * 60 * 60);
    }

    public void markD7Passed(Instant verifiedAt) {
        if (mistakeStatus != MistakeStatus.DELAY_VERIFY_D7) throw AssessmentDomainException.conflict("ASM_MISTAKE_STATE_CONFLICT", "D7 is not pending");
        mistakeStatus = MistakeStatus.MASTERED;
        masteryStatus = MasteryStatus.MASTERED;
        nextActionAt = verifiedAt;
    }

    /**
     * M5-009 variant repair: a fresh surface form of the same error category and rule
     * version is issued for re-verification. The variant is linked in the reason trace
     * (no new fact table); the mistake returns to PENDING_RETRY so D0/D1/D7 run again
     * against the variant. A mastered mistake reopens first, preserving the invariant
     * that MASTERED is never silently extended.
     */
    public void registerVariant(long variantItemId, Instant issuedAt) {
        if (variantItemId < 1 || variantItemId == itemId) throw AssessmentDomainException.invalid("ASM_VARIANT_INVALID", "variant item must differ from the original");
        if (mistakeStatus == MistakeStatus.MASTERED) mistakeStatus = MistakeStatus.REOPENED;
        mistakeStatus = MistakeStatus.PENDING_RETRY;
        masteryStatus = MasteryStatus.LEARNING;
        lastErrorAt = issuedAt;
        nextActionAt = issuedAt;
        reasonTrace.add(Map.of("ruleVersion", ruleVersion, "errorCategory", errorCategory,
                "variantItemId", variantItemId, "variantOf", mistakeId, "occurredAt", issuedAt.toString()));
    }

    public long mistakeId() { return mistakeId; }
    public String tenantId() { return tenantId; }
    public String ownerSubjectId() { return ownerSubjectId; }
    public long itemId() { return itemId; }
    public long questionId() { return questionId; }
    public String errorCategory() { return errorCategory; }
    public String ruleVersion() { return ruleVersion; }
    public String answerHash() { return answerHash; }
    public int wrongCount() { return wrongCount; }
    public MistakeStatus mistakeStatus() { return mistakeStatus; }
    public MasteryStatus masteryStatus() { return masteryStatus; }
    public Instant firstErrorAt() { return firstErrorAt; }
    public Instant lastErrorAt() { return lastErrorAt; }
    public Instant nextActionAt() { return nextActionAt; }
    public List<Map<String, Object>> reasonTrace() { return List.copyOf(reasonTrace); }

    public Map<String, Object> learnerView() {
        return Map.of(
                "mistakeId", mistakeId,
                "itemId", itemId,
                "questionId", questionId,
                "mistakeStatus", mistakeStatus.name(),
                "masteryStatus", masteryStatus.name(),
                "errorCategory", errorCategory,
                "wrongCount", wrongCount,
                "nextActionAt", nextActionAt.toString(),
                "reasonTrace", reasonTrace);
    }

    private static String token(String value, String field) {
        if (value == null || value.isBlank() || value.length() > 128) throw AssessmentDomainException.invalid("ASM_MISTAKE_INVALID", field + " is invalid");
        return value;
    }
}
