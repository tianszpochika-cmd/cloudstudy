package com.englishflow.assessment.domain;

public enum AssessmentSessionStatus {
    CREATED,
    IN_PROGRESS,
    INTERRUPTED,
    SUBMITTING,
    COMPLETED,
    AUTO_SUBMITTED,
    CANCELLED,
    EXPIRED;

    public boolean terminal() {
        return this == COMPLETED || this == AUTO_SUBMITTED || this == CANCELLED || this == EXPIRED;
    }
}
