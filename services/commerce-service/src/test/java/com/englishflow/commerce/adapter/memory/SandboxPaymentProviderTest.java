package com.englishflow.commerce.adapter.memory;

import com.englishflow.commerce.application.CommerceCommands.PaymentCallback;
import com.englishflow.commerce.application.CommerceCommands.RefundCallback;
import com.englishflow.commerce.application.PaymentPayloads;
import com.englishflow.commerce.application.ports.PaymentProviderPort;
import com.englishflow.commerce.domain.PaymentProvider;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** Behaviour of the deterministic sandbox payment provider. */
class SandboxPaymentProviderTest {
    private final HmacPaymentSignatureVerifier verifier = new HmacPaymentSignatureVerifier("sandbox-secret");
    private final SandboxPaymentProvider provider = new SandboxPaymentProvider(verifier);

    @Test
    void providerIsSandbox() {
        assertEquals(PaymentProvider.SANDBOX, provider.provider());
    }

    @Test
    void startPaymentReturnsPendingIntent() {
        PaymentProviderPort.PaymentIntent intent = provider.startPayment(
                new PaymentProviderPort.PaymentRequest("ord-1", 9900, "CNY", "key-1"));
        assertTrue(intent.providerReference().startsWith("sandbox-payment:"));
        assertEquals("PENDING", intent.state());
    }

    @Test
    void requestRefundReturnsProcessingIntent() {
        PaymentProviderPort.RefundIntent intent = provider.requestRefund(
                new PaymentProviderPort.RefundRequest("rfd-1", "ord-1", 9900, "CNY", "key-1"));
        assertTrue(intent.providerReference().startsWith("sandbox-refund:"));
        assertEquals("PROCESSING", intent.state());
    }

    @Test
    void verifyPaymentCallbackAcceptsValidSignature() {
        PaymentCallback cb = signedPayment("evt-1", "ord-1", 9900, "SUCCESS");
        PaymentProviderPort.Verification verification = provider.verifyPaymentCallback(cb);
        assertTrue(verification.valid());
        assertEquals("VERIFIED", verification.reasonCode());
    }

    @Test
    void verifyPaymentCallbackRejectsPayloadBindingMismatch() {
        PaymentCallback valid = signedPayment("evt-1", "ord-1", 9900, "SUCCESS");
        // Rebind the verified payload to a different order but keep the original signature.
        PaymentCallback rebound = new PaymentCallback(valid.providerEventId(), "ord-OTHER",
                valid.provider(), valid.amountMinor(), valid.currency(), valid.payload(), valid.signature(), valid.resultCode());
        PaymentProviderPort.Verification verification = provider.verifyPaymentCallback(rebound);
        assertFalse(verification.valid());
        assertEquals("PAYMENT_PAYLOAD_BINDING_INVALID", verification.reasonCode());
    }

    @Test
    void verifyPaymentCallbackRejectsBadSignature() {
        PaymentCallback cb = signedPayment("evt-1", "ord-1", 9900, "SUCCESS");
        PaymentCallback bad = new PaymentCallback(cb.providerEventId(), cb.orderId(), cb.provider(),
                cb.amountMinor(), cb.currency(), cb.payload(), "sha256=00", cb.resultCode());
        PaymentProviderPort.Verification verification = provider.verifyPaymentCallback(bad);
        assertFalse(verification.valid());
        assertEquals("PAYMENT_SIGNATURE_INVALID", verification.reasonCode());
    }

    @Test
    void verifyRefundCallbackAcceptsValidSignature() {
        RefundCallback cb = signedRefund("evt-1", "rfd-1", 9900, "SUCCESS");
        PaymentProviderPort.Verification verification = provider.verifyRefundCallback(cb);
        assertTrue(verification.valid());
        assertEquals("VERIFIED", verification.reasonCode());
    }

    @Test
    void verifyRefundCallbackRejectsBadSignature() {
        RefundCallback cb = signedRefund("evt-1", "rfd-1", 9900, "SUCCESS");
        RefundCallback bad = new RefundCallback(cb.providerEventId(), cb.refundId(), cb.provider(),
                cb.amountMinor(), cb.currency(), cb.payload(), "sha256=00", cb.resultCode());
        PaymentProviderPort.Verification verification = provider.verifyRefundCallback(bad);
        assertFalse(verification.valid());
        assertEquals("REFUND_SIGNATURE_INVALID", verification.reasonCode());
    }

    private PaymentCallback signedPayment(String eventId, String orderId, long amount, String resultCode) {
        PaymentCallback unsigned = new PaymentCallback(eventId, orderId, PaymentProvider.SANDBOX, amount, "CNY", "", "", resultCode);
        String payload = PaymentPayloads.payment(unsigned);
        return new PaymentCallback(eventId, orderId, PaymentProvider.SANDBOX, amount, "CNY", payload, provider.sign(payload), resultCode);
    }

    private RefundCallback signedRefund(String eventId, String refundId, long amount, String resultCode) {
        RefundCallback unsigned = new RefundCallback(eventId, refundId, PaymentProvider.SANDBOX, amount, "CNY", "", "", resultCode);
        String payload = PaymentPayloads.refund(unsigned);
        return new RefundCallback(eventId, refundId, PaymentProvider.SANDBOX, amount, "CNY", payload, provider.sign(payload), resultCode);
    }
}
