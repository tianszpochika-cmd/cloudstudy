package com.englishflow.media.application;

import com.englishflow.media.domain.MediaAsset;
import com.englishflow.media.domain.MediaAssetDraft;
import com.englishflow.media.domain.MediaAssetStatus;
import com.englishflow.media.domain.MediaAuthorizationContext;
import com.englishflow.media.domain.MediaEvent;
import com.englishflow.media.domain.MediaOperationException;
import com.englishflow.media.domain.MediaRendition;
import com.englishflow.media.domain.MediaRenditionDraft;
import com.englishflow.media.domain.TranscodingStatus;
import com.englishflow.media.port.MediaEventPort;
import com.englishflow.media.port.MediaRepository;
import com.englishflow.media.port.MediaRegistrationIdempotencyPort;
import com.englishflow.media.port.SignedUrlPort;

import java.time.Clock;
import java.time.Instant;
import java.util.Map;
import java.util.Objects;

/** Commands for metadata, object verification, transcoding state and revocation. */
public final class MediaAssetCommandService {

    private final MediaRepository repository;
    private final SignedUrlPort signedUrlPort;
    private final MediaEventPort eventPort;
    private final MediaRegistrationIdempotencyPort idempotencyPort;
    private final Clock clock;

    public MediaAssetCommandService(
            MediaRepository repository,
            SignedUrlPort signedUrlPort,
            MediaEventPort eventPort,
            Clock clock) {
        this(repository, signedUrlPort, eventPort,
                new com.englishflow.media.adapter.memory.InMemoryMediaRegistrationIdempotencyStore(), clock);
    }

    public MediaAssetCommandService(
            MediaRepository repository,
            SignedUrlPort signedUrlPort,
            MediaEventPort eventPort,
            MediaRegistrationIdempotencyPort idempotencyPort,
            Clock clock) {
        this.repository = Objects.requireNonNull(repository, "repository is required");
        this.signedUrlPort = Objects.requireNonNull(signedUrlPort, "signedUrlPort is required");
        this.eventPort = Objects.requireNonNull(eventPort, "eventPort is required");
        this.idempotencyPort = Objects.requireNonNull(idempotencyPort, "idempotencyPort is required");
        this.clock = Objects.requireNonNull(clock, "clock is required");
    }

    /**
     * Idempotent metadata registration. The key is scoped by verified tenant and subject; the
     * request fingerprint contains metadata only and never an object payload.
     */
    public synchronized MediaAsset register(
            MediaAssetDraft draft,
            MediaAuthorizationContext context,
            String idempotencyKey) {
        Objects.requireNonNull(draft, "draft is required");
        MediaAccessPolicy.requireWrite(context);
        String key = normalizeIdempotencyKey(idempotencyKey);
        String fingerprint = draft.toString();
        MediaRegistrationIdempotencyPort.RegistrationReceipt previous =
                idempotencyPort.find(context.tenantId(), context.subjectId(), key).orElse(null);
        if (previous != null) {
            if (!previous.fingerprint().equals(fingerprint)) {
                throw MediaOperationException.conflict(
                        "MEDIA_IDEMPOTENCY_CONFLICT",
                        "Idempotency-Key was already used for another media registration");
            }
            return repository.findById(previous.assetId())
                    .orElseThrow(() -> MediaOperationException.notFound(
                            "MEDIA_ASSET_NOT_FOUND", "idempotent media asset is unavailable"));
        }
        if (repository.findById(draft.assetId()).isPresent()) {
            throw MediaOperationException.conflict("MEDIA_ASSET_EXISTS", "media asset already exists");
        }
        Instant now = clock.instant();
        MediaAsset asset = MediaAsset.create(
                draft.assetId(), context.tenantId(), context.subjectId(), draft.assetKey(), draft.kind(),
                draft.mimeType(), draft.storageProvider(), draft.bucketName(), draft.objectKey(),
                draft.objectVersion(), draft.checksumSha256(), draft.sizeBytes(), draft.supportsRange(),
                draft.chunkSizeBytes(), draft.partCount(), draft.contentReference(), draft.rightsReference(), now);
        MediaAsset saved = repository.save(asset);
        idempotencyPort.save(
                context.tenantId(), context.subjectId(), key,
                new MediaRegistrationIdempotencyPort.RegistrationReceipt(fingerprint, saved.assetId()));
        publish("media.asset_registered.v1", saved, context, Map.of(
                "checksumSha256", saved.checksumSha256(),
                "sizeBytes", Long.toString(saved.sizeBytes()),
                "contentVersionId", saved.contentReference().contentVersionId(),
                "assetVersion", Integer.toString(saved.assetVersion())));
        return saved;
    }

