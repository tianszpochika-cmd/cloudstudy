package com.englishflow.media.adapter.objectstore;

import com.englishflow.media.adapter.memory.InMemorySignedUrlPort;
import com.englishflow.media.domain.ByteRange;
import com.englishflow.media.domain.MediaAsset;
import com.englishflow.media.domain.MediaAuthorizationContext;
import com.englishflow.media.domain.MediaDeliveryChannel;
import com.englishflow.media.domain.MediaOperationException;
import com.englishflow.media.domain.SignedMediaUrl;
import com.englishflow.media.domain.SignedUrlGrant;
import com.englishflow.media.port.MediaObjectStorePort;
import com.englishflow.media.port.SignedUrlPort;

import java.time.Instant;
import java.util.Locale;
import java.util.Objects;

/**
 * Local-real delivery adapter. A metadata-only READY flag cannot produce a URL until the
 * exact versioned object, whole-object checksum, size and MIME are confirmed by storage.
 */
public final class VerifiedObjectSignedUrlPort implements SignedUrlPort {

    private final MediaObjectStorePort objectStore;
    private final String allowedBucket;
    private final InMemorySignedUrlPort grants =
            new InMemorySignedUrlPort("https://media.example.invalid/unreturned-grant");

    public VerifiedObjectSignedUrlPort(MediaObjectStorePort objectStore, String allowedBucket) {
        this.objectStore = Objects.requireNonNull(objectStore, "objectStore is required");
        if (allowedBucket == null || allowedBucket.isBlank()) {
            throw new IllegalArgumentException("an allowed media bucket is required");
        }
        this.allowedBucket = allowedBucket;
    }

    @Override
    public void verifyObjectForActivation(MediaAsset asset) {
        requireVerifiedObject(asset);
    }

    @Override
    public SignedMediaUrl issue(MediaAsset asset, MediaAuthorizationContext context,
            MediaDeliveryChannel channel, ByteRange range, Instant issuedAt, Instant expiresAt) {
        // The recording upload flow needs a separate verified PUT intent. A GET signature here
        // would be a false upload success, so it stays unavailable.
        if (channel == MediaDeliveryChannel.RECORDING) {
            throw MediaOperationException.unavailable(
                    "MEDIA_UPLOAD_NOT_CONFIGURED", "recording upload delivery is not configured");
        }
        requireVerifiedObject(asset);
        String url = objectStore.presignGet(asset, range, issuedAt, expiresAt);
        if (url == null || url.isBlank()) {
            throw MediaOperationException.unavailable(
                    "MEDIA_OBJECT_SIGNATURE_UNAVAILABLE", "media object signature is unavailable");
        }
        // The in-memory grant is retained only for the existing validate endpoint. Its dummy
        // URL is never returned; MinIO's own signature is the only playable URL.
        SignedMediaUrl grant = grants.issue(asset, context, channel, range, issuedAt, expiresAt);
        return new SignedMediaUrl(asset.assetId(), asset.assetVersion(), grant.token(), url,
                channel, range, asset.checksumSha256(), asset.sizeBytes(), issuedAt, expiresAt);
    }

    private void requireVerifiedObject(MediaAsset asset) {
        if (!allowedBucket.equals(asset.bucketName())) {
            throw MediaOperationException.unavailable(
                    "MEDIA_OBJECT_BUCKET_MISMATCH", "media object is outside the configured bucket");
        }
        String provider = asset.storageProvider().toUpperCase(Locale.ROOT);
        if (!provider.equals("MINIO") && !provider.equals("S3") && !provider.equals("LOCAL_OBJECT_STORE")) {
            throw MediaOperationException.unavailable(
                    "MEDIA_OBJECT_PROVIDER_UNSUPPORTED", "media object provider is unsupported");
        }
        if (asset.objectVersion() == null || asset.objectVersion().isBlank()) {
            throw MediaOperationException.unavailable(
                    "MEDIA_OBJECT_VERSION_REQUIRED", "media object version has not been verified");
        }
        MediaObjectStorePort.ObjectState state = objectStore.stat(asset);
        if (state == null
                || state.sizeBytes() != asset.sizeBytes()
                || !asset.objectVersion().equals(state.versionId())
                || state.checksumSha256() == null
                || !asset.checksumSha256().equalsIgnoreCase(state.checksumSha256())
                || state.contentType() == null
                || !asset.mimeType().equalsIgnoreCase(state.contentType())) {
            throw MediaOperationException.unavailable(
                    "MEDIA_OBJECT_INTEGRITY_UNVERIFIED", "media object integrity is not verified");
        }
    }

    @Override
    public SignedUrlGrant verify(String token, MediaAsset asset, MediaAuthorizationContext context,
            ByteRange requestedRange, Instant now) {
        return grants.verify(token, asset, context, requestedRange, now);
    }

    @Override
    public void revokeAsset(String assetId) {
        grants.revokeAsset(assetId);
    }
}
