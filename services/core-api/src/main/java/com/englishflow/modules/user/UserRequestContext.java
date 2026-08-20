package com.englishflow.modules.user;

import java.util.Objects;

/**
 * Server-authenticated subject context.  Controllers never accept a user id
 * from a route or request body; the auth boundary supplies this value as a
 * request attribute before the user module is invoked.
 */
public record UserRequestContext(
        String tenantId,
        long userId,
        String devicePublicId,
        String requestId,
        String traceId
) {

    public UserRequestContext {
        tenantId = requireTenantId(tenantId);
        if (userId < 1) {
            throw new IllegalArgumentException("userId must be positive");
        }
        devicePublicId = normalizeOptional(devicePublicId);
        requestId = normalizeRequestId(requestId);
        traceId = normalizeTraceId(traceId);
    }

    public boolean owns(String resourceTenantId, long resourceUserId) {
        return tenantId.equals(resourceTenantId) && userId == resourceUserId;
    }

    public boolean isCurrentDevice(String candidateDevicePublicId) {
        return devicePublicId != null && devicePublicId.equals(candidateDevicePublicId);
    }

    private static String requireTenantId(String value) {
        String normalized = normalizeOptional(value);
        if (normalized == null || !normalized.matches("[A-Za-z0-9][A-Za-z0-9._:-]{1,63}")) {
            throw new IllegalArgumentException("tenantId is invalid");
        }
        return normalized;
    }

    private static String normalizeOptional(String value) {
        if (value == null) return null;
        String normalized = value.trim();
        return normalized.isEmpty() ? null : normalized;
    }

    private static String normalizeRequestId(String value) {
        String normalized = normalizeOptional(value);
        if (normalized == null || !normalized.matches("[A-Za-z][A-Za-z0-9._-]{7,127}")) {
            return "req_user_context";
        }
        return normalized;
    }

    private static String normalizeTraceId(String value) {
        String normalized = normalizeOptional(value);
        if (normalized == null || !normalized.matches("[a-f0-9]{32}")) {
            return "00000000000000000000000000000000";
        }
        return normalized;
    }
}
