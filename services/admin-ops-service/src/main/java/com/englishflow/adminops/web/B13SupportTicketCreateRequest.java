package com.englishflow.adminops.web;

import com.englishflow.adminops.domain.AdminOpsException;
import com.englishflow.adminops.support.MediaObjectRef;
import com.englishflow.adminops.support.SupportTicketDraft;
import com.englishflow.adminops.support.TicketCategory;
import com.englishflow.adminops.support.TicketPriority;
import java.util.List;
import java.util.Locale;

/** Canonical B13 support input; raw text is intentionally not part of the request. */
public record B13SupportTicketCreateRequest(
        String categoryCode,
        String resourceRef,
        String descriptionFingerprint,
        TicketPriority priority,
        List<MediaObjectRef> attachments) {

    public SupportTicketDraft toDraft() {
        TicketCategory category;
        try {
            category = TicketCategory.valueOf(required(categoryCode, "categoryCode").toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException exception) {
            throw AdminOpsException.invalid("SUPPORT_TICKET_ENUM_INVALID", "categoryCode is not allowlisted");
        }
        return new SupportTicketDraft(category, resourceRef, descriptionFingerprint, priority, attachments);
    }

    private static String required(String value, String field) {
        if (value == null || value.isBlank()) {
            throw AdminOpsException.invalid("SUPPORT_TICKET_SCHEMA_INVALID", field + " is required");
        }
        return value.trim();
    }
}
