package com.englishflow.media.domain;

/** Trusted command shape. Tenant and owner are deliberately absent; they come from the principal. */
public record MediaAssetDraft(
        String assetId,
        String assetKey,
        MediaKind kind,
        String mimeType,
        String storageProvider,
        String bucketName,
        String objectKey,
        String objectVersion,
        String checksumSha256,
        long sizeBytes,
        boolean supportsRange,
        long chunkSizeBytes,
        int partCount,
        MediaContentReference contentReference,
        MediaRightsReference rightsReference) {

    public MediaAssetDraft {
        assetId = MediaValidation.id(assetId, "assetId");
    }
}
