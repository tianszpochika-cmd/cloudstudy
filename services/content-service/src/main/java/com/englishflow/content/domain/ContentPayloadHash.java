package com.englishflow.content.domain;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;

/** Deterministic SHA-256 for version pinning, idempotency fingerprints and audit evidence. */
public final class ContentPayloadHash {

    private ContentPayloadHash() {
    }

    public static String sha256(Map<String, Object> payload) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return hex(digest.digest(canonical(payload).getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is required by the runtime", exception);
        }
    }

    private static String canonical(Object value) {
        if (value == null) {
            return "null";
        }
        if (value instanceof Map<?, ?> map) {
            List<Map.Entry<?, ?>> entries = new ArrayList<>(map.entrySet());
            entries.sort(Comparator.comparing(entry -> String.valueOf(entry.getKey())));
            StringBuilder result = new StringBuilder("{");
            for (Map.Entry<?, ?> entry : entries) {
                result.append(quote(String.valueOf(entry.getKey())))
                        .append(':')
                        .append(canonical(entry.getValue()))
                        .append(';');
            }
            return result.append('}').toString();
        }
        if (value instanceof List<?> list) {
            StringBuilder result = new StringBuilder("[");
            for (Object item : list) {
                result.append(canonical(item)).append(';');
            }
            return result.append(']').toString();
        }
        if (value instanceof Number || value instanceof Boolean) {
            return String.valueOf(value);
        }
        return quote(String.valueOf(value));
    }

    private static String quote(String value) {
        return '"' + value.replace("\\", "\\\\").replace("\"", "\\\"") + '"';
    }

    private static String hex(byte[] bytes) {
        StringBuilder result = new StringBuilder(bytes.length * 2);
        for (byte value : bytes) {
            result.append(String.format("%02x", value));
        }
        return result.toString();
    }
}
