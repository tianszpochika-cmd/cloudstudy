package com.englishflow.commerce.domain;

import java.time.Instant;
import java.util.List;

/** Adapter-neutral views; payment credentials and raw callback payloads never appear here. */
public final class CommerceViews {
    private CommerceViews() { }

    public record SkuView(String skuId, int version, String title, String entitlementCode,
            String currency, long amountMinor, SkuStatus status, Instant effectiveFrom) { }

    public record OrderView(String orderId, String skuId, int skuVersion, String subjectRef,
            String currency, long amountMinor, OrderStatus status, PaymentProvider provider,
            Instant createdAt, Instant updatedAt, Instant paidAt) { }

    public record PaymentStartView(String orderId, String attemptId, PaymentProvider provider,
            PaymentAttemptStatus status, boolean gateEnabled, boolean recoverable,
            String providerReference) { }

    public record PaymentCallbackView(String providerEventId, String orderId, String state,
            boolean replayed, OrderStatus orderStatus, String entitlementId) { }

    public record EntitlementView(String entitlementId, String skuId, String entitlementCode,
            String sourceType, EntitlementStatus status, String currency, long amountMinor,
            Instant activeFrom, Instant expiresAt, String reasonCode) { }

    public record ActivationCodeIssueView(String batchRef, String code, String codeRef,
            String skuId, Instant expiresAt) { }

    public record ActivationRedeemView(String codeRef, String entitlementId, String state,
            boolean replayed) { }

    public record RefundView(String refundId, String orderId, RefundStatus status,
            String currency, long amountMinor, String reasonCode, boolean recoverable) { }

    public record RefundCallbackView(String providerEventId, String refundId, String state,
            boolean replayed, RefundStatus refundStatus, OrderStatus orderStatus) { }

    public record ReconciliationView(String orderId, String state, long expectedAmountMinor,
            long paidAmountMinor, long refundedAmountMinor, String entitlementState,
            boolean repairRequired, Instant checkedAt) { }

    public record ReadinessView(boolean paymentEnabled, boolean realProvidersEnabled,
            String environment, List<PaymentProvider> enabledProviders, String reasonCode) { }
}
