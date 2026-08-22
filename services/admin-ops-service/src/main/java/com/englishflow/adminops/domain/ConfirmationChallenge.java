package com.englishflow.adminops.domain;

import java.time.Instant;

/** Opaque server-issued second-confirmation challenge. The client cannot choose its decision. */
public record ConfirmationChallenge(
        String token,
        String decisionId,
        String action,
        String resourceRef,
        Instant expiresAt) {

    public ConfirmationChallenge {
        if (token == null || token.isBlank() || decisionId == null || decisionId.isBlank()
                || action == null || action.isBlank() || resourceRef == null || resourceRef.isBlank()
                || expiresAt == null) {
            throw AdminOpsException.invalid("ADMIN_CONFIRMATION_INVALID", "confirmation challenge is incomplete");
        }
    }
}
