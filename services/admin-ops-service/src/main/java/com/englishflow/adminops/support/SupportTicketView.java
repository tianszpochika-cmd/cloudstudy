package com.englishflow.adminops.support;

import java.time.Instant;
import java.util.List;

/** Redacted support representation: no subject ID, PII, original text, URL or file bytes. */
public record SupportTicketView(
        String ticketId,
        String requesterRef,
        TicketCategory category,
        String resourceRef,
        TicketState state,
        TicketPriority priority,
        SlaStatus slaStatus,
        Instant slaDueAt,
        String assigneeRef,
        String descriptionFingerprint,
        List<MediaObjectView> attachments,
        String lastAuditId,
        long version) {

    public SupportTicketView {
        attachments = attachments == null ? List.of() : List.copyOf(attachments);
    }
}
