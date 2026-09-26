package com.englishflow.adminops.domain;

import java.util.List;

/** A bounded tenant-scoped audit slice. The sequence stays inside the owner service. */
public record AuditPage(List<AuditRecord> items, Long nextSequence) {
    public AuditPage {
        items = List.copyOf(items);
        if (nextSequence != null && nextSequence <= 0) {
            throw new IllegalArgumentException("next audit sequence must be positive");
        }
    }

    public boolean hasMore() {
        return nextSequence != null;
    }
}
