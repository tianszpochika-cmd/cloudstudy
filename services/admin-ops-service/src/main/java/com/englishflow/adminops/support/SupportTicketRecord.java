package com.englishflow.adminops.support;

import java.time.Instant;
import java.util.List;

/** Durable admin-ops-owned support ticket state; it contains metadata and fingerprints only. */
public record SupportTicketRecord(
        String ticketId,
        String tenantId,
        String requesterSubjectId,
        TicketCategory category,
        String resourceRef,
        String descriptionFingerprint,
        TicketPriority priority,
        List<MediaObjectRef> attachments,
        Instant createdAt,
        Instant slaDueAt,
        TicketState state,
        String assigneeSubjectId,
        String lastAuditId,
        long version) {

    public SupportTicketRecord {
        attachments = attachments == null ? List.of() : List.copyOf(attachments);
    }
}
