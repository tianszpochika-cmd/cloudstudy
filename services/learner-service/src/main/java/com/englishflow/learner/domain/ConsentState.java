package com.englishflow.learner.domain;

/** Consent fact supplied by IAM; unknown or withdrawn consent is never treated as allow. */
public enum ConsentState {
    UNKNOWN,
    GRANTED,
    WITHDRAWN
}
