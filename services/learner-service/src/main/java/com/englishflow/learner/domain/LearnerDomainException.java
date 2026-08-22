package com.englishflow.learner.domain;

import java.util.Objects;

/** Domain error with a stable code and an explicit retryability decision. */
public class LearnerDomainException extends RuntimeException {

    private final LearnerDecisionCode code;
    private final boolean retryable;

    public LearnerDomainException(LearnerDecisionCode code, String message) {
        this(code, message, false);
    }

    public LearnerDomainException(LearnerDecisionCode code, String message, boolean retryable) {
        super(Objects.requireNonNull(message, "message is required"));
        this.code = Objects.requireNonNull(code, "code is required");
        this.retryable = retryable;
    }

    public LearnerDecisionCode code() {
        return code;
    }

    public boolean retryable() {
        return retryable;
    }
}
