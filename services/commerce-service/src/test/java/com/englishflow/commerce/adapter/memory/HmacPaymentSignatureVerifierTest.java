package com.englishflow.commerce.adapter.memory;

import com.englishflow.commerce.domain.PaymentProvider;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Fail-closed HMAC verification. The sandbox adapter must never trust an
 * unverified payload: any deviation from the exact signed bytes is rejected.
 */
class HmacPaymentSignatureVerifierTest {
    private final HmacPaymentSignatureVerifier verifier = new HmacPaymentSignatureVerifier("test-secret");
    private static final String PAYLOAD = "evt-1|ord-1|9900|CNY|SUCCESS";

    @Test
    void verifyReturnsTrueForCorrectSignature() {
        assertTrue(verifier.verify(PaymentProvider.SANDBOX, PAYLOAD, "sha256=" + sign(PAYLOAD)));
    }

    @Test
    void verifyFailsClosedForWrongSignature() {
        assertFalse(verifier.verify(PaymentProvider.SANDBOX, PAYLOAD, "sha256=" + sign("different-payload")));
    }

    @Test
    void verifyFailsClosedForMissingSignature() {
        assertFalse(verifier.verify(PaymentProvider.SANDBOX, PAYLOAD, null));
    }

    @Test
    void verifyFailsClosedForMissingPayload() {
        assertFalse(verifier.verify(PaymentProvider.SANDBOX, null, "sha256=" + sign(PAYLOAD)));
    }

    @Test
    void verifyFailsClosedForTamperedPayload() {
        String signature = "sha256=" + sign(PAYLOAD);
        // Attacker flips the settled amount while keeping the original signature.
        String tampered = "evt-1|ord-1|1|CNY|SUCCESS";
        assertFalse(verifier.verify(PaymentProvider.SANDBOX, tampered, signature));
    }

    @Test
    void verifyRejectsNonSandboxProviderEvenWithValidSignature() {
        // Untrusted production traffic must never be accepted by the sandbox verifier.
        assertFalse(verifier.verify(PaymentProvider.WECHAT, PAYLOAD, "sha256=" + sign(PAYLOAD)));
        assertFalse(verifier.verify(PaymentProvider.APPLE, PAYLOAD, "sha256=" + sign(PAYLOAD)));
    }

    @Test
    void verifyAcceptsSignatureWithoutSha256Prefix() {
        assertTrue(verifier.verify(PaymentProvider.SANDBOX, PAYLOAD, sign(PAYLOAD)));
    }

    @Test
    void verifyFailsClosedForGarbageHexSignature() {
        assertFalse(verifier.verify(PaymentProvider.SANDBOX, PAYLOAD, "sha256=zzzz"));
    }

    @Test
    void verifyFailsClosedForEmptySignature() {
        assertFalse(verifier.verify(PaymentProvider.SANDBOX, PAYLOAD, ""));
    }

    @Test
    void constructorRejectsBlankOrNullSecret() {
        assertThrows(IllegalArgumentException.class, () -> new HmacPaymentSignatureVerifier(""));
        assertThrows(IllegalArgumentException.class, () -> new HmacPaymentSignatureVerifier("   "));
        assertThrows(IllegalArgumentException.class, () -> new HmacPaymentSignatureVerifier(null));
    }

    @Test
    void payloadHashIsDeterministicAndSha256() {
        String hash1 = verifier.payloadHash("abc");
        String hash2 = verifier.payloadHash("abc");
        assertEquals(hash1, hash2);
        assertEquals(expectedSha256("abc"), hash1);
    }

    @Test
    void signForSmokeThenVerifyRoundTrips() {
        String signed = verifier.signForSmoke(PAYLOAD);
        assertTrue(signed.startsWith("sha256="));
        assertTrue(verifier.verify(PaymentProvider.SANDBOX, PAYLOAD, signed));
    }

    @Test
    void differentSecretsProduceDifferentSignatures() {
        var other = new HmacPaymentSignatureVerifier("other-secret");
        assertFalse(verifier.verify(PaymentProvider.SANDBOX, PAYLOAD, other.signForSmoke(PAYLOAD)));
        assertDoesNotThrow(() -> other.verify(PaymentProvider.SANDBOX, PAYLOAD, other.signForSmoke(PAYLOAD)));
    }

    private static String sign(String payload) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec("test-secret".getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            return HexFormat.of().formatHex(mac.doFinal(payload.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception exception) {
            throw new IllegalStateException(exception);
        }
    }

    private static String expectedSha256(String value) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception exception) {
            throw new IllegalStateException(exception);
        }
    }
}
