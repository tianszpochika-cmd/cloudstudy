package com.englishflow.media.domain;

import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Pattern;

final class MediaValidation {

    private static final Pattern SHA256 = Pattern.compile("[0-9a-fA-F]{64}");
    private static final Pattern ID = Pattern.compile("[A-Za-z0-9][A-Za-z0-9._:-]{0,159}");

    private MediaValidation() {
    }

    static String text(String value, String field, int maxLength) {
        if (value == null || value.isBlank() || value.trim().length() > maxLength) {
            throw MediaOperationException.badRequest("MEDIA_FIELD_INVALID", field + " is required");
        }
        return value.trim();
    }

    static String id(String value, String field) {
        String normalized = text(value, field, 160);
        if (!ID.matcher(normalized).matches()) {
            throw MediaOperationException.badRequest("MEDIA_ID_INVALID", field + " has an unsafe format");
        }
        return normalized;
    }

    static String optionalText(String value, String field, int maxLength) {
        if (value == null || value.isBlank()) {
            return null;
        }
        if (value.trim().length() > maxLength) {
            throw MediaOperationException.badRequest("MEDIA_FIELD_INVALID", field + " is too long");
        }
        return value.trim();
    }

    static String sha256(String value, String field) {
        String normalized = text(value, field, 64).toLowerCase(Locale.ROOT);
        if (!SHA256.matcher(normalized).matches() || normalized.chars().allMatch(character -> character == '0')) {
            throw MediaOperationException.badRequest("MEDIA_CHECKSUM_INVALID", field + " must be a non-zero SHA-256");
        }
        return normalized;
    }

    static Set<String> upperSet(Set<String> values, String field) {
        if (values == null || values.isEmpty()) {
            throw MediaOperationException.badRequest("MEDIA_SET_REQUIRED", field + " is required");
        }
        LinkedHashSet<String> normalized = new LinkedHashSet<>();
        for (String value : values) {
            normalized.add(text(value, field, 64).toUpperCase(Locale.ROOT));
        }
        return Collections.unmodifiableSet(normalized);
    }

    static Set<String> lowerSet(Set<String> values) {
        if (values == null || values.isEmpty()) {
            return Set.of();
        }
        LinkedHashSet<String> normalized = new LinkedHashSet<>();
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                normalized.add(value.trim().toLowerCase(Locale.ROOT));
            }
        }
        return Collections.unmodifiableSet(normalized);
    }

    static long positive(long value, String field) {
        if (value <= 0) {
            throw MediaOperationException.badRequest("MEDIA_SIZE_INVALID", field + " must be positive");
        }
        return value;
    }

    static int positive(int value, String field) {
        if (value <= 0) {
            throw MediaOperationException.badRequest("MEDIA_SIZE_INVALID", field + " must be positive");
        }
        return value;
    }
}
