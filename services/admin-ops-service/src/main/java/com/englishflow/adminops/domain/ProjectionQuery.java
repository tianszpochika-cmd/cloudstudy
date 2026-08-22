package com.englishflow.adminops.domain;

public record ProjectionQuery(Domain domain, String resourceRef, int limit) {

    public ProjectionQuery {
        if (domain == null) {
            throw AdminOpsException.invalid("ADMIN_QUERY_SCHEMA_INVALID", "domain is required");
        }
        if (resourceRef != null && resourceRef.isBlank()) {
            resourceRef = null;
        }
        limit = Math.max(1, Math.min(limit <= 0 ? 20 : limit, 100));
    }
}
