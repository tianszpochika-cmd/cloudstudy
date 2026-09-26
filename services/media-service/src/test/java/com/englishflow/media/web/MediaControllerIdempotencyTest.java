package com.englishflow.media.web;

import com.englishflow.media.adapter.failclosed.FailClosedSignedUrlPort;
import com.englishflow.media.adapter.memory.InMemoryMediaEventOutbox;
import com.englishflow.media.adapter.memory.InMemoryMediaRepository;
import com.englishflow.media.adapter.memory.InMemoryMediaWriteIdempotency;
import com.englishflow.media.adapter.memory.InMemorySignedUrlPort;
import com.englishflow.media.application.MediaAssetCommandService;
import com.englishflow.media.application.MediaReadService;
import com.englishflow.media.domain.MediaAuthorizationContext;
import com.englishflow.media.domain.MediaKind;
import com.englishflow.media.domain.MediaOperationException;
import com.englishflow.media.domain.MediaRightsStatus;
import com.englishflow.media.domain.TranscodingStatus;
import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class MediaControllerIdempotencyTest {

    private static final String HASH = "a".repeat(64);
    private static final String OTHER_HASH = "b".repeat(64);
    private static final Instant NOW = Instant.parse("2026-09-23T00:00:00Z");

    @Test
    void fourCommandRoutesReplayOriginalBodyWithoutAnotherMutationOrEvent() {
        var repository = new InMemoryMediaRepository();
        var outbox = new InMemoryMediaEventOutbox();
        var signer = new InMemorySignedUrlPort("https://media.example.invalid/fixture");
        Clock clock = Clock.fixed(NOW, ZoneOffset.UTC);
        var commands = new MediaAssetCommandService(repository, signer, outbox, clock);
        var reads = new MediaReadService(repository, signer, clock,
                Duration.ofMinutes(5), Duration.ofMinutes(15));
        var controller = new MediaController(commands, reads, new InMemoryMediaWriteIdempotency());
        var auth = authentication();
        var register = new MediaController.RegisterRequest(
                "asset-1", "course-audio-1", MediaKind.AUDIO, "audio/mpeg", "S3",
                "media-bucket", "tenant-1/asset-1.mp3", "v1", HASH, 1024,
                true, 256, 4, "301", "LEARNING_AUDIO", "segment-1", "rights-1",
                "LESSON_STREAM", MediaRightsStatus.ACTIVE, Set.of("STREAM", "RECORDING"),
                NOW.minusSeconds(60), NOW.plusSeconds(3600), false, "rights-evidence-1");

        Map<String, Object> registered = controller.register("register-key-001", register, auth).getBody();
        assertEquals(1, version(registered));
        var activation = new MediaController.ActivationRequest(HASH, 1024);
        Map<String, Object> active = controller.activate("asset-1", "activate-key-001", activation, auth);
        assertEquals(2, version(active));
        assertEquals(registered, controller.register("register-key-001", register, auth).getBody());
        assertEquals(active, controller.activate("asset-1", "activate-key-001", activation, auth));
        assertEquals(2, outbox.snapshot().size());

        var subtitle = new MediaController.SubtitleRequest("zh-CN", "VTT", HASH, 64);
        Map<String, Object> subtitled = controller.subtitle("asset-1", "subtitle-key-001", subtitle, auth);
        assertEquals(3, version(subtitled));
        assertEquals(subtitled, controller.subtitle("asset-1", "subtitle-key-001", subtitle, auth));
        assertEquals("MEDIA_IDEMPOTENCY_CONFLICT", assertThrows(MediaOperationException.class,
                () -> controller.subtitle("asset-1", "subtitle-key-001",
                        new MediaController.SubtitleRequest("zh-CN", "VTT", OTHER_HASH, 64), auth)).code());
        assertEquals(3, outbox.snapshot().size());

        commands.updateTranscoding("asset-1", TranscodingStatus.FAILED, "CODEC_FAILED", principal());
        Map<String, Object> retried = controller.retry("asset-1", "retry-key-001", auth);
        assertEquals(retried, controller.retry("asset-1", "retry-key-001", auth));
        assertEquals(5, outbox.snapshot().size());
        assertEquals(5, repository.findById("asset-1").orElseThrow().assetVersion());
        assertEquals("MEDIA_NOTHING_TO_RETRY", assertThrows(MediaOperationException.class,
                () -> controller.retry("asset-1", "retry-key-002", auth)).code());
    }

    @Test
    void activationRequiresInspectedObjectAndDoesNotCommitAClaimedChecksum() {
        var repository = new InMemoryMediaRepository();
        var outbox = new InMemoryMediaEventOutbox();
        Clock clock = Clock.fixed(NOW, ZoneOffset.UTC);
        var registrar = new MediaAssetCommandService(repository,
                new InMemorySignedUrlPort("https://media.example.invalid/fixture"), outbox, clock);
        registrar.register(new com.englishflow.media.domain.MediaAssetDraft(
                "asset-unuploaded", "course-audio-unuploaded", MediaKind.AUDIO, "audio/mpeg", "S3",
                "media-bucket", "tenant-1/unuploaded.mp3", "v1", HASH, 1024,
                false, 0, 0,
                new com.englishflow.media.domain.MediaContentReference("301", "LEARNING_AUDIO", null),
                new com.englishflow.media.domain.MediaRightsReference("rights-1", "301", "LESSON_STREAM",
                        MediaRightsStatus.PENDING, Set.of("STREAM"), null, null, false, null)),
                principal(), "register-unuploaded-001");
        var commands = new MediaAssetCommandService(repository, new FailClosedSignedUrlPort(), outbox, clock);
        assertEquals("MEDIA_OBJECT_STORE_NOT_CONFIGURED", assertThrows(MediaOperationException.class,
                () -> commands.markActive("asset-unuploaded", HASH, 1024, principal())).code());
        assertEquals(1, repository.findById("asset-unuploaded").orElseThrow().assetVersion());
        assertEquals(1, outbox.snapshot().size());
    }

    private static int version(Map<String, Object> body) {
        return ((Number) ((Map<?, ?>) body.get("asset")).get("assetVersion")).intValue();
    }

    private static MediaAuthorizationContext principal() {
        return MediaAuthorizationContext.verified(
                "owner-1", "platform", Set.of("learner"), Set.of("media:write", "media:read"),
                "PHASE_1", Set.of("rights-1"), true, true, "request-test");
    }

    private static JwtAuthenticationToken authentication() {
        Jwt jwt = Jwt.withTokenValue("synthetic-token")
                .header("alg", "RS256")
                .subject("owner-1")
                .issuedAt(NOW)
                .expiresAt(NOW.plusSeconds(3600))
                .claim("tenant_id", "platform")
                .claim("roles", List.of("learner"))
                .claim("permissions", List.of("media:write", "media:read"))
                .claim("phase", "PHASE_1")
                .claim("media_consent", true)
                .claim("device_trusted", true)
                .claim("content_rights", List.of("rights-1"))
                .build();
        return new JwtAuthenticationToken(jwt, Set.of(), jwt.getSubject());
    }
}
