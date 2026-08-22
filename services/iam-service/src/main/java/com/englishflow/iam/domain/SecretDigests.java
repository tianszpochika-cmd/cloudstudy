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

    public static boolean constantTimeEquals(String left, String right) {
        if (left == null || right == null) {
            return false;
        }
        return MessageDigest.isEqual(
                left.getBytes(StandardCharsets.US_ASCII),
                right.getBytes(StandardCharsets.US_ASCII));
    }
}
