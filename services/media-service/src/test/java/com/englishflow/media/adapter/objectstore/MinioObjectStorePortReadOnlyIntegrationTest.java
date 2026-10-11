package com.englishflow.media.adapter.objectstore;

import com.englishflow.media.domain.ByteRange;
import com.englishflow.media.domain.MediaAsset;
import com.englishflow.media.domain.MediaContentReference;
import com.englishflow.media.domain.MediaKind;
import com.englishflow.media.domain.MediaRightsReference;
import com.englishflow.media.domain.MediaRightsStatus;

import io.minio.MakeBucketArgs;
import io.minio.MinioClient;
import io.minio.PutObjectArgs;
import io.minio.RemoveBucketArgs;
import io.minio.RemoveObjectArgs;

import org.junit.jupiter.api.Test;

import java.io.ByteArrayInputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.Instant;
import java.util.Set;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** Read-only range check against a bucket this test creates on the local MinIO and then deletes. */
class MinioObjectStorePortReadOnlyIntegrationTest {

    @Test
    void aRealPresignedUrlReturnsOneByteRangeWithoutLoggingTheUrlOrAudio() throws Exception {
        String endpoint = "http://127.0.0.1:19000";
        String access = firstNonBlank(System.getenv("MEDIA_TEST_MINIO_ACCESS_KEY"), System.getenv("MINIO_ROOT_USER"), "change-me");
        String secret = firstNonBlank(System.getenv("MEDIA_TEST_MINIO_SECRET_KEY"), System.getenv("MINIO_ROOT_PASSWORD"), "change-me-local");
        String bucket = "rv3-media-ro-" + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
        String objectKey = "rv3/range-check.bin";
        byte[] payload = new byte[] {9, 8, 7, 6, 5};
        MinioClient admin = MinioClient.builder().endpoint(endpoint).credentials(access, secret).region("us-east-1").build();
        try {
            admin.makeBucket(MakeBucketArgs.builder().bucket(bucket).region("us-east-1").build());
            admin.putObject(PutObjectArgs.builder().bucket(bucket).object(objectKey)
                    .stream(new ByteArrayInputStream(payload), (long) payload.length, -1L)
                    .contentType("audio/mpeg").build());
            long size = payload.length;
            var store = new MinioObjectStorePort(endpoint, endpoint, access, secret, "us-east-1");
            Instant now = Instant.now();
            MediaAsset asset = MediaAsset.create("transport-check", "tenant-test", "owner-test", "existing-object",
                    MediaKind.AUDIO, "audio/mpeg", "MINIO", bucket, objectKey, null,
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
        } finally {
            try {
                admin.removeObject(RemoveObjectArgs.builder().bucket(bucket).object(objectKey).build());
            } catch (Exception ignored) {
                // The bucket removal below still runs when the object was never written.
            }
            try {
                admin.removeBucket(RemoveBucketArgs.builder().bucket(bucket).build());
            } catch (Exception ignored) {
                // A failed makeBucket leaves nothing to delete.
            }
        }
    }

    private static String firstNonBlank(String... values) {
        for (String value : values) {
            if (value != null && !value.isBlank()) return value;
        }
        return "";
    }
}
