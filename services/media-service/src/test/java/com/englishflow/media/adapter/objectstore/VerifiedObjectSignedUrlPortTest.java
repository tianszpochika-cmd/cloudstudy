package com.englishflow.media.adapter.objectstore;

import com.englishflow.media.domain.ByteRange;
import com.englishflow.media.domain.MediaAsset;
import com.englishflow.media.domain.MediaAuthorizationContext;
import com.englishflow.media.domain.MediaContentReference;
import com.englishflow.media.domain.MediaDeliveryChannel;
import com.englishflow.media.domain.MediaKind;
import com.englishflow.media.domain.MediaOperationException;
import com.englishflow.media.domain.MediaRightsReference;
import com.englishflow.media.domain.MediaRightsStatus;
import com.englishflow.media.port.MediaObjectStorePort;

import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class VerifiedObjectSignedUrlPortTest {

    private static final String HASH = "a".repeat(64);
    private static final Instant NOW = Instant.parse("2026-09-23T00:00:00Z");

    @Test
    void signsOnlyTheInspectedVersionedObjectAndRevokesTheValidationGrant() {
        StubStore store = new StubStore(new MediaObjectStorePort.ObjectState(1024, "version-1", HASH, "audio/mpeg"));
        var signer = new VerifiedObjectSignedUrlPort(store, "media-private");
        MediaAsset asset = asset("media-private", "version-1");
        var context = context();
        ByteRange range = new ByteRange(0, 127, 1024);

        signer.verifyObjectForActivation(asset);
        var signed = signer.issue(asset, context, MediaDeliveryChannel.STREAM, range, NOW, NOW.plusSeconds(60));
        assertEquals("https://objects.example.test/signed-get", signed.url());
        assertEquals(asset.objectKey(), store.inspectedKey);
        assertEquals(range, store.signedRange);
        assertFalse(signed.url().contains(asset.assetId()));
        assertEquals(range, signer.verify(signed.token(), asset, context, range, NOW.plusSeconds(1)).range());

        signer.revokeAsset(asset.assetId());
        assertEquals("MEDIA_URL_REVOKED", assertThrows(MediaOperationException.class,
                () -> signer.verify(signed.token(), asset, context, range, NOW.plusSeconds(2))).code());
    }

    @Test
    void missingOrConflictingObjectFactsNeverCreateAPlayableUrl() {
        var asset = asset("media-private", "version-1");
        var state = new MediaObjectStorePort.ObjectState(1024, "version-1", HASH, "audio/mpeg");
        for (var conflicting : new MediaObjectStorePort.ObjectState[] {
                null,
                new MediaObjectStorePort.ObjectState(1023, "version-1", HASH, "audio/mpeg"),
                new MediaObjectStorePort.ObjectState(1024, "version-2", HASH, "audio/mpeg"),
                new MediaObjectStorePort.ObjectState(1024, "version-1", "b".repeat(64), "audio/mpeg"),
                new MediaObjectStorePort.ObjectState(1024, "version-1", null, "audio/mpeg"),
                new MediaObjectStorePort.ObjectState(1024, "version-1", HASH, "text/plain")
        }) {
            StubStore store = new StubStore(conflicting);
            var signer = new VerifiedObjectSignedUrlPort(store, "media-private");
            assertEquals("MEDIA_OBJECT_INTEGRITY_UNVERIFIED", assertThrows(MediaOperationException.class,
                    () -> signer.issue(asset, context(), MediaDeliveryChannel.STREAM,
                            ByteRange.entire(1024), NOW, NOW.plusSeconds(60))).code());
            assertEquals("MEDIA_OBJECT_INTEGRITY_UNVERIFIED", assertThrows(MediaOperationException.class,
                    () -> signer.verifyObjectForActivation(asset)).code());
            assertFalse(store.presignCalled);
        }
        StubStore store = new StubStore(state);
        var signer = new VerifiedObjectSignedUrlPort(store, "media-private");
        assertEquals("MEDIA_OBJECT_VERSION_REQUIRED", assertThrows(MediaOperationException.class,
                () -> signer.issue(asset("media-private", null), context(), MediaDeliveryChannel.STREAM,
                        ByteRange.entire(1024), NOW, NOW.plusSeconds(60))).code());
        assertFalse(store.presignCalled);
    }

    @Test
    void rejectsOtherBucketsAndTheUnimplementedRecordingUploadPath() {
        StubStore store = new StubStore(new MediaObjectStorePort.ObjectState(1024, "version-1", HASH, "audio/mpeg"));
        var signer = new VerifiedObjectSignedUrlPort(store, "media-private");
        assertEquals("MEDIA_OBJECT_BUCKET_MISMATCH", assertThrows(MediaOperationException.class,
                () -> signer.issue(asset("other-bucket", "version-1"), context(), MediaDeliveryChannel.STREAM,
                        ByteRange.entire(1024), NOW, NOW.plusSeconds(60))).code());
        assertEquals("MEDIA_UPLOAD_NOT_CONFIGURED", assertThrows(MediaOperationException.class,
                () -> signer.issue(asset("media-private", "version-1"), context(), MediaDeliveryChannel.RECORDING,
                        ByteRange.entire(1024), NOW, NOW.plusSeconds(60))).code());
        assertFalse(store.presignCalled);
    }

    private static MediaAsset asset(String bucket, String version) {
        MediaAsset created = MediaAsset.create("asset-1", "tenant-1", "owner-1", "lesson-audio",
                MediaKind.AUDIO, "audio/mpeg", "MINIO", bucket, "tenant-1/lesson/audio.mp3", version,
                HASH, 1024, true, 256, 4,
                new MediaContentReference("content-1", "LISTENING_AUDIO", null),
                new MediaRightsReference("rights-1", "content-1", "LESSON_STREAM",
                        MediaRightsStatus.ACTIVE, Set.of("STREAM"), NOW.minusSeconds(10),
                        NOW.plusSeconds(120), false, "rights-evidence-1"), NOW);
        return created.markActive(HASH, 1024, NOW);
    }

    private static MediaAuthorizationContext context() {
        return MediaAuthorizationContext.verified("owner-1", "tenant-1", Set.of("learner"),
                Set.of("media:read"), "PHASE_1", Set.of("rights-1"), true, true, "test-request");
    }

    private static final class StubStore implements MediaObjectStorePort {
        private final ObjectState state;
        private String inspectedKey;
        private ByteRange signedRange;
        private boolean presignCalled;

        private StubStore(ObjectState state) { this.state = state; }

        @Override
        public ObjectState stat(MediaAsset asset) {
            inspectedKey = asset.objectKey();
            return state;
        }

        @Override
        public String presignGet(MediaAsset asset, ByteRange range, Instant issuedAt, Instant expiresAt) {
            presignCalled = true;
            signedRange = range;
            assertTrue(expiresAt.isAfter(issuedAt));
            return "https://objects.example.test/signed-get";
        }
    }
}
