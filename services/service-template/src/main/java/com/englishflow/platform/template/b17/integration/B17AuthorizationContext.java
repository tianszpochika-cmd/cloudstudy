package com.englishflow.platform.template.b17.integration;

import java.util.Objects;

/** Server-derived identity facts used by the B17 cross-service adapter boundary. */
public record B17AuthorizationContext(String subject, String tenantId, String ownerId, String phase) {
    public B17AuthorizationContext {
        subject = required(subject, "subject");
        tenantId = required(tenantId, "tenantId");
        ownerId = required(ownerId, "ownerId");
        phase = required(phase, "phase");
        if (!"platform".equals(tenantId)) throw new IllegalArgumentException("Phase 1 tenant is server-derived platform");
        if (!subject.equals(ownerId)) throw new IllegalArgumentException("owner must be the authenticated subject");
        if (!"phase-1".equals(phase)) throw new IllegalArgumentException("B17 only supports Phase 1");
    }

    public boolean owns(String requestedOwner) {
        return Objects.equals(ownerId, requestedOwner);
    }

    private static String required(String value, String field) {
        if (value == null || value.isBlank()) throw new IllegalArgumentException(field + " is required");
        return value.trim();
    }
}
