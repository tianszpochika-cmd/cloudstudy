package com.englishflow.media.application;

import com.englishflow.media.domain.ByteRange;
import com.englishflow.media.domain.MediaAsset;
import com.englishflow.media.domain.MediaAssetStatus;
import com.englishflow.media.domain.MediaAuthorizationContext;
import com.englishflow.media.domain.MediaDeliveryChannel;
import com.englishflow.media.domain.MediaManifest;
import com.englishflow.media.domain.MediaManifestItem;
import com.englishflow.media.domain.MediaOperationException;
import com.englishflow.media.domain.MediaRendition;
import com.englishflow.media.domain.RenditionStatus;
import com.englishflow.media.domain.SignedMediaUrl;
import com.englishflow.media.domain.SignedUrlGrant;
import com.englishflow.media.domain.TranscodingStatus;
import com.englishflow.media.port.MediaRepository;
import com.englishflow.media.port.SignedUrlPort;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

/** Metadata, manifest and short-lived access reads. No method returns media bytes. */
public final class MediaReadService {

    private final MediaRepository repository;
    private final SignedUrlPort signedUrlPort;
    private final Clock clock;
    private final Duration defaultTtl;
    private final Duration maxTtl;

    public MediaReadService(
            MediaRepository repository,
            SignedUrlPort signedUrlPort,
            Clock clock,
            Duration defaultTtl,
            Duration maxTtl) {
        this.repository = Objects.requireNonNull(repository, "repository is required");
        this.signedUrlPort = Objects.requireNonNull(signedUrlPort, "signedUrlPort is required");
        this.clock = Objects.requireNonNull(clock, "clock is required");
        this.defaultTtl = requirePositive(defaultTtl, "defaultTtl");
        this.maxTtl = requirePositive(maxTtl, "maxTtl");
        if (this.defaultTtl.compareTo(this.maxTtl) > 0) {
            throw new IllegalArgumentException("default signed URL TTL cannot exceed max TTL");
        }
    }

    public MediaAsset describe(String assetId, MediaAuthorizationContext context) {
        MediaAsset asset = require(assetId);
        MediaAccessPolicy.requireRead(asset, context, MediaDeliveryChannel.STREAM, clock.instant());
        return asset;
    }

    public MediaManifest manifest(String assetId, MediaAuthorizationContext context) {
        MediaAsset asset = require(assetId);
        MediaAccessPolicy.requireRead(asset, context, MediaDeliveryChannel.STREAM, clock.instant());
        List<MediaManifestItem> items = new ArrayList<>();
        RenditionStatus originalStatus = asset.readyForDelivery() ? RenditionStatus.READY : RenditionStatus.PROCESSING;
        items.add(new MediaManifestItem(
                "original", asset.mimeType(), asset.checksumSha256(), asset.sizeBytes(), asset.supportsRange(), originalStatus));
        for (MediaRendition rendition : asset.renditions()) {
            items.add(new MediaManifestItem(
                    rendition.renditionKey(), rendition.mimeType(), rendition.checksumSha256(), rendition.sizeBytes(),
                    rendition.supportsRange(), rendition.status()));
        }
        return new MediaManifest(
                asset.assetId(), asset.assetVersion(), asset.contentReference().contentVersionId(),
                asset.checksumSha256(), asset.sizeBytes(), asset.mimeType(), asset.supportsRange(),
                asset.status(), asset.transcodingStatus(), asset.rightsReference().status(), items, clock.instant());
    }

    public SignedMediaUrl issueSignedUrl(
            String assetId,
            MediaDeliveryChannel channel,
            String rangeHeader,
            Duration requestedTtl,
            MediaAuthorizationContext context) {
        MediaAsset asset = require(assetId);
        Instant now = clock.instant();
        MediaAccessPolicy.requireRead(asset, context, channel, now);
        if (!asset.readyForDelivery()) {
            throw MediaOperationException.unavailable("MEDIA_NOT_READY", "media object is not ready for delivery");
        }
        ByteRange range = ByteRange.parse(rangeHeader, asset.sizeBytes(), asset.supportsRange());
        Duration ttl = normalizeTtl(requestedTtl);
        return signedUrlPort.issue(asset, context, channel, range, now, now.plus(ttl));
    }

    public SignedUrlGrant validateSignedUrl(
            String token,
            String assetId,
            String rangeHeader,
            MediaAuthorizationContext context) {
        MediaAsset asset = require(assetId);
        Instant now = clock.instant();
        ByteRange range = ByteRange.parse(rangeHeader, asset.sizeBytes(), asset.supportsRange());
        SignedUrlGrant grant = signedUrlPort.verify(token, asset, context, range, now);
        MediaAccessPolicy.requireRead(asset, context, grant.channel(), now);
        return grant;
    }

    private Duration normalizeTtl(Duration requestedTtl) {
        if (requestedTtl == null || requestedTtl.isZero() || requestedTtl.isNegative()) {
            return defaultTtl;
        }
        if (requestedTtl.compareTo(maxTtl) > 0) {
            throw MediaOperationException.badRequest("MEDIA_SIGNED_URL_TTL_INVALID", "requested TTL exceeds service maximum");
        }
        return requestedTtl;
    }

    private MediaAsset require(String assetId) {
        if (assetId == null || assetId.isBlank()) {
            throw MediaOperationException.badRequest("MEDIA_ASSET_ID_REQUIRED", "assetId is required");
        }
        return repository.findById(assetId)
                .orElseThrow(() -> MediaOperationException.notFound("MEDIA_ASSET_NOT_FOUND", "media asset does not exist"));
    }

    private static Duration requirePositive(Duration value, String field) {
        if (value == null || value.isZero() || value.isNegative()) {
            throw new IllegalArgumentException(field + " must be positive");
        }
        return value;
    }
}
