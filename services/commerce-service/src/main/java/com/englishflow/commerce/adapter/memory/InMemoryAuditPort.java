package com.englishflow.commerce.adapter.memory;

import com.englishflow.commerce.application.ports.AuditPort;

import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

public final class InMemoryAuditPort implements AuditPort {
    private final CopyOnWriteArrayList<AuditRecord> records = new CopyOnWriteArrayList<>();

    @Override
    public void append(AuditRecord record) {
        records.add(record);
    }

    public List<AuditRecord> records() {
        return List.copyOf(records);
    }
}
