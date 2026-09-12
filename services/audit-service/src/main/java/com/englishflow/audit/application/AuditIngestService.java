package com.englishflow.audit.application;

import java.util.Objects;
import java.util.UUID;

import com.englishflow.audit.domain.AuditEvent;
import com.englishflow.audit.domain.AuditFactStore;

public final class AuditIngestService {

    private static final int MAX_ACTION_LENGTH = 96;
    private static final int MAX_SOURCE_LENGTH = 64;

    private final AuditFactStore store;

    public AuditIngestService(AuditFactStore store) {
        this.store = Objects.requireNonNull(store, "store");
    }

    public AuditFactStore.IngestResult ingest(AuditEvent event) {
        Objects.requireNonNull(event, "event");
        if (event.action().length() > MAX_ACTION_LENGTH) {
            throw com.englishflow.audit.domain.AuditDomainException.invalid("action is too long");
        }
        if (event.sourceService().length() > MAX_SOURCE_LENGTH) {
            throw com.englishflow.audit.domain.AuditDomainException.invalid("source service is too long");
        }
        AuditFactStore.IngestResult result = store.ingest(event);
        if (result == null || result.auditId() == null) {
            throw com.englishflow.audit.domain.AuditDomainException.unavailable(
                    "audit facts could not be persisted");
        }
        return result;
    }

    public AuditFactStore.IngestResult ingest(UUID eventId, String sourceService, String schemaVersion,
                                              String tenantId, String actorSubjectHash, String action,
                                              String decision, String reasonCode, java.time.Instant occurredAt,
                                              String requestId, String traceId,
                                              java.util.Map<String, Object> redactedPayload) {
        return ingest(new AuditEvent(eventId, sourceService, schemaVersion, tenantId, actorSubjectHash, action,
                decision, reasonCode, occurredAt, requestId, traceId, redactedPayload));
    }
}
