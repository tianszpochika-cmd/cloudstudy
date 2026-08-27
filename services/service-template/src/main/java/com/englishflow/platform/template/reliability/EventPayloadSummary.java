package com.englishflow.platform.template.reliability;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Collections;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.TreeMap;
import java.util.regex.Pattern;

/**
 * Bounded, metadata-only event payload. It intentionally has no JSON/object serializer so a
 * copied service must choose an explicit, audited projection before publishing an event.
 */
public record EventPayloadSummary(Map<String, String> values) {

    public static final int MAX_ENTRIES = 32;
    public static final int MAX_KEY_LENGTH = 64;
    public static final int MAX_VALUE_LENGTH = 256;

    private static final Pattern SAFE_KEY = Pattern.compile("[a-z][a-z0-9_.-]{0,63}");
    private static final Set<String> FORBIDDEN_KEYS = Set.of(
            "answer", "answers", "answerkey", "answer_key", "token", "access_token",
            "refresh_token", "audio", "audio_url", "audio_bytes", "payment", "payment_token",
            "payment_payload", "card_number", "cvv", "password", "secret", "credential",
            "raw_content", "raw_text", "transcript");

    public EventPayloadSummary {
        Objects.requireNonNull(values, "values is required");
        if (values.size() > MAX_ENTRIES) {
            throw new IllegalArgumentException("payload summary exceeds the entry limit");
        }
        TreeMap<String, String> normalized = new TreeMap<>();
        values.forEach((rawKey, rawValue) -> {
            String key = normalizeKey(rawKey);
            String value = Objects.requireNonNull(rawValue, "payload summary value is required");
            if (value.length() > MAX_VALUE_LENGTH) {
                throw new IllegalArgumentException("payload summary value exceeds the length limit");
            }
            if (value.chars().anyMatch(Character::isISOControl)) {
                throw new IllegalArgumentException("payload summary cannot contain control characters");
            }
            normalized.put(key, value);
        });
        values = Collections.unmodifiableMap(normalized);
    }

    public static EventPayloadSummary empty() {
        return new EventPayloadSummary(Map.of());
    }

    public static EventPayloadSummary of(Map<String, String> values) {
        return new EventPayloadSummary(values);
    }

    /** Canonical metadata form used only for dedupe/fingerprint binding, never as event payload. */
    public String canonicalForm() {
        StringBuilder result = new StringBuilder();
        values.forEach((key, value) -> result.append(key).append('=').append(value).append('\u001f'));
        return result.toString();
    }

    public String fingerprint() {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest(canonicalForm().getBytes(StandardCharsets.UTF_8));
            StringBuilder result = new StringBuilder(digest.length * 2);
            for (byte value : digest) {
                result.append(String.format("%02x", value));
            }
            return result.toString();
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is unavailable", exception);
        }
    }

    private static String normalizeKey(String rawKey) {
        Objects.requireNonNull(rawKey, "payload summary key is required");
        String key = rawKey.trim().toLowerCase(Locale.ROOT);
        if (!SAFE_KEY.matcher(key).matches()) {
            throw new IllegalArgumentException("payload summary key has an unsafe format");
        }
        if (FORBIDDEN_KEYS.contains(key) || containsSensitiveSegment(key)) {
            throw new IllegalArgumentException("payload summary key is not allowed");
        }
        return key;
    }

    private static boolean containsSensitiveSegment(String key) {
        return key.contains("token") || key.contains("secret") || key.contains("password")
                || key.contains("credential") || key.contains("audio") || key.contains("payment")
                || key.contains("answer") || key.contains("transcript");
    }
}
