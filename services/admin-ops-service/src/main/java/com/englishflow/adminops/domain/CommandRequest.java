package com.englishflow.adminops.domain;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/** Client-safe command input. It deliberately has no actor, tenant, owner or free-text field. */
public record CommandRequest(
        Domain domain,
        CommandAction action,
        String resourceRef,
        String expectedVersion,
        String reasonCode,
        Map<String, String> attributes) {

    private static final Pattern SAFE_VALUE = Pattern.compile("[A-Za-z0-9._:/-]{1,160}");
    private static final java.util.Set<String> ALLOWED_ATTRIBUTE_KEYS = java.util.Set.of(
            "reasonCode", "expectedVersion", "targetState", "decisionCode", "templateCode");

    public CommandRequest {
        if (domain == null || action == null) {
            throw AdminOpsException.invalid("ADMIN_COMMAND_SCHEMA_INVALID", "domain and action are required");
        }
        if (action.domain() != domain) {
            throw AdminOpsException.invalid("ADMIN_COMMAND_DOMAIN_MISMATCH", "action does not belong to domain");
        }
        resourceRef = safeRequired(resourceRef, "resourceRef");
        expectedVersion = safeOptional(expectedVersion, "expectedVersion");
        reasonCode = safeOptional(reasonCode, "reasonCode");
        LinkedHashMap<String, String> normalized = new LinkedHashMap<>();
        if (attributes != null) {
            for (Map.Entry<String, String> entry : attributes.entrySet()) {
                String key = safeRequired(entry.getKey(), "attribute key");
                if (!ALLOWED_ATTRIBUTE_KEYS.contains(key)) {
                    throw AdminOpsException.invalid("ADMIN_COMMAND_FREE_TEXT_REJECTED", "attribute is not allowlisted");
                }
                normalized.put(key, safeRequired(entry.getValue(), key));
            }
        }
        attributes = Map.copyOf(normalized);
    }

    public String fingerprint() {
        String canonicalAttributes = attributes.entrySet().stream()
                .sorted(Map.Entry.comparingByKey())
                .map(entry -> entry.getKey() + "=" + entry.getValue())
                .collect(Collectors.joining(","));
        String canonical = domain.name() + "|" + action.name() + "|" + resourceRef + "|"
                + String.valueOf(expectedVersion) + "|" + String.valueOf(reasonCode) + "|" + canonicalAttributes;
        return sha256(canonical);
    }

    private static String safeRequired(String value, String field) {
        String normalized = value == null ? null : value.trim();
        if (normalized == null || normalized.isBlank() || !SAFE_VALUE.matcher(normalized).matches()) {
            throw AdminOpsException.invalid("ADMIN_COMMAND_SCHEMA_INVALID", field + " must be a safe opaque reference");
        }
        return normalized;
    }

    private static String safeOptional(String value, String field) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return safeRequired(value, field);
    }

    private static String sha256(String value) {
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
