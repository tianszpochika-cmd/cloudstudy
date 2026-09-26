package com.englishflow.media.adapter.objectstore;

import com.englishflow.media.domain.ByteRange;
import com.englishflow.media.domain.MediaAsset;
import com.englishflow.media.domain.MediaOperationException;
import com.englishflow.media.port.MediaObjectStorePort;

import io.minio.Checksum;
import io.minio.GetPresignedObjectUrlArgs;
import io.minio.MinioClient;
import io.minio.StatObjectArgs;
import io.minio.StatObjectResponse;
import io.minio.Http;

import java.time.Duration;
import java.time.Instant;
import java.net.URI;
import java.util.HexFormat;
import java.util.Map;

/** S3-compatible MinIO HEAD and GET presigner; no media payload or signed URL is logged. */
public final class MinioObjectStorePort implements MediaObjectStorePort {

    private final MinioClient inspectionClient;
    private final MinioClient publicSigner;

    public MinioObjectStorePort(String endpoint, String publicEndpoint,
            String accessKey, String secretKey, String region) {
        if (blank(endpoint) || blank(publicEndpoint) || blank(accessKey) || blank(secretKey) || blank(region)) {
            throw new IllegalArgumentException("media object store endpoint, public endpoint, credentials and region are required");
        }
        URI publicUri = URI.create(publicEndpoint);
        String host = publicUri.getHost();
        boolean loopback = "localhost".equalsIgnoreCase(host)
                || "127.0.0.1".equals(host) || "::1".equals(host);
        if (host == null || publicUri.getUserInfo() != null || publicUri.getQuery() != null
                || publicUri.getFragment() != null
                || (!"https".equalsIgnoreCase(publicUri.getScheme())
                        && !(loopback && "http".equalsIgnoreCase(publicUri.getScheme())))) {
            throw new IllegalArgumentException("media public object endpoint must use HTTPS (or loopback HTTP)");
        }
        inspectionClient = MinioClient.builder().endpoint(endpoint)
                .credentials(accessKey, secretKey).region(region).build();
        publicSigner = MinioClient.builder().endpoint(publicEndpoint)
                .credentials(accessKey, secretKey).region(region).build();
    }

    @Override
    public ObjectState stat(MediaAsset asset) {
        try {
            StatObjectResponse response = inspectionClient.statObject(StatObjectArgs.builder()
                    .bucket(asset.bucketName()).object(asset.objectKey())
                    .versionId(asset.objectVersion()).fetchChecksum(true).build());
            String encodedSha256 = response.checksumType() != Checksum.Type.FULL_OBJECT
                    || response.checksums() == null
                    ? null : response.checksums().get(Checksum.Algorithm.SHA256);
            String checksum = encodedSha256 == null ? null
                    : HexFormat.of().formatHex(java.util.Base64.getDecoder().decode(encodedSha256));
            // x-amz-meta-sha256 is intentionally insufficient: it can be supplied by an
            // untrusted uploader without the object store verifying the bytes.
            return new ObjectState(response.size(), response.versionId(), checksum, response.contentType());
        } catch (Exception exception) {
            throw MediaOperationException.unavailable(
                    "MEDIA_OBJECT_UNAVAILABLE", "media object cannot be verified in storage");
        }
    }

    @Override
    public String presignGet(MediaAsset asset, ByteRange range, Instant issuedAt, Instant expiresAt) {
        long seconds = Duration.between(issuedAt, expiresAt).toSeconds();
        if (seconds < 1 || seconds > 900) {
            throw MediaOperationException.badRequest(
                    "MEDIA_SIGNED_URL_WINDOW_INVALID", "media signature expiry is outside the allowed window");
        }
        try {
            var builder = GetPresignedObjectUrlArgs.builder().method(Http.Method.GET)
                    .bucket(asset.bucketName()).object(asset.objectKey())
                    .versionId(asset.objectVersion()).expiry((int) seconds);
            if (range.length() != asset.sizeBytes()) {
                // An explicit partial grant signs the exact Range header. Browser media
                // elements request the entire object grant and manage Range themselves.
                builder.extraHeaders(Map.of("Range",
                        "bytes=" + range.startInclusive() + "-" + range.endInclusive()));
            }
            return publicSigner.getPresignedObjectUrl(builder.build());
        } catch (Exception exception) {
            throw MediaOperationException.unavailable(
                    "MEDIA_OBJECT_SIGNATURE_UNAVAILABLE", "media object signature is unavailable");
        }
    }

    private static boolean blank(String value) {
        return value == null || value.isBlank();
    }
}
