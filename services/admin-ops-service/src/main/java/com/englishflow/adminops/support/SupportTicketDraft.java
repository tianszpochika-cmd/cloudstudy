package com.englishflow.adminops.support;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

import com.englishflow.adminops.domain.AdminOpsException;

/** Client input for a ticket; only a fingerprint and media references cross this boundary. */
public record SupportTicketDraft(
        TicketCategory category,
        String resourceRef,
        String descriptionFingerprint,
        TicketPriority priority,
        List<MediaObjectRef> attachments) {

    private static final Pattern SAFE_REF = Pattern.compile("[A-Za-z0-9._:/-]{1,160}");
    private static final Pattern FINGERPRINT = Pattern.compile("[0-9a-fA-F]{64}");
    private static final Set<String> ALLOWED_UNTRUSTED_KEYS = Set.of(
            "category", "resourceRef", "descriptionFingerprint", "priority", "attachments");
    private static final Set<String> FORBIDDEN_RAW_KEYS = Set.of(
            "description", "message", "body", "comment", "freeText", "file", "fileBytes", "bytes", "url", "filename");

    public SupportTicketDraft {
        if (category == null || priority == null) {
            throw AdminOpsException.invalid("SUPPORT_TICKET_SCHEMA_INVALID", "category and priority are required");
        }
        resourceRef = safe(resourceRef, "resourceRef");
        descriptionFingerprint = descriptionFingerprint == null ? null : descriptionFingerprint.trim();
        if (descriptionFingerprint == null || !FINGERPRINT.matcher(descriptionFingerprint).matches()) {
            throw AdminOpsException.invalid(
                    "SUPPORT_RAW_TEXT_REJECTED", "descriptionFingerprint must be a SHA-256 fingerprint, not free text");
        }
        attachments = attachments == null ? List.of() : List.copyOf(attachments);
        if (attachments.size() > 5) {
            throw AdminOpsException.invalid("SUPPORT_ATTACHMENT_LIMIT", "at most five media references are allowed");
        }
    }

    /** Explicit untrusted-boundary parser used by the pure smoke and by future adapters. */
    public static SupportTicketDraft fromUntrusted(Map<String, Object> body) {
        if (body == null) {
            throw AdminOpsException.invalid("SUPPORT_TICKET_SCHEMA_INVALID", "request body is required");
        }
        for (String key : body.keySet()) {
            if (FORBIDDEN_RAW_KEYS.contains(key) || !ALLOWED_UNTRUSTED_KEYS.contains(key)) {
                throw AdminOpsException.invalid("SUPPORT_RAW_TEXT_REJECTED", "ticket accepts metadata and media refs only");
            }
        }
        String category = requiredString(body.get("category"), "category");
        String resourceRef = requiredString(body.get("resourceRef"), "resourceRef");
        String fingerprint = requiredString(body.get("descriptionFingerprint"), "descriptionFingerprint");
        String priority = requiredString(body.get("priority"), "priority");
        Object rawAttachments = body.get("attachments");
        List<MediaObjectRef> attachments = new ArrayList<>();
        if (rawAttachments != null) {
            if (!(rawAttachments instanceof List<?> values)) {
                throw AdminOpsException.invalid("SUPPORT_ATTACHMENT_SCHEMA_INVALID", "attachments must be media references");
            }
            for (Object value : values) {
                if (!(value instanceof MediaObjectRef mediaObjectRef)) {
                    throw AdminOpsException.invalid(
                            "SUPPORT_ATTACHMENT_SCHEMA_INVALID", "attachments must be typed media object references");
                }
                attachments.add(mediaObjectRef);
            }
        }
        try {
            return new SupportTicketDraft(
                    TicketCategory.valueOf(category),
                    resourceRef,
                    fingerprint,
                    TicketPriority.valueOf(priority),
                    attachments);
        } catch (IllegalArgumentException exception) {
            throw AdminOpsException.invalid("SUPPORT_TICKET_ENUM_INVALID", "ticket category or priority is not allowlisted");
        }
    }

    private static String requiredString(Object value, String field) {
        if (value == null || value.toString().isBlank()) {
            throw AdminOpsException.invalid("SUPPORT_TICKET_SCHEMA_INVALID", field + " is required");
        }
        return value.toString().trim();
    }

    private static String safe(String value, String field) {
        String normalized = value == null ? null : value.trim();
        if (normalized == null || normalized.isBlank() || !SAFE_REF.matcher(normalized).matches()) {
            throw AdminOpsException.invalid("SUPPORT_TICKET_SCHEMA_INVALID", field + " must be an opaque reference");
        }
        return normalized;
    }
}
