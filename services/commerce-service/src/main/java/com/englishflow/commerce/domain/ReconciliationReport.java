package com.englishflow.commerce.domain;

import java.time.Instant;

/** Immutable comparison fact; repair commands belong to the later ops boundary. */
public record ReconciliationReport(String tenantId, String orderId, ReconciliationStatus status,
        long expectedAmountMinor, long paidAmountMinor, long refundedAmountMinor,
        String entitlementStatus, boolean repairRequired, Instant checkedAt) {
    public ReconciliationReport {
        if (tenantId == null || tenantId.isBlank() || orderId == null || orderId.isBlank()
                || status == null || expectedAmountMinor < 0 || paidAmountMinor < 0 || refundedAmountMinor < 0
                || entitlementStatus == null || entitlementStatus.isBlank() || checkedAt == null) {
            throw CommerceException.bad("RECONCILIATION_INVALID", "reconciliation facts are incomplete");
        }
    }
}
