package com.englishflow.assessment.adapter.memory;

import com.englishflow.assessment.domain.AssessmentAttempt;
import com.englishflow.assessment.domain.AssessmentCheckpoint;
import com.englishflow.assessment.domain.AssessmentMistake;
import com.englishflow.assessment.domain.AssessmentReport;
import com.englishflow.assessment.domain.AssessmentSession;
import com.englishflow.assessment.port.AssessmentStatePort;

import java.util.Optional;

/**
 * Compatibility adapter for the dependency-free domain smoke only.
 * It is never registered by the Spring runtime configuration.
 */
public final class NoopAssessmentStatePort implements AssessmentStatePort {
    @Override
    public RestoredState load() {
        return RestoredState.empty();
    }

    @Override
    public void saveSession(AssessmentSession session) { }

    @Override
    public void saveAttempt(AssessmentSession session, AssessmentAttempt attempt) { }

    @Override
    public void saveCheckpoint(String sessionId, AssessmentCheckpoint checkpoint) { }

    @Override
    public void saveReport(AssessmentReport report) { }

    @Override
    public void saveMistake(AssessmentMistake mistake) { }

    @Override
    public Optional<IdempotencyRecord> findIdempotency(String tenantId, String subjectId,
                                                        String operation, String idempotencyKey) {
        return Optional.empty();
    }

    @Override
    public IdempotencyRecord saveIdempotency(IdempotencyRecord record) {
        return record;
    }
}
