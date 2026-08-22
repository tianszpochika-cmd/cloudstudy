package com.englishflow.learner.domain;

import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

/** Immutable PEP result; a deny always has a stable reason and replay/audit identifier. */
public record AuthorizationDecision(
        boolean allowed,
        LearnerDecisionCode code,
        String decisionId,
        Instant evaluatedAt) {

    public AuthorizationDecision {
        Objects.requireNonNull(code, "code is required");
        Objects.requireNonNull(decisionId, "decisionId is required");
        Objects.requireNonNull(evaluatedAt, "evaluatedAt is required");
        if (allowed && code != LearnerDecisionCode.ALLOWED) {
            throw new IllegalArgumentException("an allow decision must use ALLOWED");
        }
        if (!allowed && code == LearnerDecisionCode.ALLOWED) {
            throw new IllegalArgumentException("a deny decision needs a deny code");
        }
    }

    public static AuthorizationDecision allow(Instant evaluatedAt) {
        return new AuthorizationDecision(true, LearnerDecisionCode.ALLOWED,
                UUID.randomUUID().toString(), evaluatedAt);
    }

    public static AuthorizationDecision deny(LearnerDecisionCode code, Instant evaluatedAt) {
        if (code == null || code == LearnerDecisionCode.ALLOWED) {
            throw new IllegalArgumentException("a deny decision needs a deny code");
        }
        return new AuthorizationDecision(false, code, UUID.randomUUID().toString(), evaluatedAt);
    }

    public void requireAllowed() {
        if (!allowed) {
            throw new LearnerAuthorizationException(code);
        }
    }
}
