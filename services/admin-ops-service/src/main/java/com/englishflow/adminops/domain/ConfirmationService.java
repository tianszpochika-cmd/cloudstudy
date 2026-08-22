package com.englishflow.adminops.domain;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

/** Single-use confirmation ledger shared by admin commands and support transitions. */
public final class ConfirmationService {

    private final Clock clock;
    private final Duration ttl;
    private final Map<String, Receipt> receipts = new HashMap<>();

    public ConfirmationService(Clock clock, Duration ttl) {
        this.clock = clock;
        this.ttl = ttl;
    }

    public synchronized ConfirmationChallenge prepare(
            AdminPrincipal principal, String action, String resourceRef) {
        if (principal == null) {
            throw AdminOpsException.unauthenticated();
        }
        String token = "confirm_" + UUID.randomUUID();
        String decisionId = "decision_" + UUID.randomUUID();
        Instant expiresAt = clock.instant().plus(ttl);
        receipts.put(token, new Receipt(principal.tenantId(), principal.subjectId(), action, resourceRef, decisionId,
                expiresAt));
        return new ConfirmationChallenge(token, decisionId, action, resourceRef, expiresAt);
    }

    public synchronized String consume(
            AdminPrincipal principal, String token, String action, String resourceRef) {
        if (principal == null) {
            throw AdminOpsException.unauthenticated();
        }
        Receipt receipt = token == null ? null : receipts.get(token);
        if (receipt == null || receipt.used) {
            throw AdminOpsException.forbidden("ADMIN_CONFIRMATION_INVALID", "confirmation is missing or already used");
        }
        if (!receipt.tenantId.equals(principal.tenantId()) || !receipt.actorSubjectId.equals(principal.subjectId())
                || !receipt.action.equals(action) || !receipt.resourceRef.equals(resourceRef)) {
            throw AdminOpsException.forbidden("ADMIN_CONFIRMATION_SCOPE_MISMATCH", "confirmation does not match this action");
        }
        if (!clock.instant().isBefore(receipt.expiresAt)) {
            receipts.remove(token);
            throw AdminOpsException.forbidden("ADMIN_CONFIRMATION_EXPIRED", "confirmation has expired");
        }
        receipt.used = true;
        return receipt.decisionId;
    }

    private static final class Receipt {
        final String tenantId;
        final String actorSubjectId;
        final String action;
        final String resourceRef;
        final String decisionId;
        final Instant expiresAt;
        boolean used;

        Receipt(String tenantId, String actorSubjectId, String action, String resourceRef,
                String decisionId, Instant expiresAt) {
            this.tenantId = tenantId;
            this.actorSubjectId = actorSubjectId;
            this.action = action;
            this.resourceRef = resourceRef;
            this.decisionId = decisionId;
            this.expiresAt = expiresAt;
        }
    }
}
