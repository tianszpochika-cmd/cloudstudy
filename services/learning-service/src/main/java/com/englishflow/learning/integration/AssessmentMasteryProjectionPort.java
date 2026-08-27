package com.englishflow.learning.integration;

/** Learning is the only owner allowed to apply assessment evidence to mastery/SRS. */
public interface AssessmentMasteryProjectionPort {
    ProjectionResult apply(AssessmentMasteryProjection projection);

    record ProjectionResult(String projectionEventId, long projectionVersion, boolean replayed) {
        public ProjectionResult {
            if (projectionEventId == null || projectionEventId.isBlank()) throw new IllegalArgumentException("projectionEventId is required");
            if (projectionVersion < 1) throw new IllegalArgumentException("projectionVersion must be positive");
        }
    }
}
