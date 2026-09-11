package com.englishflow.iam.domain;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;

/** Hashes provider refresh credentials before they enter an IAM-owned session snapshot. */
public final class SecretDigests {

    private SecretDigests() {
    }

    public static String sha256Hex(String secret) {
        if (secret == null || secret.isBlank() || secret.length() > 8192
                || secret.chars().anyMatch(Character::isISOControl)) {
            throw new IllegalArgumentException("secret is invalid");
        }
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest(secret.getBytes(StandardCharsets.UTF_8));
            StringBuilder result = new StringBuilder(64);
            for (byte value : digest) {
                result.append(String.format("%02x", value));
            }
            return result.toString();
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is required by the JDK", exception);
        }
    }

    public static byte[] sha256Bytes(String value) {
        if (value == null || value.isBlank() || value.length() > 8192
                || value.chars().anyMatch(Character::isISOControl)) {
            throw new IllegalArgumentException("value is invalid");
        }
        try {
            return MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is required by the JDK", exception);
        }
    }

    /**
     * Keyed digest for non-reversible target correlation. Plain SHA-256 over guessable
     * identifiers (emails) is dictionary-attackable; a keyed HMAC is not.
     */
    public static String hmacSha256Hex(String key, String value) {
        if (key == null || key.isBlank() || key.length() > 8192
                || key.chars().anyMatch(Character::isISOControl)) {
            throw new IllegalArgumentException("hmac key is invalid");
        }
        if (value == null || value.isBlank() || value.length() > 8192
                || value.chars().anyMatch(Character::isISOControl)) {
            throw new IllegalArgumentException("hmac value is invalid");
        }
        try {
            javax.crypto.Mac mac = javax.crypto.Mac.getInstance("HmacSHA256");
            mac.init(new javax.crypto.spec.SecretKeySpec(key.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            byte[] digest = mac.doFinal(value.getBytes(StandardCharsets.UTF_8));
            StringBuilder result = new StringBuilder(64);
            for (byte item : digest) {
                result.append(String.format("%02x", item));
            }
            return result.toString();
        } catch (java.security.GeneralSecurityException exception) {
            throw new IllegalStateException("HmacSHA256 is required by the JDK", exception);
        }
    }

    public static boolean constantTimeEquals(String left, String right) {
        if (left == null || right == null) {
            return false;
        }
        return MessageDigest.isEqual(
                left.getBytes(StandardCharsets.US_ASCII),
                right.getBytes(StandardCharsets.US_ASCII));
    }
}
