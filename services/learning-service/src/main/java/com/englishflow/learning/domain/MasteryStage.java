package com.englishflow.learning.domain;

public enum MasteryStage {
    NEW,
    LEARNING,
    MASTERED,
    CONSOLIDATED;

    public static void assertTransition(MasteryStage from, MasteryStage to) {
        if (from == null || to == null) {
            throw new LearningDomainException(LearningDecisionCode.MASTERY_INVALID,
                    "mastery stage is required");
        }
        if (from == to) {
            return;
        }
        boolean allowed = switch (from) {
            case NEW -> to == LEARNING;
            case LEARNING -> to == MASTERED || to == CONSOLIDATED;
            case MASTERED -> to == CONSOLIDATED || to == LEARNING;
            case CONSOLIDATED -> to == LEARNING;
        };
        if (!allowed) {
            throw new LearningDomainException(LearningDecisionCode.INVALID_STATE_TRANSITION,
                    "illegal mastery transition: " + from + " -> " + to);
        }
    }

    public static MasteryStage from(int score, int attempts, VerificationStage verificationStage) {
        if (attempts == 0) {
            return NEW;
        }
        if (attempts >= 3 && score >= 95 && verificationStage == VerificationStage.D7) {
            return CONSOLIDATED;
        }
        if (score >= 85 && attempts >= 3) {
            return MASTERED;
        }
        return LEARNING;
    }
}
