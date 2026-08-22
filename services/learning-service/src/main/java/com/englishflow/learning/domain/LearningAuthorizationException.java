package com.englishflow.learning.domain;

/** Raised when a service-side policy decision is denied. */
public final class LearningAuthorizationException extends LearningDomainException {

    public LearningAuthorizationException(LearningDecisionCode code) {
        super(code, "learning operation is not authorized: " + code);
    }
}
