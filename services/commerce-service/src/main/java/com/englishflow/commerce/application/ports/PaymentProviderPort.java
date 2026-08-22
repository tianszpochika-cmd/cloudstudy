package com.englishflow.commerce.application.ports;

import com.englishflow.commerce.application.CommerceCommands.PaymentCallback;
import com.englishflow.commerce.application.CommerceCommands.RefundCallback;
import com.englishflow.commerce.domain.PaymentProvider;

/** Provider adapter seam. No provider SDK or production credential belongs in the domain. */
public interface PaymentProviderPort {
    PaymentProvider provider();

    PaymentIntent startPayment(PaymentRequest request);

    Verification verifyPaymentCallback(PaymentCallback callback);

    RefundIntent requestRefund(RefundRequest request);

    Verification verifyRefundCallback(RefundCallback callback);

    record PaymentRequest(String orderId, long amountMinor, String currency, String idempotencyKey) { }
    record PaymentIntent(String providerReference, String state) { }
    record RefundRequest(String refundId, String orderId, long amountMinor, String currency, String idempotencyKey) { }
    record RefundIntent(String providerReference, String state) { }
    record Verification(boolean valid, String payloadHash, String reasonCode) { }
}
