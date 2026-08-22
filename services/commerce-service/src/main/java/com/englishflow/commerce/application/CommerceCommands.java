package com.englishflow.commerce.application;

import com.englishflow.commerce.domain.PaymentProvider;
import java.time.Instant;

/** Typed commands keep client-owned facts out of commerce writes. */
public final class CommerceCommands {
    private CommerceCommands() { }

    public record CreateOrder(String skuId) { }

    public record StartPayment(String orderId, PaymentProvider provider) { }

    public record PaymentCallback(String providerEventId, String orderId, PaymentProvider provider,
            long amountMinor, String currency, String payload, String signature, String resultCode) { }

    public record RequestRefund(String orderId, String reasonCode) { }

    public record RefundCallback(String providerEventId, String refundId, PaymentProvider provider,
            long amountMinor, String currency, String payload, String signature, String resultCode) { }

    public record IssueActivationCode(String skuId, Instant expiresAt) { }

    public record RedeemActivationCode(String code) { }
}
