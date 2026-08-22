package com.englishflow.learning.domain;

public enum SrsStage {
    NEW,
    LEARNING,
    MASTERED,
    CONSOLIDATED;

    public static void assertTransition(SrsStage from, SrsStage to) {
        if (from == null || to == null) {
            throw new LearningDomainException(LearningDecisionCode.INVALID_STATE_TRANSITION,
                    "SRS stage is required");
        }
        if (from == to) {
            return;
        }
        boolean allowed = switch (from) {
            case NEW -> to == LEARNING;
            case LEARNING -> to == MASTERED;
            case MASTERED -> to == CONSOLIDATED || to == LEARNING;
            case CONSOLIDATED -> to == LEARNING;
        };
        if (!allowed) {
            throw new LearningDomainException(LearningDecisionCode.INVALID_STATE_TRANSITION,
                    "illegal SRS stage transition: " + from + " -> " + to);
        }
    }

    public static SrsStage from(int repetitions, int intervalDays, int quality) {
        if (quality < 2) {
            return LEARNING;
        }
        if (repetitions >= 6 && intervalDays >= 90) {
            return CONSOLIDATED;
        }
        if (repetitions >= 4 && intervalDays >= 30) {
            return MASTERED;
        }
        return LEARNING;
    }
}
