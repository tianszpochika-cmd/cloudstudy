package com.englishflow.commerce.domain;

import java.time.Instant;

public record PaymentAttempt(String tenantId, String attemptId, String orderId, String subjectId,
        PaymentProvider provider, PaymentAttemptStatus status, long amountMinor, String currency,
        String providerReference, Instant createdAt, Instant updatedAt) {
    public PaymentAttempt {
        if (tenantId == null || tenantId.isBlank() || attemptId == null || attemptId.isBlank()
                || orderId == null || orderId.isBlank() || subjectId == null || subjectId.isBlank()
                || provider == null || status == null || amountMinor < 0 || currency == null
                || !currency.matches("[A-Z]{3}") || createdAt == null || updatedAt == null) {
            throw CommerceException.bad("PAYMENT_ATTEMPT_INVALID", "payment attempt facts are incomplete");
        }
    }

    public PaymentAttempt transition(PaymentAttemptStatus next, Instant at) {
        CommerceStateMachine.requirePaymentTransition(status, next);
        return new PaymentAttempt(tenantId, attemptId, orderId, subjectId, provider, next, amountMinor, currency, providerReference, createdAt, at);
    }
}
