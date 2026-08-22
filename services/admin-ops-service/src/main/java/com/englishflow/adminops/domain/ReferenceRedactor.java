package com.englishflow.adminops.domain;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;

/** Stable opaque references for admin/support views and audit records. */
public final class ReferenceRedactor {

    private ReferenceRedactor() {
    }

    public static String subject(String value) {
        return opaque("subject", value);
    }

    public static String tenant(String value) {
        return opaque("tenant", value);
    }

    public static String media(String value) {
        return opaque("media", value);
    }

    public static String opaque(String namespace, String value) {
        if (value == null || value.isBlank()) {
            return "ref_unknown";
        }
        return "ref_" + namespace + "_" + sha256(namespace + ":" + value).substring(0, 24);
    }

    public static String sha256(String value) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));
            StringBuilder result = new StringBuilder(64);
            for (byte item : digest) {
                result.append(String.format("%02x", item));
            }
            return result.toString();
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is required", exception);
        }
    }
}
