package com.englishflow.audit.application;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

import com.englishflow.audit.adapter.failclosed.UnavailableAuditFactStore;
import com.englishflow.audit.domain.AuditDomainException;
import com.englishflow.audit.domain.AuditEvent;
import com.englishflow.audit.domain.AuditFactStore;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class AuditIngestServiceTest {

    private static final String HASH = "a".repeat(64);

    @Test
    void acceptedIngestReturnsTheStoredFactIdentity() {
        UUID auditId = UUID.randomUUID();
        AuditIngestService service = new AuditIngestService(event -> new AuditFactStore.IngestResult(
                AuditFactStore.IngestStatus.ACCEPTED, auditId));
        AuditFactStore.IngestResult result = service.ingest(event(20));
        assertEquals(AuditFactStore.IngestStatus.ACCEPTED, result.status());
        assertEquals(auditId, result.auditId());
    }

    @Test
    void duplicateEventIsReportedWithoutAFabricatedFact() {
        UUID auditId = UUID.randomUUID();
        AuditIngestService service = new AuditIngestService(event -> new AuditFactStore.IngestResult(
                AuditFactStore.IngestStatus.DUPLICATE, auditId));
        assertEquals(AuditFactStore.IngestStatus.DUPLICATE, service.ingest(event(20)).status());
    }

    @Test
    void unavailablePersistenceFailsClosedWith503() {
        AuditIngestService service = new AuditIngestService(new UnavailableAuditFactStore());
        AuditDomainException failure = assertThrows(AuditDomainException.class, () -> service.ingest(event(20)));
        assertEquals("AUDIT_UNAVAILABLE", failure.code());
        assertEquals(503, failure.status());
    }

    @Test
    void storeReturningNoIdentityFailsClosed() {
        AuditIngestService service = new AuditIngestService(event -> new AuditFactStore.IngestResult(
                AuditFactStore.IngestStatus.ACCEPTED, null));
        AuditDomainException failure = assertThrows(AuditDomainException.class, () -> service.ingest(event(20)));
        assertEquals(503, failure.status());
    }

    @Test
    void oversizedActionIsRejected() {
        AuditIngestService service = new AuditIngestService(event -> new AuditFactStore.IngestResult(
                AuditFactStore.IngestStatus.ACCEPTED, UUID.randomUUID()));
        AuditDomainException failure = assertThrows(AuditDomainException.class, () -> service.ingest(event(97)));
        assertEquals("AUDIT_EVENT_INVALID", failure.code());
    }

    @Test
    void foreignTenantIsRejectedAtTheDomainBoundary() {
        assertThrows(AuditDomainException.class, () -> new AuditEvent(UUID.randomUUID(), "learning-service",
                "audit.event.v1", "other", HASH, "learning.plan.read", "ALLOW", null, Instant.now(),
                null, null, Map.of()));
    }

    private static AuditEvent event(int actionLength) {
        return new AuditEvent(UUID.randomUUID(), "learning-service", "audit.event.v1", "platform", HASH,
                "a".repeat(actionLength), "ALLOW", null, Instant.now(), "req-1", "trace-1",
                Map.of("outcome", "ok"));
    }
}