    private static String normalizeIdempotencyKey(String value) {
        if (value == null || !value.matches("[A-Za-z0-9._:-]{8,128}")) {
            throw MediaOperationException.badRequest(
                    "MEDIA_IDEMPOTENCY_KEY_INVALID", "Idempotency-Key is required and has an unsafe format");
        }
        return value;
    }

    public MediaAsset markActive(
            String assetId,
            String verifiedChecksumSha256,
            long verifiedSizeBytes,
            MediaAuthorizationContext context) {
        MediaAsset asset = require(assetId);
        MediaAccessPolicy.requireMutation(asset, context);
        MediaAsset saved = repository.save(asset.markActive(verifiedChecksumSha256, verifiedSizeBytes, clock.instant()));
        publish("media.asset_activated.v1", saved, context, Map.of(
                "checksumSha256", saved.checksumSha256(),
                "sizeBytes", Long.toString(saved.sizeBytes()),
                "assetVersion", Integer.toString(saved.assetVersion())));
        return saved;
    }

    public MediaAsset updateTranscoding(
            String assetId,
            TranscodingStatus status,
            String failureCode,
            MediaAuthorizationContext context) {
        MediaAsset asset = require(assetId);
        MediaAccessPolicy.requireMutation(asset, context);
        MediaAsset saved = repository.save(asset.withTranscoding(status, failureCode, clock.instant()));
        String safeFailureCode = failureCode == null || failureCode.isBlank() ? "" : failureCode.trim();
        publish("media.transcoding_updated.v1", saved, context, Map.of(
                "status", status.name(),
                "failureCode", safeFailureCode,
                "assetVersion", Integer.toString(saved.assetVersion())));
        return saved;
    }

    public MediaAsset upsertRendition(
            String assetId,
            MediaRenditionDraft draft,
            MediaAuthorizationContext context) {
        MediaAsset asset = require(assetId);
        MediaAccessPolicy.requireMutation(asset, context);
        MediaRendition rendition = new MediaRendition(
                draft.renditionKey(), draft.mimeType(), draft.objectVersion(), draft.checksumSha256(),
                draft.sizeBytes(), draft.supportsRange(), draft.status(), clock.instant(), draft.failureCode());
        MediaAsset saved = repository.save(asset.withRendition(rendition, clock.instant()));
        publish("media.rendition_updated.v1", saved, context, Map.of(
                "renditionKey", rendition.renditionKey(),
                "status", rendition.status().name(),
                "checksumSha256", rendition.checksumSha256(),
                "sizeBytes", Long.toString(rendition.sizeBytes()),
                "assetVersion", Integer.toString(saved.assetVersion())));
        return saved;
    }

    public MediaAsset revoke(String assetId, String reason, MediaAuthorizationContext context) {
        MediaAsset asset = require(assetId);
        MediaAccessPolicy.requireMutation(asset, context);
        String safeReason = reason == null || reason.isBlank() ? "UNSPECIFIED" : reason.trim();
        if (safeReason.length() > 96) {
            throw MediaOperationException.badRequest("MEDIA_REVOCATION_REASON_INVALID", "revocation reason is too long");
        }
        MediaAsset saved = repository.save(asset.revoke(clock.instant()));
        signedUrlPort.revokeAsset(saved.assetId());
        publish("media.asset_revoked.v1", saved, context, Map.of(
                "reason", safeReason,
                "assetVersion", Integer.toString(saved.assetVersion())));
        return saved;
    }

    private MediaAsset require(String assetId) {
        return repository.findById(assetId)
                .orElseThrow(() -> MediaOperationException.notFound("MEDIA_ASSET_NOT_FOUND", "media asset does not exist"));
    }

    private void publish(String eventName, MediaAsset asset, MediaAuthorizationContext context, Map<String, String> payload) {
        eventPort.append(MediaEvent.create(eventName, clock.instant(), asset.assetId(), context.tenantId(), context.subjectId(), payload));
    }
}
