package com.englishflow.media.domain;

import java.time.Instant;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Media-service aggregate. It is deliberately metadata-only: storage adapters keep object bytes
 * outside this aggregate and outside events/logs.
 */
public record MediaAsset(
        String assetId,
        String tenantId,
        String ownerId,
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
        MediaAssetStatus status,
        TranscodingStatus transcodingStatus,
        MediaContentReference contentReference,
        MediaRightsReference rightsReference,
        List<MediaRendition> renditions,
        int assetVersion,
        Instant createdAt,
        Instant updatedAt) {

    public MediaAsset {
        assetId = MediaValidation.id(assetId, "assetId");
        tenantId = MediaValidation.id(tenantId, "tenantId");
        ownerId = MediaValidation.id(ownerId, "ownerId");
        assetKey = MediaValidation.text(assetKey, "assetKey", 160);
        if (kind == null) {
            throw MediaOperationException.badRequest("MEDIA_KIND_REQUIRED", "media kind is required");
        }
        mimeType = MediaValidation.text(mimeType, "mimeType", 128);
        storageProvider = MediaValidation.text(storageProvider, "storageProvider", 32);
        bucketName = MediaValidation.text(bucketName, "bucketName", 128);
        objectKey = MediaValidation.text(objectKey, "objectKey", 512);
        if (objectKey.contains("?") || objectKey.contains("#") || objectKey.startsWith("http://") || objectKey.startsWith("https://")) {
            throw MediaOperationException.badRequest("MEDIA_OBJECT_REFERENCE_INVALID", "objectKey must be an object reference, not a URL");
        }
        objectVersion = MediaValidation.optionalText(objectVersion, "objectVersion", 128);
        checksumSha256 = MediaValidation.sha256(checksumSha256, "checksumSha256");
        sizeBytes = MediaValidation.positive(sizeBytes, "sizeBytes");
        if (supportsRange) {
            chunkSizeBytes = MediaValidation.positive(chunkSizeBytes, "chunkSizeBytes");
            partCount = MediaValidation.positive(partCount, "partCount");
        } else {
            chunkSizeBytes = 0;
            partCount = 0;
        }
        if (status == null || transcodingStatus == null || contentReference == null || rightsReference == null) {
            throw MediaOperationException.badRequest("MEDIA_FACTS_INCOMPLETE", "status, transcoding, content and rights facts are required");
        }
        if (!rightsReference.contentVersionId().equals(contentReference.contentVersionId())) {
            throw MediaOperationException.badRequest("MEDIA_CONTENT_VERSION_MISMATCH", "content and rights versions must match");
        }
        if (assetVersion <= 0) {
            throw MediaOperationException.badRequest("MEDIA_VERSION_INVALID", "assetVersion must be positive");
        }
        if (createdAt == null || updatedAt == null) {
            throw MediaOperationException.badRequest("MEDIA_TIMESTAMP_INVALID", "createdAt and updatedAt are required");
        }
        if (updatedAt.isBefore(createdAt)) {
            throw MediaOperationException.badRequest("MEDIA_TIMESTAMP_INVALID", "updatedAt cannot precede createdAt");
        }
        renditions = renditions == null ? List.of() : List.copyOf(renditions);
    }

    public static MediaAsset create(
            String assetId,
            String tenantId,
            String ownerId,
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
            MediaRightsReference rightsReference,
            Instant now) {
        return new MediaAsset(
                assetId, tenantId, ownerId, assetKey, kind, mimeType, storageProvider, bucketName,
                objectKey, objectVersion, checksumSha256, sizeBytes, supportsRange, chunkSizeBytes,
                partCount, MediaAssetStatus.UPLOADING, TranscodingStatus.NOT_REQUIRED,
                contentReference, rightsReference, List.of(), 1, now, now);
    }

    public boolean revoked() {
        return status == MediaAssetStatus.REVOKED || status == MediaAssetStatus.DELETED;
    }

    public boolean readyForDelivery() {
        return status == MediaAssetStatus.ACTIVE
                && (transcodingStatus == TranscodingStatus.NOT_REQUIRED || transcodingStatus == TranscodingStatus.READY);
    }

    public MediaAsset markActive(String verifiedChecksumSha256, long verifiedSizeBytes, Instant now) {
        if (!checksumSha256.equalsIgnoreCase(verifiedChecksumSha256) || sizeBytes != verifiedSizeBytes) {
            throw MediaOperationException.conflict("MEDIA_CHECKSUM_MISMATCH", "object checksum or size does not match metadata");
        }
        if (revoked()) {
            throw MediaOperationException.forbidden("MEDIA_REVOKED", "revoked media cannot be activated");
        }
        return copy(MediaAssetStatus.ACTIVE, transcodingStatus, renditions, now);
    }

    public MediaAsset withTranscoding(TranscodingStatus nextStatus, String failureCode, Instant now) {
        if (nextStatus == null) {
            throw MediaOperationException.badRequest("MEDIA_TRANSCODING_STATUS_INVALID", "transcoding status is required");
        }
        if (nextStatus == TranscodingStatus.FAILED) {
            MediaValidation.text(failureCode, "failureCode", 96);
        }
        return copy(status, nextStatus, renditions, now);
    }

    public MediaAsset withRendition(MediaRendition rendition, Instant now) {
        if (rendition == null) {
            throw MediaOperationException.badRequest("MEDIA_RENDITION_REQUIRED", "rendition is required");
        }
        Map<String, MediaRendition> byKey = new LinkedHashMap<>();
        for (MediaRendition existing : renditions) {
            byKey.put(existing.renditionKey(), existing);
        }
        byKey.put(rendition.renditionKey(), rendition);
        return copy(status, transcodingStatus, List.copyOf(byKey.values()), now);
    }

    public MediaAsset revoke(Instant now) {
        return copy(MediaAssetStatus.REVOKED, transcodingStatus, renditions, now);
    }

    public Map<String, Object> safeView() {
        Map<String, Object> view = new LinkedHashMap<>();
        view.put("assetId", assetId);
        view.put("assetVersion", assetVersion);
        view.put("assetKey", assetKey);
        view.put("kind", kind.name());
        view.put("mimeType", mimeType);
        view.put("checksumSha256", checksumSha256);
        view.put("sizeBytes", sizeBytes);
        view.put("supportsRange", supportsRange);
        view.put("status", status.name());
        view.put("transcodingStatus", transcodingStatus.name());
        view.put("contentVersionId", contentReference.contentVersionId());
        view.put("contentRole", contentReference.role());
        view.put("rightsId", rightsReference.rightsId());
        view.put("rightsStatus", rightsReference.status().name());
        view.put("renditionCount", renditions.size());
        view.put("createdAt", createdAt.toString());
        view.put("updatedAt", updatedAt.toString());
        return Map.copyOf(view);
    }

    private MediaAsset copy(
            MediaAssetStatus nextStatus,
            TranscodingStatus nextTranscodingStatus,
            List<MediaRendition> nextRenditions,
            Instant now) {
        return new MediaAsset(
                assetId, tenantId, ownerId, assetKey, kind, mimeType, storageProvider, bucketName,
                objectKey, objectVersion, checksumSha256, sizeBytes, supportsRange, chunkSizeBytes,
                partCount, nextStatus, nextTranscodingStatus, contentReference, rightsReference,
                Collections.unmodifiableList(nextRenditions), assetVersion + 1, createdAt, now);
    }
}
