package com.englishflow.commerce.adapter.failclosed;

import com.englishflow.commerce.application.ports.AuditPort;
import com.englishflow.commerce.domain.CommerceException;

/** Audit is a fact, so local-real never records it in process memory. */
public final class FailClosedAuditPort implements AuditPort {
    @Override public void append(AuditRecord record) {
        throw CommerceException.unavailable("COMMERCE_AUDIT_UNAVAILABLE", "durable commerce audit is not configured");
    }
}
