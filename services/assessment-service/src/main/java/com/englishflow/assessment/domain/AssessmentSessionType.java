package com.englishflow.assessment.domain;

public enum AssessmentSessionType {
    DAILY_STREAM,
    QUICK_PRACTICE,
    CHECKPOINT,
    MOCK_EXAM;

    public boolean examLike() { return this == MOCK_EXAM; }
}
