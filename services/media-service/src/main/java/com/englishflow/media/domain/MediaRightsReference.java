package com.englishflow.media.domain;

import java.time.Instant;
import java.util.Set;

/** Copyright/license reference evaluated on every media read; it is never inferred client-side. */
public record MediaRightsReference(
        String rightsId,
        String contentVersionId,
        String licenseCode,
        MediaRightsStatus status,
        Set<String> permittedChannels,
        Instant startsAt,
        Instant expiresAt,
        boolean allowOffline,
        String authorizationEvidenceRef) {

    public MediaRightsReference {
        rightsId = MediaValidation.id(rightsId, "rightsId");
        contentVersionId = MediaValidation.id(contentVersionId, "contentVersionId");
        licenseCode = MediaValidation.text(licenseCode, "licenseCode", 96);
        if (status == null) {
            throw MediaOperationException.badRequest("MEDIA_RIGHTS_INVALID", "rights status is required");
        }
        permittedChannels = MediaValidation.upperSet(permittedChannels, "permittedChannels");
        if (expiresAt != null && startsAt != null && !expiresAt.isAfter(startsAt)) {
            throw MediaOperationException.badRequest("MEDIA_RIGHTS_WINDOW_INVALID", "rights expiry must be after start");
        }
        authorizationEvidenceRef = MediaValidation.optionalText(authorizationEvidenceRef, "authorizationEvidenceRef", 256);
        if (status == MediaRightsStatus.ACTIVE && authorizationEvidenceRef == null) {
            throw MediaOperationException.badRequest("MEDIA_RIGHTS_EVIDENCE_REQUIRED", "active rights require authorization evidence");
        }
    }

    public boolean allows(MediaDeliveryChannel channel, Instant now) {
        if (channel == null || now == null || status != MediaRightsStatus.ACTIVE) {
            return false;
        }
        if (startsAt != null && now.isBefore(startsAt)) {
            return false;
        }
        if (expiresAt != null && !now.isBefore(expiresAt)) {
            return false;
        }
        if (channel == MediaDeliveryChannel.OFFLINE && !allowOffline) {
            return false;
        }
        return permittedChannels.contains("*") || permittedChannels.contains(channel.name());
    }
}
