package com.englishflow.content.domain;

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/** Immutable version payload. Nested maps/lists are defensively copied at the fact boundary. */
public record ContentPayload(Map<String, Object> fields) {

    public ContentPayload {
        if (fields == null || fields.isEmpty()) {
            throw ContentOperationException.badRequest("CONTENT_PAYLOAD_REQUIRED", "content payload is required");
        }
        fields = immutableMap(fields);
    }

    public boolean containsAnswerRules() {
        return containsAnswerRules(fields);
    }

    public static boolean containsAnswerRules(Map<String, Object> source) {
        return source != null && containsRestrictedKey(source);
    }

    public Map<String, Object> raw() {
        return fields;
    }

    private static Map<String, Object> immutableMap(Map<?, ?> source) {
        LinkedHashMap<String, Object> result = new LinkedHashMap<>();
        source.forEach((key, value) -> {
            if (key == null || String.valueOf(key).isBlank()) {
                throw ContentOperationException.badRequest("CONTENT_PAYLOAD_KEY_INVALID", "payload key is invalid");
            }
            result.put(String.valueOf(key), immutableValue(value));
        });
        return Collections.unmodifiableMap(result);
    }

    private static Object immutableValue(Object value) {
        if (value instanceof Map<?, ?> map) {
            return immutableMap(map);
        }
        if (value instanceof List<?> list) {
            List<Object> copy = new ArrayList<>();
            for (Object item : list) {
                copy.add(immutableValue(item));
            }
            return Collections.unmodifiableList(copy);
        }
        if (value instanceof Set<?> set) {
            List<Object> copy = new ArrayList<>();
            for (Object item : set) {
                copy.add(immutableValue(item));
            }
            return Collections.unmodifiableList(copy);
        }
        return value;
    }

    private static boolean containsRestrictedKey(Map<String, Object> source) {
        for (Map.Entry<String, Object> entry : source.entrySet()) {
            if (ContentProjectionPolicy.isAnswerRuleKey(entry.getKey())) {
                return true;
            }
            if (entry.getValue() instanceof Map<?, ?> nested && containsRestrictedKey(stringMap(nested))) {
                return true;
            }
            if (entry.getValue() instanceof List<?> list) {
                for (Object item : list) {
                    if (item instanceof Map<?, ?> nested && containsRestrictedKey(stringMap(nested))) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    private static Map<String, Object> stringMap(Map<?, ?> source) {
        LinkedHashMap<String, Object> result = new LinkedHashMap<>();
        source.forEach((key, value) -> result.put(String.valueOf(key), value));
        return result;
    }

}
