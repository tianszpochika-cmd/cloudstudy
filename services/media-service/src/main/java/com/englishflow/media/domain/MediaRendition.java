package com.englishflow.media.domain;

import java.time.Instant;

/** A derived object variant. It has a storage reference and checksum, never a byte payload. */
public record MediaRendition(
        String renditionKey,
        String mimeType,
        String objectVersion,
        String checksumSha256,
        long sizeBytes,
        boolean supportsRange,
        RenditionStatus status,
        Instant updatedAt,
        String failureCode) {

    public MediaRendition {
        renditionKey = MediaValidation.id(renditionKey, "renditionKey");
        mimeType = MediaValidation.text(mimeType, "mimeType", 128);
        objectVersion = MediaValidation.optionalText(objectVersion, "objectVersion", 128);
        checksumSha256 = MediaValidation.sha256(checksumSha256, "checksumSha256");
        sizeBytes = MediaValidation.positive(sizeBytes, "sizeBytes");
        if (status == null) {
            throw MediaOperationException.badRequest("MEDIA_RENDITION_INVALID", "rendition status is required");
        }
        if (updatedAt == null) {
            throw MediaOperationException.badRequest("MEDIA_RENDITION_INVALID", "rendition updatedAt is required");
        }
        failureCode = MediaValidation.optionalText(failureCode, "failureCode", 96);
        if (status == RenditionStatus.FAILED && failureCode == null) {
            throw MediaOperationException.badRequest("MEDIA_RENDITION_FAILURE_CODE_REQUIRED", "failed rendition requires a failure code");
        }
    }

    public boolean available() {
        return status == RenditionStatus.READY;
    }
}
