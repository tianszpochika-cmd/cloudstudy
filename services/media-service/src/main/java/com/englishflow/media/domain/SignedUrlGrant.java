package com.englishflow.media.domain;

import java.time.Instant;

/** Server-side validation record for an opaque signed grant; only the token digest is retained. */
public record SignedUrlGrant(
        String tokenDigest,
        String assetId,
        int assetVersion,
        String tenantId,
        String subjectId,
        MediaDeliveryChannel channel,
        ByteRange range,
        Instant expiresAt,
        boolean revoked) {

    public SignedUrlGrant {
        tokenDigest = MediaValidation.sha256(tokenDigest, "tokenDigest");
        assetId = MediaValidation.id(assetId, "assetId");
        tenantId = MediaValidation.id(tenantId, "tenantId");
        subjectId = MediaValidation.id(subjectId, "subjectId");
        if (assetVersion <= 0 || channel == null || range == null || expiresAt == null) {
            throw MediaOperationException.badRequest("MEDIA_GRANT_INVALID", "signed grant facts are incomplete");
        }
    }

    public boolean expired(Instant now) {
        return now == null || !now.isBefore(expiresAt);
    }
}
