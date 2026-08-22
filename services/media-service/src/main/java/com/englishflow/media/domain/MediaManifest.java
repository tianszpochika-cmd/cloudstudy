package com.englishflow.media.domain;

import java.time.Instant;
import java.util.List;

/** Metadata-only manifest. A client must request a separate short-lived URL for delivery. */
public record MediaManifest(
        String assetId,
        int assetVersion,
        String contentVersionId,
        String checksumSha256,
        long sizeBytes,
        String mimeType,
        boolean supportsRange,
        MediaAssetStatus assetStatus,
        TranscodingStatus transcodingStatus,
        MediaRightsStatus rightsStatus,
        List<MediaManifestItem> items,
        Instant generatedAt) {

    public MediaManifest {
        assetId = MediaValidation.id(assetId, "assetId");
        contentVersionId = MediaValidation.id(contentVersionId, "contentVersionId");
        checksumSha256 = MediaValidation.sha256(checksumSha256, "checksumSha256");
        sizeBytes = MediaValidation.positive(sizeBytes, "sizeBytes");
        mimeType = MediaValidation.text(mimeType, "mimeType", 128);
        if (assetVersion <= 0 || assetStatus == null || transcodingStatus == null || rightsStatus == null || generatedAt == null) {
            throw MediaOperationException.badRequest("MEDIA_MANIFEST_INVALID", "manifest facts are incomplete");
        }
        items = items == null ? List.of() : List.copyOf(items);
    }
}
