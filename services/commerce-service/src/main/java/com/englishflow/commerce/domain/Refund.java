package com.englishflow.commerce.domain;

import java.time.Instant;

public record Refund(String tenantId, String refundId, String orderId, String subjectId, PaymentProvider provider,
        long amountMinor, String currency, RefundStatus status, String reasonCode, Instant createdAt,
        Instant updatedAt, Instant completedAt) {
    public Refund {
        if (tenantId == null || tenantId.isBlank() || refundId == null || refundId.isBlank()
                || orderId == null || orderId.isBlank() || subjectId == null || subjectId.isBlank()
                || provider == null || amountMinor < 0 || currency == null || !currency.matches("[A-Z]{3}")
                || status == null || reasonCode == null || reasonCode.isBlank() || createdAt == null || updatedAt == null) {
            throw CommerceException.bad("REFUND_INVALID", "refund facts are incomplete");
        }
    }

    public Refund transition(RefundStatus next, Instant at) {
        CommerceStateMachine.requireRefundTransition(status, next);
        return new Refund(tenantId, refundId, orderId, subjectId, provider, amountMinor, currency, next, reasonCode, createdAt, at, next == RefundStatus.COMPLETED ? at : completedAt);
    }
}
