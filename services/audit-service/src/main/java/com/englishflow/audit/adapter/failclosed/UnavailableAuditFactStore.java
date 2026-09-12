package com.englishflow.audit.adapter.failclosed;

import com.englishflow.audit.domain.AuditDomainException;
import com.englishflow.audit.domain.AuditEvent;
import com.englishflow.audit.domain.AuditFactStore;

public final class UnavailableAuditFactStore implements AuditFactStore {

    @Override
    public IngestResult ingest(AuditEvent event) {
        throw AuditDomainException.unavailable(
                "durable audit persistence is not enabled; audit facts are never faked in memory");
    }
}
