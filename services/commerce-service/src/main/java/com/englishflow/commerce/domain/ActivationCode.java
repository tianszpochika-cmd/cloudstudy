package com.englishflow.commerce.domain;

import java.time.Instant;

public record ActivationCode(String tenantId, String codeHash, String skuId, PriceSnapshot priceSnapshot,
        ActivationCodeStatus status, Instant expiresAt, String redeemedBy, Instant redeemedAt) {
    public ActivationCode {
        if (tenantId == null || tenantId.isBlank() || codeHash == null || !codeHash.matches("[a-fA-F0-9]{64}")
                || skuId == null || skuId.isBlank() || priceSnapshot == null || status == null || expiresAt == null) {
            throw CommerceException.bad("ACTIVATION_CODE_INVALID", "activation code facts are incomplete");
        }
    }

    public ActivationCode redeem(String subjectId, Instant at) {
        if (status != ActivationCodeStatus.AVAILABLE) throw CommerceException.conflict("ACTIVATION_CODE_UNAVAILABLE", "activation code is not available");
        if (!expiresAt.isAfter(at)) throw CommerceException.conflict("ACTIVATION_CODE_EXPIRED", "activation code has expired");
        if (subjectId == null || subjectId.isBlank() || at == null) throw CommerceException.bad("ACTIVATION_CODE_INVALID", "redeemer and time are required");
        return transition(ActivationCodeStatus.REDEEMED, subjectId, at);
    }

    public ActivationCode expire(Instant at) {
        if (at == null || expiresAt.isAfter(at)) {
            throw CommerceException.conflict("ACTIVATION_CODE_STATE_INVALID", "activation code cannot be expired");
        }
        CommerceStateMachine.requireActivationTransition(status, ActivationCodeStatus.EXPIRED);
        return new ActivationCode(tenantId, codeHash, skuId, priceSnapshot, ActivationCodeStatus.EXPIRED, expiresAt, redeemedBy, at);
    }

    public ActivationCode revoke(Instant at) {
        if (at == null) {
            throw CommerceException.conflict("ACTIVATION_CODE_STATE_INVALID", "activation code cannot be revoked");
        }
        CommerceStateMachine.requireActivationTransition(status, ActivationCodeStatus.REVOKED);
        return new ActivationCode(tenantId, codeHash, skuId, priceSnapshot, ActivationCodeStatus.REVOKED, expiresAt, redeemedBy, at);
    }

    private ActivationCode transition(ActivationCodeStatus next, String subjectId, Instant at) {
        CommerceStateMachine.requireActivationTransition(status, next);
        return new ActivationCode(tenantId, codeHash, skuId, priceSnapshot, next, expiresAt, subjectId, at);
    }
}
