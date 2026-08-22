package com.englishflow.media.domain;

/** Manifest entry with only a rendition reference and integrity metadata. */
public record MediaManifestItem(
        String renditionKey,
        String mimeType,
        String checksumSha256,
        long sizeBytes,
        boolean supportsRange,
        RenditionStatus status) {

    public MediaManifestItem {
        renditionKey = MediaValidation.id(renditionKey, "renditionKey");
        mimeType = MediaValidation.text(mimeType, "mimeType", 128);
        checksumSha256 = MediaValidation.sha256(checksumSha256, "checksumSha256");
        sizeBytes = MediaValidation.positive(sizeBytes, "sizeBytes");
        if (status == null) {
            throw MediaOperationException.badRequest("MEDIA_MANIFEST_INVALID", "manifest rendition status is required");
        }
    }
}
