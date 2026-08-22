package com.englishflow.adminops.domain;

import java.util.Map;

/**
 * Read-only projection supplied by a domain adapter. It contains no mutable domain entity and
 * exposes only safe codes in the metadata map. The admin service never persists or writes it.
 */
public record ProjectionRecord(
        Domain domain,
        String resourceRef,
        String tenantId,
        String ownerSubjectId,
        String authorSubjectId,
        String version,
        String status,
        Map<String, String> safeFields) {

    public ProjectionRecord {
        if (domain == null || resourceRef == null || resourceRef.isBlank()
                || tenantId == null || tenantId.isBlank()) {
            throw AdminOpsException.invalid("ADMIN_PROJECTION_INVALID", "projection identity is incomplete");
        }
        safeFields = safeFields == null ? Map.of() : Map.copyOf(safeFields);
    }
}
