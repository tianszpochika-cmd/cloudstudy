package com.englishflow.analytics.domain;

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Shared privacy gate for the event boundary. It is intentionally conservative: an event that is
 * not explicitly shaped by the allowlist never reaches the journal or a projection.
 */
public final class AnalyticsPrivacyBoundary {

    private static final Pattern EMAIL = Pattern.compile("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$");
    private static final Pattern PHONE = Pattern.compile("^\\+?[0-9][0-9\\s().-]{7,}$");
    private static final Set<String> FORBIDDEN_FIELD_TOKENS = Set.of(
            "email", "phone", "mobile", "fullname", "realname", "displayname", "address",
            "ipaddress", "useragent", "token", "password", "secret", "apikey", "authorization",
            "audio", "recording", "answer", "answertext", "answerkey", "questiontext", "contenttext",
            "freetext", "messagebody", "paymentcredential", "paymenttoken", "paymentreceipt",
            "cardnumber", "bankaccount", "orderdetails", "jws", "signature", "rawpayload", "rawjson");

    private AnalyticsPrivacyBoundary() {
    }

    public static String requireOpaqueReference(String value, String field) {
        if (value == null || value.isBlank() || value.length() > 256) {
            throw AnalyticsDomainException.rejected(AnalyticsErrorCode.TENANT_SCOPE_INVALID,
                    field + " must be a non-empty opaque reference");
        }
        if (looksLikePersonalValue(value)) {
            throw AnalyticsDomainException.rejected(AnalyticsErrorCode.RAW_PII_REJECTED,
                    field + " must not contain a raw personal identifier");
        }
        if (!value.matches("[A-Za-z0-9][A-Za-z0-9._:-]{0,255}")) {
            throw AnalyticsDomainException.rejected(AnalyticsErrorCode.TENANT_SCOPE_INVALID,
                    field + " must be a bounded opaque reference");
        }
        return value;
    }

    public static Map<String, Object> sanitizePayload(Map<String, Object> source) {
        if (source == null) {
            throw AnalyticsDomainException.rejected(AnalyticsErrorCode.PAYLOAD_VALUE_INVALID,
                    "payload must be an object");
        }
        return immutableMap(sanitizeObject(source, "payload"));
    }

    private static Map<String, Object> sanitizeObject(Map<?, ?> source, String path) {
        Map<String, Object> result = new LinkedHashMap<>();
        for (Map.Entry<?, ?> entry : source.entrySet()) {
            if (!(entry.getKey() instanceof String key) || key.isBlank()) {
                throw AnalyticsDomainException.rejected(AnalyticsErrorCode.PAYLOAD_FIELD_NOT_ALLOWED,
                        path + " contains a non-string field name");
            }
            rejectForbiddenField(key);
            result.put(key, sanitizeValue(entry.getValue(), path + "." + key));
        }
        return result;
    }

    private static Object sanitizeValue(Object value, String path) {
        if (value == null) {
            return null;
        }
        if (value instanceof String text) {
            if (text.length() > 512 || looksLikePersonalValue(text) || text.startsWith("Bearer ")
                    || text.startsWith("data:audio/")) {
                throw AnalyticsDomainException.rejected(AnalyticsErrorCode.RAW_PII_REJECTED,
                        path + " contains a forbidden raw value");
            }
            return text;
        }
        if (value instanceof Number || value instanceof Boolean) {
            return value;
        }
        if (value instanceof Map<?, ?> map) {
            return immutableMap(sanitizeObject(map, path));
        }
        if (value instanceof List<?> list) {
            if (list.size() > 100) {
                throw AnalyticsDomainException.rejected(AnalyticsErrorCode.PAYLOAD_VALUE_INVALID,
                        path + " contains too many values");
            }
            List<Object> sanitized = new ArrayList<>();
            for (Object item : list) {
                sanitized.add(sanitizeValue(item, path + "[]"));
            }
            return List.copyOf(sanitized);
        }
        throw AnalyticsDomainException.rejected(AnalyticsErrorCode.PAYLOAD_VALUE_INVALID,
                path + " contains an unsupported value type");
    }

    private static void rejectForbiddenField(String key) {
        String normalized = normalize(key);
        for (String token : FORBIDDEN_FIELD_TOKENS) {
            if (normalized.equals(token) || normalized.contains(token)) {
                throw AnalyticsDomainException.rejected(AnalyticsErrorCode.RAW_PII_REJECTED,
                        "field is not permitted in analytics events");
            }
        }
    }

    private static String normalize(String value) {
        StringBuilder normalized = new StringBuilder();
        for (int index = 0; index < value.length(); index++) {
            char character = Character.toLowerCase(value.charAt(index));
            if (character >= 'a' && character <= 'z') {
                normalized.append(character);
            }
        }
        return normalized.toString();
    }

    private static boolean looksLikePersonalValue(String value) {
        return EMAIL.matcher(value).matches() || PHONE.matcher(value).matches();
    }

    private static Map<String, Object> immutableMap(Map<String, Object> source) {
        Map<String, Object> copy = new LinkedHashMap<>();
        source.forEach((key, value) -> copy.put(key, immutableValue(value)));
        return Collections.unmodifiableMap(copy);
    }

    private static Object immutableValue(Object value) {
        if (value instanceof Map<?, ?> map) {
            Map<String, Object> copy = new LinkedHashMap<>();
            map.forEach((key, item) -> copy.put(String.valueOf(key), immutableValue(item)));
            return Collections.unmodifiableMap(copy);
        }
        if (value instanceof List<?> list) {
            return List.copyOf(list.stream().map(AnalyticsPrivacyBoundary::immutableValue).toList());
        }
        return value;
    }
}
