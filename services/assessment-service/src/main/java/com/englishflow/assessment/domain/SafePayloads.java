package com.englishflow.assessment.domain;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/** Small dependency-free payload guard used at the service boundary and in the smoke test. */
public final class SafePayloads {
    private static final Set<String> SENSITIVE_KEYS = Set.of(
            "correctanswer", "correctoptionkeys", "correctoptions", "answerkey", "answerkeyorder",
            "answerrule", "answerrules", "acceptedanswers", "acceptedtext", "requiredconcepts",
            "correctpairs", "scoringrule", "scoringrules", "hiddenrule", "hiddenrules", "scorekey", "secret",
            "rawanswer", "answerplaintext", "clientanswer", "score", "iscorrect", "clientscore", "clientiscorrect",
            "correctoption");
    private static final Set<String> ANSWER_LEAK_KEYS = Set.of(
            "correctanswer", "correctoptionkeys", "correctoptions", "answerkey", "answerkeyorder",
            "answerrule", "answerrules", "acceptedanswers", "acceptedtext", "requiredconcepts", "correctpairs",
            "scoringrule", "scoringrules", "hiddenrule", "hiddenrules", "scorekey", "secret",
            "rawanswer", "answerplaintext", "clientanswer", "correctoption", "answer",
            "selectedoptionkeys", "blanks", "orderedtokenids", "pairs", "selectedspanids", "replacements", "text");

    private SafePayloads() { }

    public static Map<String, Object> freeze(Map<String, Object> source) {
        return Collections.unmodifiableMap(copyMap(source == null ? Map.of() : source));
    }

    public static Map<String, Object> copyMap(Map<String, Object> source) {
        Map<String, Object> result = new LinkedHashMap<>();
        if (source == null) return result;
        for (Map.Entry<String, Object> entry : source.entrySet()) {
            if (entry.getKey() == null || entry.getKey().isBlank()) {
                throw AssessmentDomainException.invalid("ASM_PAYLOAD_INVALID", "payload key is required");
            }
            result.put(entry.getKey(), copyValue(entry.getValue()));
        }
        return result;
    }

    @SuppressWarnings("unchecked")
    public static Object copyValue(Object value) {
        if (value instanceof Map<?, ?> map) {
            Map<String, Object> copy = new LinkedHashMap<>();
            for (Map.Entry<?, ?> entry : map.entrySet()) {
                if (!(entry.getKey() instanceof String key)) {
                    throw AssessmentDomainException.invalid("ASM_PAYLOAD_INVALID", "nested payload key must be text");
                }
                copy.put(key, copyValue(entry.getValue()));
            }
            return Collections.unmodifiableMap(copy);
        }
        if (value instanceof Collection<?> collection) {
            List<Object> copy = new ArrayList<>();
            for (Object item : collection) copy.add(copyValue(item));
            return Collections.unmodifiableList(copy);
        }
        return value;
    }

    public static boolean containsSensitive(Object value) {
        return containsKey(value, SENSITIVE_KEYS);
    }

    /** Outbox payloads may contain derived score summaries, but never answer material or rules. */
    public static boolean containsAnswerLeak(Object value) {
        return containsKey(value, ANSWER_LEAK_KEYS);
    }

    private static boolean containsKey(Object value, Set<String> keys) {
        if (value instanceof Map<?, ?> map) {
            for (Map.Entry<?, ?> entry : map.entrySet()) {
                if (entry.getKey() instanceof String key && keys.contains(normalize(key))) return true;
                if (containsKey(entry.getValue(), keys)) return true;
            }
        } else if (value instanceof Collection<?> collection) {
            for (Object item : collection) if (containsKey(item, keys)) return true;
        }
        return false;
    }

    public static Map<String, Object> sanitizeLearnerView(Map<String, Object> source) {
        return sanitizeMap(source == null ? Map.of() : source);
    }

    private static Map<String, Object> sanitizeMap(Map<String, Object> source) {
        Map<String, Object> result = new LinkedHashMap<>();
        for (Map.Entry<String, Object> entry : source.entrySet()) {
            if (SENSITIVE_KEYS.contains(normalize(entry.getKey()))) continue;
            result.put(entry.getKey(), sanitizeValue(entry.getValue()));
        }
        return Collections.unmodifiableMap(result);
    }

    private static Object sanitizeValue(Object value) {
        if (value instanceof Map<?, ?> map) {
            Map<String, Object> nested = new LinkedHashMap<>();
            for (Map.Entry<?, ?> entry : map.entrySet()) {
                if (entry.getKey() instanceof String key && !SENSITIVE_KEYS.contains(normalize(key))) {
                    nested.put(key, sanitizeValue(entry.getValue()));
                }
            }
            return Collections.unmodifiableMap(nested);
        }
        if (value instanceof Collection<?> collection) {
            List<Object> nested = new ArrayList<>();
            for (Object item : collection) nested.add(sanitizeValue(item));
            return Collections.unmodifiableList(nested);
        }
        return value;
    }

    public static String digest(Object value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            digest.update(canonical(value).getBytes(StandardCharsets.UTF_8));
            StringBuilder result = new StringBuilder(64);
            for (byte item : digest.digest()) result.append(String.format("%02x", item));
            return result.toString();
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is required", exception);
        }
    }

    private static String canonical(Object value) {
        if (value == null) return "null";
        if (value instanceof Map<?, ?> map) {
            List<Map.Entry<String, Object>> entries = new ArrayList<>();
            for (Map.Entry<?, ?> entry : map.entrySet()) {
                if (!(entry.getKey() instanceof String key)) throw new IllegalArgumentException("map key must be text");
                // Map.entry rejects null values; request fingerprints intentionally preserve
                // optional fields such as a missing duration, so use a null-tolerant entry.
                entries.add(new java.util.AbstractMap.SimpleImmutableEntry<>(key, entry.getValue()));
            }
            entries.sort(Comparator.comparing(Map.Entry::getKey));
            StringBuilder result = new StringBuilder("{");
            for (Map.Entry<String, Object> entry : entries) result.append(escape(entry.getKey())).append(':').append(canonical(entry.getValue())).append(';');
            return result.append('}').toString();
        }
        if (value instanceof Collection<?> collection) {
            StringBuilder result = new StringBuilder("[");
            for (Object item : collection) result.append(canonical(item)).append(';');
            return result.append(']').toString();
        }
        return escape(String.valueOf(value));
    }

    private static String escape(String value) {
        return value.replace("\\", "\\\\").replace("\n", "\\n").replace(";", "\\;");
    }

    private static String normalize(String value) {
        return value.replaceAll("[^A-Za-z0-9]", "").toLowerCase();
    }
}
