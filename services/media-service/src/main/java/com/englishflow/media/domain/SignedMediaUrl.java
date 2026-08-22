package com.englishflow.media.domain;

import java.time.Instant;

/** Short-lived opaque grant; it contains no media bytes and is never a permanent object URL. */
public record SignedMediaUrl(
        String assetId,
        int assetVersion,
        String token,
        String url,
        MediaDeliveryChannel channel,
        ByteRange range,
        String checksumSha256,
        long sizeBytes,
        Instant issuedAt,
        Instant expiresAt) {

    public SignedMediaUrl {
        assetId = MediaValidation.id(assetId, "assetId");
        if (assetVersion <= 0 || token == null || token.isBlank() || url == null || url.isBlank() || channel == null || range == null) {
            throw MediaOperationException.badRequest("MEDIA_SIGNED_URL_INVALID", "signed URL facts are incomplete");
        }
        checksumSha256 = MediaValidation.sha256(checksumSha256, "checksumSha256");
        sizeBytes = MediaValidation.positive(sizeBytes, "sizeBytes");
        if (issuedAt == null || expiresAt == null || !expiresAt.isAfter(issuedAt)) {
            throw MediaOperationException.badRequest("MEDIA_SIGNED_URL_WINDOW_INVALID", "signed URL expiry must be after issue time");
        }
    }
}
