package com.englishflow.commerce.adapter.memory;

import com.englishflow.commerce.application.CommerceCommands.PaymentCallback;
import com.englishflow.commerce.application.CommerceCommands.RefundCallback;
import com.englishflow.commerce.application.PaymentPayloads;
import com.englishflow.commerce.application.ports.PaymentProviderPort;
import com.englishflow.commerce.domain.PaymentProvider;

/** Deterministic sandbox provider used only for logic tests and local development. */
public final class SandboxPaymentProvider implements PaymentProviderPort {
    private final HmacPaymentSignatureVerifier verifier;

    public SandboxPaymentProvider(HmacPaymentSignatureVerifier verifier) { this.verifier = verifier; }

    @Override public PaymentProvider provider() { return PaymentProvider.SANDBOX; }

    @Override public PaymentIntent startPayment(PaymentRequest request) {
        return new PaymentIntent("sandbox-payment:" + request.orderId(), "PENDING");
    }

    @Override public Verification verifyPaymentCallback(PaymentCallback callback) {
        if (!PaymentPayloads.payment(callback).equals(callback.payload())) return new Verification(false, verifier.payloadHash(callback.payload()), "PAYMENT_PAYLOAD_BINDING_INVALID");
        if (!verifier.verify(provider(), callback.payload(), callback.signature())) return new Verification(false, verifier.payloadHash(callback.payload()), "PAYMENT_SIGNATURE_INVALID");
        return new Verification(true, verifier.payloadHash(callback.payload()), "VERIFIED");
    }

    @Override public RefundIntent requestRefund(RefundRequest request) {
        return new RefundIntent("sandbox-refund:" + request.refundId(), "PROCESSING");
    }

    @Override public Verification verifyRefundCallback(RefundCallback callback) {
        if (!PaymentPayloads.refund(callback).equals(callback.payload())) return new Verification(false, verifier.payloadHash(callback.payload()), "REFUND_PAYLOAD_BINDING_INVALID");
        if (!verifier.verify(provider(), callback.payload(), callback.signature())) return new Verification(false, verifier.payloadHash(callback.payload()), "REFUND_SIGNATURE_INVALID");
        return new Verification(true, verifier.payloadHash(callback.payload()), "VERIFIED");
    }

    public String sign(String payload) { return verifier.signForSmoke(payload); }
}
