package com.englishflow.commerce.adapter.memory;

import com.englishflow.commerce.application.ports.PaymentSignatureVerifier;
import com.englishflow.commerce.domain.PaymentProvider;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

/** Sandbox-only HMAC adapter. Real providers must replace this with their certified SDK/JWS verifier. */
public final class HmacPaymentSignatureVerifier implements PaymentSignatureVerifier {
    private final byte[] secret;

    public HmacPaymentSignatureVerifier(String secret) {
        if (secret == null || secret.isBlank()) throw new IllegalArgumentException("sandbox secret is required");
        this.secret = secret.getBytes(StandardCharsets.UTF_8);
    }

    @Override public boolean verify(PaymentProvider provider, String payload, String signature) {
        if (provider != PaymentProvider.SANDBOX || payload == null || signature == null) return false;
        String normalized = signature.startsWith("sha256=") ? signature.substring("sha256=".length()) : signature;
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret, "HmacSHA256"));
            byte[] expected = mac.doFinal(payload.getBytes(StandardCharsets.UTF_8));
            byte[] provided = HexFormat.of().parseHex(normalized);
            return MessageDigest.isEqual(expected, provided);
        } catch (Exception ignored) {
            return false;
        }
    }

    @Override public String payloadHash(String payload) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(payload.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException(exception);
        }
    }

    public String signForSmoke(String payload) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret, "HmacSHA256"));
            return "sha256=" + HexFormat.of().formatHex(mac.doFinal(payload.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception exception) {
            throw new IllegalStateException(exception);
        }
    }
}
