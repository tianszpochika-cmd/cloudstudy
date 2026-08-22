package com.englishflow.media.domain;

import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.Locale;
import java.util.Set;

/**
 * Authorization facts assembled from a verified principal and service-owned rights.
 * No HTTP body/header value is accepted as a tenant or owner fact.
 */
public record MediaAuthorizationContext(
        String subjectId,
        String tenantId,
        Set<String> roles,
        Set<String> permissions,
        String phase,
        Set<String> contentRights,
        boolean authenticated,
        boolean consentGranted,
        boolean deviceTrusted,
        String requestId) {

    public MediaAuthorizationContext {
        subjectId = normalize(subjectId, "subjectId");
        tenantId = normalize(tenantId, "tenantId");
        roles = normalizeSet(roles);
        permissions = normalizeSet(permissions);
        phase = normalize(phase, "phase");
        contentRights = normalizeSet(contentRights);
        requestId = normalize(requestId, "requestId");
    }

    public static MediaAuthorizationContext anonymous() {
        return new MediaAuthorizationContext(
                "anonymous", "unknown", Set.of(), Set.of(), "UNKNOWN", Set.of(), false, false, false, "anonymous-request");
    }

    public static MediaAuthorizationContext verified(
            String subjectId,
            String tenantId,
            Set<String> roles,
            Set<String> permissions,
            String phase,
            Set<String> contentRights,
            boolean consentGranted,
            boolean deviceTrusted,
            String requestId) {
        return new MediaAuthorizationContext(
                subjectId, tenantId, roles, permissions, phase, contentRights, true,
                consentGranted, deviceTrusted, requestId);
    }

    public boolean hasPermission(String permission) {
        return permission != null && permissions.contains(permission.toLowerCase(Locale.ROOT));
    }

    public boolean hasAnyPermission(String... required) {
        if (required == null) {
            return false;
        }
        for (String candidate : required) {
            if (hasPermission(candidate)) {
                return true;
            }
        }
        return false;
    }

    public boolean hasRole(String role) {
        return role != null && roles.contains(role.toLowerCase(Locale.ROOT));
    }

    public boolean hasContentRight(String right) {
        return right != null && (contentRights.contains("*") || contentRights.contains(right.toLowerCase(Locale.ROOT)));
    }

    private static String normalize(String value, String field) {
        if (value == null || value.isBlank() || value.trim().length() > 160) {
            throw MediaOperationException.badRequest("MEDIA_AUTH_FACT_INVALID", field + " is required");
        }
        return value.trim();
    }

    private static Set<String> normalizeSet(Set<String> values) {
        if (values == null || values.isEmpty()) {
            return Set.of();
        }
        LinkedHashSet<String> result = new LinkedHashSet<>();
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                result.add(value.trim().toLowerCase(Locale.ROOT));
            }
        }
        return Collections.unmodifiableSet(result);
    }
}
