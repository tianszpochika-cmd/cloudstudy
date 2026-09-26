package com.englishflow.media.application;

import com.englishflow.media.domain.MediaOperationException;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.lang.reflect.RecordComponent;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/** Stable digest of the path and typed request, independent of JSON field ordering. */
public final class MediaWriteFingerprint {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    private MediaWriteFingerprint() {
    }

    public static String key(String value) {
        if (value == null || !value.matches("[A-Za-z0-9._:-]{8,128}")) {
            throw MediaOperationException.badRequest(
                    "MEDIA_IDEMPOTENCY_KEY_INVALID", "Idempotency-Key is required and has an unsafe format");
        }
        return value;
    }

    public static String digest(String assetId, Object request) {
        String canonical = canonical(request, "") + "|" + assetId;
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(canonical.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException impossible) {
            throw new IllegalStateException("SHA-256 is required", impossible);
        }
    }

    private static String canonical(Object value, String field) {
        if (value == null) return "null";
        if (value instanceof String text) return quote(text);
        if (value instanceof Number || value instanceof Boolean) return value.toString();
        if (value instanceof Enum<?> option) return quote(option.name());
        if (value instanceof java.time.Instant instant) return quote(instant.toString());
        if (value instanceof Map<?, ?> map) {
            List<String> names = map.keySet().stream().map(String::valueOf).sorted().toList();
            return names.stream().map(name -> quote(name) + ":" + canonical(map.get(name), name))
                    .collect(Collectors.joining(",", "{", "}"));
        }
        if (value.getClass().isRecord()) {
            List<RecordComponent> components = new ArrayList<>(List.of(value.getClass().getRecordComponents()));
            components.sort(java.util.Comparator.comparing(RecordComponent::getName));
            return components.stream().map(component -> {
                try {
                    return quote(component.getName()) + ":" + canonical(
                            component.getAccessor().invoke(value), component.getName());
                } catch (ReflectiveOperationException exception) {
                    throw new IllegalStateException("media request cannot be fingerprinted", exception);
                }
            }).collect(Collectors.joining(",", "{", "}"));
        }
        if (value instanceof Collection<?> collection) {
            List<String> values = new ArrayList<>();
            collection.forEach(item -> values.add(canonical(item, "")));
            if (field.equals("permittedChannels") || value instanceof Set<?>) values.sort(String::compareTo);
            return values.stream().collect(Collectors.joining(",", "[", "]"));
        }
        throw new IllegalArgumentException("unsupported media idempotency request field: " + value.getClass());
    }

    private static String quote(String text) {
        return MAPPER.valueToTree(text).toString();
    }
}
