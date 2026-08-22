package com.englishflow.learning.domain;

import java.util.Objects;

/** Domain failure that is safe to map to an API error envelope by a future adapter. */
public class LearningDomainException extends RuntimeException {

    private final LearningDecisionCode code;

    public LearningDomainException(LearningDecisionCode code, String message) {
        super(message);
        this.code = Objects.requireNonNull(code, "code is required");
    }

    public LearningDecisionCode code() {
        return code;
    }
}
