package com.englishflow.commerce.domain;

import java.time.Instant;

public record Entitlement(String tenantId, String entitlementId, String subjectId, String skuId,
        String entitlementCode, String sourceType, String sourceRef, PriceSnapshot priceSnapshot,
        EntitlementStatus status, Instant activeFrom, Instant expiresAt, String reasonCode) {
    public Entitlement {
        if (tenantId == null || tenantId.isBlank() || entitlementId == null || entitlementId.isBlank()
                || subjectId == null || subjectId.isBlank() || skuId == null || skuId.isBlank()
                || entitlementCode == null || entitlementCode.isBlank() || sourceType == null || sourceType.isBlank()
                || sourceRef == null || sourceRef.isBlank() || priceSnapshot == null || status == null || activeFrom == null) {
            throw CommerceException.bad("ENTITLEMENT_INVALID", "entitlement fields are incomplete");
        }
        reasonCode = reasonCode == null ? "" : reasonCode;
    }
    public Entitlement transition(EntitlementStatus next, String reason, Instant at) {
        CommerceStateMachine.requireEntitlementTransition(status, next);
        return new Entitlement(tenantId, entitlementId, subjectId, skuId, entitlementCode, sourceType, sourceRef, priceSnapshot, next, activeFrom, expiresAt, reason);
    }
}
