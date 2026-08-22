package com.englishflow.analytics.domain;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;

/** Deterministic hash used for dedupe/conflict checks; raw payload is never logged. */
public final class AnalyticsHash {

    private AnalyticsHash() {
    }

    public static String payloadHash(Map<String, Object> payload) {
        return sha256(canonicalize(payload));
    }

    public static String sha256(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] bytes = digest.digest(value.getBytes(StandardCharsets.UTF_8));
            StringBuilder result = new StringBuilder(bytes.length * 2);
            for (byte item : bytes) {
                result.append(String.format("%02x", item));
            }
            return result.toString();
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is required", exception);
        }
    }

    private static String canonicalize(Object value) {
        if (value == null) {
            return "null";
        }
        if (value instanceof Map<?, ?> map) {
            List<String> keys = new ArrayList<>();
            for (Object key : map.keySet()) {
                keys.add(String.valueOf(key));
            }
            Collections.sort(keys);
            StringBuilder result = new StringBuilder("{");
            for (String key : keys) {
                result.append(escape(key)).append(':').append(canonicalize(map.get(key))).append(';');
            }
            return result.append('}').toString();
        }
        if (value instanceof List<?> list) {
            StringBuilder result = new StringBuilder("[");
            for (Object item : list) {
                result.append(canonicalize(item)).append(';');
            }
            return result.append(']').toString();
        }
        return escape(String.valueOf(value));
    }

    private static String escape(String value) {
        return value.replace("\\", "\\\\").replace(";", "\\;").replace(":", "\\:");
    }
}
