package com.englishflow.audit.domain;

import java.util.UUID;

public interface AuditFactStore {

    enum IngestStatus { ACCEPTED, DUPLICATE }

    record IngestResult(IngestStatus status, UUID auditId) {
    }

    IngestResult ingest(AuditEvent event);
}
