package com.englishflow.gateway.support;

import java.time.Instant;

/**
 * Exact redacted Gateway boundary audit shape. It intentionally excludes path
 * parameters, query strings, bodies, cookies, tokens and client authority headers.
 */
public record SecurityAuditRecord(
        Instant occurredAt,
        String routeId,
        String method,
        int status,
        String requestId,
        String traceId,
        String subjectHash,
        String tenantHash,
        String clientProfile,
        String decision,
        String reasonCode,
        String latencyBucket
) {
}
