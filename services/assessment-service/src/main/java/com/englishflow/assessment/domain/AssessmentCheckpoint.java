package com.englishflow.assessment.domain;

import java.time.Instant;

/** Server-accepted recovery cursor; raw UI state is never returned as an answer fact. */
public record AssessmentCheckpoint(long sequence, Long currentExerciseId, String clientStateHash,
                                   long monotonicElapsedMs, Instant savedAt) {
    public AssessmentCheckpoint {
        if (sequence < 1 || monotonicElapsedMs < 0) throw AssessmentDomainException.invalid("ASM_CHECKPOINT_INVALID", "checkpoint values are invalid");
        if (clientStateHash == null || !clientStateHash.matches("[A-Fa-f0-9]{64,128}")) {
            throw AssessmentDomainException.invalid("ASM_CHECKPOINT_INVALID", "clientStateHash must be a digest");
        }
        if (currentExerciseId != null && currentExerciseId < 1) throw AssessmentDomainException.invalid("ASM_CHECKPOINT_INVALID", "current exercise is invalid");
        if (savedAt == null) throw AssessmentDomainException.invalid("ASM_CHECKPOINT_INVALID", "savedAt is required");
    }
}
