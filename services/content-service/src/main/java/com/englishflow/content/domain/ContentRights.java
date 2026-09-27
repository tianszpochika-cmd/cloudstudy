package com.englishflow.content.domain;

import java.time.Instant;
import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.Locale;
import java.util.Objects;
import java.util.Set;

/**
 * Copyright/license fact attached to every version.
 *
 * <p>A version without this fact is never publishable and is never eligible for a public or
 * learner projection. Redis/cache state cannot make an expired or revoked right valid.</p>
 */
public record ContentRights(
        String sourceCode,
        String licenseCode,
        CopyrightStatus status,
        boolean allowsLearning,
        Set<String> permittedChannels,
        Instant startsAt,
        Instant expiresAt,
        String authorizationEvidenceRef) {

    public ContentRights {
        sourceCode = requireText(sourceCode, "sourceCode");
        licenseCode = requireText(licenseCode, "licenseCode");
        Objects.requireNonNull(status, "copyright status is required");
        permittedChannels = normalizeChannels(permittedChannels, status, allowsLearning);
        if (expiresAt != null && startsAt != null && !expiresAt.isAfter(startsAt)) {
            throw ContentOperationException.badRequest(
                    "CONTENT_RIGHTS_WINDOW_INVALID", "copyright expiry must be after its start");
        }
        if (allowsLearning && (authorizationEvidenceRef == null || authorizationEvidenceRef.isBlank())) {
            throw ContentOperationException.badRequest(
                    "CONTENT_RIGHTS_EVIDENCE_REQUIRED", "learning rights require authorization evidence");
        }
        authorizationEvidenceRef = authorizationEvidenceRef == null ? null : authorizationEvidenceRef.trim();
    }

    public boolean allows(ContentChannel channel, Instant now) {
        Objects.requireNonNull(channel, "content channel is required");
        Objects.requireNonNull(now, "current time is required");
        if (status != CopyrightStatus.ACTIVE || !allowsLearning) {
            return false;
        }
        if (startsAt != null && now.isBefore(startsAt)) {
            return false;
        }
        if (expiresAt != null && !now.isBefore(expiresAt)) {
            return false;
        }
        String requested = channel.name();
        return permittedChannels.contains("*") || permittedChannels.contains(requested);
    }

    public boolean isActive(Instant now) {
        return status == CopyrightStatus.ACTIVE
                && (startsAt == null || now.isAfter(startsAt) || now.equals(startsAt))
                && (expiresAt == null || now.isBefore(expiresAt));
    }

    /**
     * Whether this rights fact carries a complete submission dossier, regardless
     * of verification state. PENDING means "editor-claimed, L2-unverified"; the
     * dossier (evidence, learning grant, LEARNER+PUBLIC channels, valid window)
     * is what the submit gate checks, and L2 final approval verifies it before
     * activation. Client-supplied ACTIVE is never honored at the boundary.
     */
    public boolean isAttestedForReview(Instant now) {
        Objects.requireNonNull(now, "current time is required");
        if (sourceCode == null || sourceCode.isBlank()
                || licenseCode == null || licenseCode.isBlank()
                || authorizationEvidenceRef == null || authorizationEvidenceRef.isBlank()
                || !allowsLearning
                || (!permittedChannels.contains("*")
                        && !(permittedChannels.contains("LEARNER") && permittedChannels.contains("PUBLIC")))
                || (startsAt != null && now.isBefore(startsAt))
                || (expiresAt != null && !now.isBefore(expiresAt))) {
            return false;
        }
        return true;
    }

    private static String requireText(String value, String field) {
        if (value == null || value.isBlank() || value.length() > 128) {
            throw ContentOperationException.badRequest("CONTENT_RIGHTS_INVALID", field + " is required");
        }
        return value.trim();
    }

    private static Set<String> normalizeChannels(
            Set<String> channels, CopyrightStatus status, boolean allowsLearning) {
        if (channels == null || channels.isEmpty()) {
            // An unverified draft grants no distribution channel. Active rights still
            // require an explicit channel list before they can be used.
            if (status == CopyrightStatus.PENDING && !allowsLearning && channels != null) {
                return Set.of();
            }
            throw ContentOperationException.badRequest(
                    "CONTENT_RIGHTS_CHANNELS_REQUIRED", "copyright permitted channels are required");
        }
        LinkedHashSet<String> normalized = new LinkedHashSet<>();
        for (String channel : channels) {
            if (channel == null || channel.isBlank()) {
                throw ContentOperationException.badRequest(
                        "CONTENT_RIGHTS_CHANNELS_INVALID", "copyright channel is invalid");
            }
            normalized.add(channel.trim().toUpperCase(Locale.ROOT));
        }
        return Collections.unmodifiableSet(normalized);
    }
}
