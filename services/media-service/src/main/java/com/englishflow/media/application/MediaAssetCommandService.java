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
        // Hex form on both sides: the rendering is unbounded, the durable
        // column is CHAR(64) (M3-004).
        String fingerprint = MediaRegistrationIdempotencyPort.fingerprintHex(draft.toString());
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

    /** Recheck the current owner permission before returning a stored command response. */
    public void authorizeMutation(String assetId, MediaAuthorizationContext context) {
        MediaAccessPolicy.requireMutation(require(assetId), context);
    }

    public MediaAsset markActive(
            String assetId,
            String verifiedChecksumSha256,
            long verifiedSizeBytes,
            MediaAuthorizationContext context) {
        MediaAsset asset = require(assetId);
        MediaAccessPolicy.requireMutation(asset, context);
        MediaAsset candidate = asset.markActive(verifiedChecksumSha256, verifiedSizeBytes, clock.instant());
        // The request's checksum and size are assertions, not proof of uploaded bytes.
        // The storage adapter must inspect the exact object version before ACTIVE is saved.
        signedUrlPort.verifyObjectForActivation(asset);
        MediaAsset saved = repository.save(candidate);
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

    /**
     * M3-004 failure retry workbench: FAILED transcoding and FAILED renditions return to
     * QUEUED for another attempt. Nothing is deleted; the retry is a state transition that
     * is itself audited via the domain event below. At least one FAILED unit is required.
     */
    public MediaAsset retryFailed(String assetId, MediaAuthorizationContext context) {
        MediaAsset asset = require(assetId);
        MediaAccessPolicy.requireMutation(asset, context);
        boolean transcodingFailed = asset.transcodingStatus() == TranscodingStatus.FAILED;
        long failedRenditions = asset.renditions().stream()
                .filter(r -> r.status() == com.englishflow.media.domain.RenditionStatus.FAILED).count();
        if (!transcodingFailed && failedRenditions == 0) {
            throw MediaOperationException.conflict("MEDIA_NOTHING_TO_RETRY", "no failed transcoding or rendition to retry");
        }
        Instant now = clock.instant();
        MediaAsset next = asset;
        if (transcodingFailed) {
            next = repository.save(next.withTranscoding(TranscodingStatus.QUEUED, null, now));
        }
        for (MediaRendition failed : next.renditions().stream()
                .filter(r -> r.status() == com.englishflow.media.domain.RenditionStatus.FAILED).toList()) {
            MediaRendition queued = new MediaRendition(
                    failed.renditionKey(), failed.mimeType(), failed.objectVersion(), failed.checksumSha256(),
                    failed.sizeBytes(), failed.supportsRange(),
                    com.englishflow.media.domain.RenditionStatus.QUEUED, now, null);
            next = repository.save(next.withRendition(queued, now));
        }
        publish("media.retry_requested.v1", next, context, Map.of(
                "assetVersion", Integer.toString(next.assetVersion())));
        return next;
    }

    /**
     * M3-004 subtitle track: stored as a rendition with a reserved key so playback,
     * manifests and revocation keep working without a new table. Format allow-list
     * keeps the workbench honest (VTT/SRT only).
     */
    public MediaAsset upsertSubtitle(
            String assetId, String locale, String format, String checksumSha256, long sizeBytes,
            MediaAuthorizationContext context) {
        MediaAsset asset = require(assetId);
        MediaAccessPolicy.requireMutation(asset, context);
        String safeLocale = locale == null ? "" : locale.trim();
        if (!safeLocale.equalsIgnoreCase("zh-CN") && !safeLocale.equalsIgnoreCase("en-US")) {
            throw MediaOperationException.badRequest("MEDIA_SUBTITLE_LOCALE_INVALID", "subtitle locale must be zh-CN or en-US");
        }
        String safeFormat = format == null ? "" : format.trim().toUpperCase(java.util.Locale.ROOT);
        if (!safeFormat.equals("VTT") && !safeFormat.equals("SRT")) {
            throw MediaOperationException.badRequest("MEDIA_SUBTITLE_FORMAT_INVALID", "subtitle format must be VTT or SRT");
        }
        String mimeType = safeFormat.equals("VTT") ? "text/vtt" : "application/x-subrip";
        MediaRendition rendition = new MediaRendition(
                "subtitle:" + safeLocale.toLowerCase(java.util.Locale.ROOT) + ":" + safeFormat,
                mimeType, null, checksumSha256, sizeBytes, false,
                com.englishflow.media.domain.RenditionStatus.READY, clock.instant(), null);
        MediaAsset saved = repository.save(asset.withRendition(rendition, clock.instant()));
        publish("media.subtitle_updated.v1", saved, context, Map.of(
                "renditionKey", rendition.renditionKey(),
                "assetVersion", Integer.toString(saved.assetVersion())));
        return saved;
    }

    /**
     * M5-004 waveform peaks: the client extracts peaks with the Web Audio API and
     * registers them here; the service stores them as a reserved rendition and serves
     * them to any owner reader. Peaks are display metadata, never audio bytes, and the
     * rendition checksum covers the canonical peaks payload.
     */
    public MediaAsset upsertWaveform(
            String assetId, java.util.List<Double> peaks, long sampleCount, long durationMs, String extractor,
            MediaAuthorizationContext context) {
        MediaAsset asset = require(assetId);
        MediaAccessPolicy.requireMutation(asset, context);
        if (peaks == null || peaks.size() < 32 || peaks.size() > 256) {
            throw MediaOperationException.badRequest("MEDIA_WAVEFORM_PEAKS_INVALID", "peaks must contain 32..256 entries");
        }
        for (Double peak : peaks) {
            if (peak == null || peak < 0.0 || peak > 1.0) {
                throw MediaOperationException.badRequest("MEDIA_WAVEFORM_PEAKS_INVALID", "peaks must be in [0,1]");
            }
        }
        if (sampleCount < 1 || durationMs < 1) {
            throw MediaOperationException.badRequest("MEDIA_WAVEFORM_META_INVALID", "sampleCount and durationMs are required");
        }
        String safeExtractor = extractor == null || extractor.isBlank() ? "web-audio-v1"
                : extractor.trim().substring(0, Math.min(extractor.trim().length(), 64));
        String canonical = peaks.stream().map(p -> String.format(java.util.Locale.ROOT, "%.4f", p))
                .collect(java.util.stream.Collectors.joining(","));
        String checksum;
        try {
            java.security.MessageDigest digest = java.security.MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest((assetId + "|" + canonical + "|" + sampleCount).getBytes(java.nio.charset.StandardCharsets.UTF_8));
            StringBuilder hex = new StringBuilder();
            for (byte b : hash) hex.append(String.format("%02x", b));
            checksum = hex.toString();
        } catch (java.security.NoSuchAlgorithmException impossible) {
            throw new IllegalStateException(impossible);
        }
        MediaRendition rendition = new MediaRendition(
                "waveform:peaks:v1", "application/json", null, checksum, canonical.length(), false,
                com.englishflow.media.domain.RenditionStatus.READY, clock.instant(), null);
        MediaAsset saved = repository.save(asset.withRendition(rendition, clock.instant()));
        publish("media.waveform_updated.v1", saved, context, Map.of(
                "renditionKey", rendition.renditionKey(),
                "peakCount", Integer.toString(peaks.size()),
                "sampleCount", Long.toString(sampleCount),
                "durationMs", Long.toString(durationMs),
                "extractor", safeExtractor,
                "assetVersion", Integer.toString(saved.assetVersion())));
        return saved;
    }

    public MediaAsset revoke(String assetId, String reason, MediaAuthorizationContext context) {        MediaAsset asset = require(assetId);
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
