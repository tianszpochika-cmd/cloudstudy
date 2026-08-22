package com.englishflow.learner.domain;

/** Raised when the service-side PEP denies an operation. */
public final class LearnerAuthorizationException extends LearnerDomainException {

    public LearnerAuthorizationException(LearnerDecisionCode code) {
        super(code, "learner operation denied: " + code.name());
    }
}
