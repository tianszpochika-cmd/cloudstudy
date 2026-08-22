package com.englishflow.commerce.application;

import com.englishflow.commerce.application.CommerceCommands.PaymentCallback;
import com.englishflow.commerce.application.CommerceCommands.RefundCallback;

/** Canonical signed fields prevent a valid signature over one order being rebound to another. */
public final class PaymentPayloads {
    private PaymentPayloads() { }

    public static String payment(PaymentCallback callback) {
        return join(callback.providerEventId(), callback.orderId(), callback.amountMinor(),
                callback.currency(), callback.resultCode());
    }

    public static String refund(RefundCallback callback) {
        return join(callback.providerEventId(), callback.refundId(), callback.amountMinor(),
                callback.currency(), callback.resultCode());
    }

    private static String join(String id, String aggregateId, long amount, String currency, String resultCode) {
        return safe(id) + "|" + safe(aggregateId) + "|" + amount + "|" + safe(currency) + "|" + safe(resultCode);
    }

    private static String safe(String value) {
        return value == null ? "" : value.replace("|", "%7C");
    }
}
