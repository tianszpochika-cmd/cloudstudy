package com.englishflow.learner.domain;

/** Supported daily quota choices from the ONB design. */
public enum DailyStudyMinutes {
    FIVE(5),
    FIFTEEN(15),
    THIRTY(30),
    FORTY_FIVE(45);

    private final int minutes;

    DailyStudyMinutes(int minutes) {
        this.minutes = minutes;
    }

    public int minutes() {
        return minutes;
    }

    public static DailyStudyMinutes from(int minutes) {
        for (DailyStudyMinutes value : values()) {
            if (value.minutes == minutes) {
                return value;
            }
        }
        throw new LearnerDomainException(LearnerDecisionCode.INVALID_GOAL,
                "daily study minutes must be one of 5, 15, 30 or 45");
    }
}
