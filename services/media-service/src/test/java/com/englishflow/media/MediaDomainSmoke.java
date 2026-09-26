package com.englishflow.media;

import com.englishflow.media.adapter.failclosed.FailClosedSignedUrlPort;
import com.englishflow.media.adapter.memory.InMemoryMediaEventOutbox;
import com.englishflow.media.adapter.memory.InMemoryMediaRepository;
import com.englishflow.media.adapter.memory.InMemorySignedUrlPort;
import com.englishflow.media.application.MediaAssetCommandService;
import com.englishflow.media.application.MediaReadService;
import com.englishflow.media.domain.MediaAsset;
import com.englishflow.media.domain.MediaAssetDraft;
import com.englishflow.media.domain.MediaAuthorizationContext;
import com.englishflow.media.domain.MediaContentReference;
import com.englishflow.media.domain.MediaKind;
import com.englishflow.media.domain.MediaOperationException;
import com.englishflow.media.domain.MediaRenditionDraft;
import com.englishflow.media.domain.MediaRightsReference;
import com.englishflow.media.domain.MediaRightsStatus;
import com.englishflow.media.domain.RenditionStatus;
import com.englishflow.media.domain.SignedMediaUrl;
import com.englishflow.media.domain.TranscodingStatus;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Set;

public final class MediaDomainSmoke {

    private static final String HASH = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

    private MediaDomainSmoke() {
    }

