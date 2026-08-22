package com.englishflow.gateway.support;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ConcurrentLinkedDeque;

/** Bounded local sink for Platform 0 and tests; production replaces it with audit-service. */
public final class BoundedSecurityAuditSink implements SecurityAuditSink {

    private final int capacity;
    private final ConcurrentLinkedDeque<SecurityAuditRecord> records = new ConcurrentLinkedDeque<>();

    public BoundedSecurityAuditSink(int capacity) {
        if (capacity < 1) {
            throw new IllegalArgumentException("capacity must be positive");
        }
        this.capacity = capacity;
    }

    @Override
    public void record(SecurityAuditRecord record) {
        records.addLast(record);
        while (records.size() > capacity) {
            records.pollFirst();
        }
    }

    public List<SecurityAuditRecord> snapshot() {
        return List.copyOf(new ArrayList<>(records));
    }
}
