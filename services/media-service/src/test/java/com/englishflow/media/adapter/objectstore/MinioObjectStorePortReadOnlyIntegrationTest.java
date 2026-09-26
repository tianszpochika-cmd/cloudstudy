package com.englishflow.media.adapter.objectstore;

import com.englishflow.media.domain.ByteRange;
import com.englishflow.media.domain.MediaAsset;
import com.englishflow.media.domain.MediaContentReference;
import com.englishflow.media.domain.MediaKind;
import com.englishflow.media.domain.MediaRightsReference;
import com.englishflow.media.domain.MediaRightsStatus;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.Assumptions;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.Instant;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** Opt-in read-only transport check against an already existing private MinIO object. */
class MinioObjectStorePortReadOnlyIntegrationTest {

    @Test
    void aRealPresignedUrlReturnsOneByteRangeWithoutLoggingTheUrlOrAudio() throws Exception {
        String access = System.getenv("MEDIA_TEST_MINIO_ACCESS_KEY");
        String secret = System.getenv("MEDIA_TEST_MINIO_SECRET_KEY");
        String objectKey = System.getenv("MEDIA_TEST_MINIO_OBJECT_KEY");
        Assumptions.assumeTrue(nonBlank(access) && nonBlank(secret) && nonBlank(objectKey));
        long size = Long.parseLong(System.getenv("MEDIA_TEST_MINIO_OBJECT_SIZE"));
        String endpoint = "http://127.0.0.1:19000";
        var store = new MinioObjectStorePort(endpoint, endpoint, access, secret, "us-east-1");
        Instant now = Instant.now();
        MediaAsset asset = MediaAsset.create("transport-check", "tenant-test", "owner-test", "existing-object",
                MediaKind.AUDIO, "audio/mpeg", "MINIO", "yuxuexing-local", objectKey, null,
                "a".repeat(64), size, true, size, 1,
                new MediaContentReference("content-test", "TRANSPORT_CHECK", null),
                new MediaRightsReference("rights-test", "content-test", "TRANSPORT_CHECK",
                        MediaRightsStatus.ACTIVE, Set.of("STREAM"), now.minusSeconds(1),
                        now.plusSeconds(90), false, "read-only-transport-check"), now);
        var state = store.stat(asset);
        assertEquals(size, state.sizeBytes());
        String signedUrl = store.presignGet(asset, ByteRange.entire(size), now, now.plusSeconds(30));
        HttpRequest request = HttpRequest.newBuilder(URI.create(signedUrl))
                .timeout(Duration.ofSeconds(10)).header("Range", "bytes=0-0").GET().build();
        HttpResponse<byte[]> response = HttpClient.newHttpClient().send(request, HttpResponse.BodyHandlers.ofByteArray());
        assertEquals(206, response.statusCode());
        assertEquals(1, response.body().length);
        assertTrue(response.headers().firstValue("content-range").orElse("").startsWith("bytes 0-0/"));

        String partialUrl = store.presignGet(asset, new ByteRange(0, 0, size), now, now.plusSeconds(30));
        HttpResponse<byte[]> exactRange = HttpClient.newHttpClient().send(
                HttpRequest.newBuilder(URI.create(partialUrl)).timeout(Duration.ofSeconds(10))
                        .header("Range", "bytes=0-0").GET().build(), HttpResponse.BodyHandlers.ofByteArray());
        assertEquals(206, exactRange.statusCode());
        assertEquals(1, exactRange.body().length);
        HttpResponse<Void> wrongRange = HttpClient.newHttpClient().send(
                HttpRequest.newBuilder(URI.create(partialUrl)).timeout(Duration.ofSeconds(10))
                        .header("Range", "bytes=1-1").GET().build(), HttpResponse.BodyHandlers.discarding());
        assertEquals(403, wrongRange.statusCode());
    }

    private static boolean nonBlank(String value) {
        return value != null && !value.isBlank();
    }
}