    public static void main(String[] args) {
        Instant now = Instant.parse("2026-08-22T00:00:00Z");
        Clock clock = Clock.fixed(now, ZoneOffset.UTC);
        var repository = new InMemoryMediaRepository();
        var signer = new InMemorySignedUrlPort("https://media.example.invalid/objects");
        var outbox = new InMemoryMediaEventOutbox();
        var commands = new MediaAssetCommandService(repository, signer, outbox, clock);
        var reads = new MediaReadService(repository, signer, clock, Duration.ofMinutes(5), Duration.ofMinutes(15));
        var owner = MediaAuthorizationContext.verified(
                "learner-1", "tenant-1", Set.of("learner"),
                Set.of("media:write", "media:read", "media:download"), "PHASE_1",
                Set.of("rights-1"), true, true, "smoke-request");

        MediaAssetDraft draft = new MediaAssetDraft(
                "media-b11-0001", "lesson-301-audio", MediaKind.AUDIO, "audio/mpeg", "s3",
                "learning-media", "tenant-1/content-301/audio.mp3", "v1", HASH, 1024,
                true, 256, 4,
                new MediaContentReference("cv-301", "LISTENING_AUDIO", "segment-1"),
                new MediaRightsReference(
                        "rights-1", "cv-301", "LESSON_STREAM", MediaRightsStatus.ACTIVE,
                        Set.of("STREAM", "DOWNLOAD", "OFFLINE"), now.minusSeconds(1),
                        now.plusSeconds(3600), true, "rights-evidence-1"));
        MediaAsset asset = commands.register(draft, owner, "register-media-a");
        MediaAsset replayed = commands.register(draft, owner, "register-media-a");
        check(asset.assetId().equals(replayed.assetId()), "idempotent registration must replay the same asset");
        String assetId = asset.assetId();
        check(asset.status().name().equals("UPLOADING"), "new asset must be uploading");
        expect(MediaOperationException.class,
                () -> commands.markActive(assetId, "b".repeat(64), 1024, owner),
                "checksum mismatch must deny activation");
        var unconfiguredCommands = new MediaAssetCommandService(
                repository, new FailClosedSignedUrlPort(), outbox, clock);
        MediaOperationException unavailable = expect(MediaOperationException.class,
                () -> unconfiguredCommands.markActive(assetId, HASH, 1024, owner),
                "unverified bytes must deny activation");
        check("MEDIA_OBJECT_STORE_NOT_CONFIGURED".equals(unavailable.code()),
                "missing object store must explain the denied activation");
        check(repository.findById(assetId).orElseThrow().assetVersion() == 1
                        && outbox.snapshot().size() == 1,
                "denied activation must not advance asset or outbox");

        asset = commands.markActive(assetId, HASH, 1024, owner);
        asset = commands.upsertRendition(assetId, new MediaRenditionDraft(
                "high", "audio/aac", "rendition-v1", HASH, 1024, true,
                RenditionStatus.READY, null), owner);
        check(reads.manifest(assetId, owner).items().size() == 2, "ready rendition must appear in manifest");
        commands.upsertRendition(assetId, new MediaRenditionDraft(
                "failed", "audio/aac", "rendition-v2", HASH, 1024, true,
                RenditionStatus.FAILED, "TRANSCODE_CODEC_UNSUPPORTED"), owner);
        check(reads.manifest(assetId, owner).items().stream()
                .anyMatch(item -> item.renditionKey().equals("failed") && item.status() == RenditionStatus.FAILED),
                "failed rendition must remain observable as failed metadata");
        SignedMediaUrl signed = reads.issueSignedUrl(
                assetId, com.englishflow.media.domain.MediaDeliveryChannel.STREAM,
                "bytes=0-127", Duration.ofMinutes(5), owner);
        check(signed.range().length() == 128, "Range must be metadata-only and bounded");
        var grant = reads.validateSignedUrl(signed.token(), assetId, "bytes=0-127", owner);
        check(grant.range().length() == 128, "signed Range must validate");
        check(reads.manifest(assetId, owner).items().size() == 3, "manifest must expose original and rendition metadata");

        expect(MediaOperationException.class,
                () -> reads.issueSignedUrl(assetId, com.englishflow.media.domain.MediaDeliveryChannel.STREAM,
                        "bytes=900-1200", Duration.ofMinutes(5), owner),
                "out-of-bounds Range must deny");
        expect(MediaOperationException.class,
                () -> reads.describe(assetId, MediaAuthorizationContext.anonymous()),
                "anonymous access must default deny");
        expect(MediaOperationException.class,
                () -> reads.describe(assetId, MediaAuthorizationContext.verified(
                        "learner-2", "tenant-2", Set.of("learner"), Set.of("media:read"),
                        "PHASE_1", Set.of("rights-1"), true, true, "cross-tenant")),
                "cross-tenant access must deny");
        expect(MediaOperationException.class,
                () -> reads.describe(assetId, MediaAuthorizationContext.verified(
                        "learner-2", "tenant-1", Set.of("learner"), Set.of("media:read"),
                        "PHASE_1", Set.of(), true, true, "cross-owner")),
                "cross-owner access without content right must deny");

        commands.updateTranscoding(assetId, TranscodingStatus.FAILED, "TRANSCODE_CODEC_UNSUPPORTED", owner);
        expect(MediaOperationException.class,
                () -> reads.issueSignedUrl(assetId, com.englishflow.media.domain.MediaDeliveryChannel.STREAM,
                        null, Duration.ofMinutes(5), owner),
                "transcode failure must produce no playable URL");

        MediaReadService expiredReads = new MediaReadService(
                repository, signer, Clock.fixed(now.plusSeconds(301), ZoneOffset.UTC),
                Duration.ofMinutes(5), Duration.ofMinutes(15));
        expect(MediaOperationException.class,
                () -> expiredReads.validateSignedUrl(signed.token(), assetId, "bytes=0-127", owner),
                "expired URL must deny");

        commands.revoke(assetId, "rights-revoked", owner);
        expect(MediaOperationException.class,
                () -> reads.issueSignedUrl(assetId, com.englishflow.media.domain.MediaDeliveryChannel.STREAM,
                        null, Duration.ofMinutes(5), owner),
                "revoked asset must deny");
        check(outbox.snapshot().stream().allMatch(event -> event.payload().values().stream()
                .noneMatch(value -> value.contains("raw") || value.contains("bytes"))),
                "events must not carry raw media data");
        System.out.println("media-service MED-001 smoke: PASS");
    }

    private static void check(boolean value, String message) {
        if (!value) {
            throw new AssertionError(message);
        }
    }

    private static <T extends Throwable> T expect(Class<T> type, Runnable action, String message) {
        try {
            action.run();
        } catch (Throwable error) {
            if (type.isInstance(error)) {
                return type.cast(error);
            }
            throw new AssertionError(message + ": wrong exception", error);
        }
        throw new AssertionError(message + ": exception expected");
    }
}
