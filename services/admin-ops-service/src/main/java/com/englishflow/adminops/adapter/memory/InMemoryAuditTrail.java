package com.englishflow.adminops.adapter.memory;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import com.englishflow.adminops.domain.AuditEvent;
import com.englishflow.adminops.domain.AuditPage;
import com.englishflow.adminops.domain.AuditRecord;
import com.englishflow.adminops.domain.AuditTrail;

/** Append-only, immutable in-memory audit adapter used by smoke tests and local wiring. */
public final class InMemoryAuditTrail implements AuditTrail {

    private final List<AuditRecord> records = new ArrayList<>();

    @Override
    public synchronized AuditRecord append(AuditEvent event) {
        String previousHash = records.isEmpty() ? null : records.get(records.size() - 1).recordHash();
        AuditRecord record = AuditRecord.create(event, previousHash, "audit_" + UUID.randomUUID());
        records.add(record);
        return record;
    }

    @Override
    public synchronized List<AuditRecord> snapshot() {
        return List.copyOf(records);
    }

    @Override
    public synchronized AuditPage page(String tenantRef, Long beforeSequence, int pageSize) {
        List<AuditRecord> items = new ArrayList<>();
        Long lastSequence = null;
        for (int index = records.size() - 1; index >= 0; index--) {
            long sequence = index + 1L;
            if (beforeSequence != null && sequence >= beforeSequence) continue;
            AuditRecord record = records.get(index);
            if (!tenantRef.equals(record.tenantRef())) continue;
            if (items.size() == pageSize) return new AuditPage(items, lastSequence);
            items.add(record);
            lastSequence = sequence;
        }
        return new AuditPage(items, null);
    }
}
