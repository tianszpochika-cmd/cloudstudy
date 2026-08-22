package com.englishflow.gateway.support;

import java.time.Instant;

/** Safe edge audit record: path only, never query, body, token or role headers. */
public record SecurityAuditRecord(
        String decisionId,
        String requestId,
        String traceId,
        String method,
        String path,
        int status,
        String reason,
        Instant occurredAt
) {
}
