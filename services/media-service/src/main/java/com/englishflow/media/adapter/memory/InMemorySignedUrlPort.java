package com.englishflow.media.adapter.memory;

import com.englishflow.media.domain.ByteRange;
import com.englishflow.media.domain.MediaAsset;
import com.englishflow.media.domain.MediaAuthorizationContext;
import com.englishflow.media.domain.MediaDeliveryChannel;
import com.englishflow.media.domain.MediaOperationException;
import com.englishflow.media.domain.SignedMediaUrl;
import com.englishflow.media.domain.SignedUrlGrant;
import com.englishflow.media.port.SignedUrlPort;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.HexFormat;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

/**
 * In-memory signed grant fixture. A production adapter replaces this with a CDN/object-store
 * signer; neither implementation receives object bytes from the domain.
 */
public final class InMemorySignedUrlPort implements SignedUrlPort {

    private final String baseUrl;
    private final ConcurrentMap<String, SignedUrlGrant> grants = new ConcurrentHashMap<>();
    private final ConcurrentMap<String, Boolean> revokedAssets = new ConcurrentHashMap<>();

    public InMemorySignedUrlPort(String baseUrl) {
        if (baseUrl == null || baseUrl.isBlank()) {
            throw new IllegalArgumentException("signed URL base URL is required");
        }
        this.baseUrl = baseUrl.endsWith("/") ? baseUrl.substring(0, baseUrl.length() - 1) : baseUrl;
    }

    @Override
    public SignedMediaUrl issue(
            MediaAsset asset,
            MediaAuthorizationContext context,
            MediaDeliveryChannel channel,
            ByteRange range,
            Instant issuedAt,
            Instant expiresAt) {
        if (expiresAt == null || issuedAt == null || !expiresAt.isAfter(issuedAt)) {
            throw MediaOperationException.badRequest("MEDIA_SIGNED_URL_WINDOW_INVALID", "signed URL expiry is invalid");
        }
        String nonce = UUID.randomUUID().toString();
        String token = "murl-" + nonce + "-" + digest(asset.assetId() + "|" + asset.assetVersion() + "|" + context.subjectId() + "|" + nonce);
        String tokenDigest = digest(token);
        SignedUrlGrant grant = new SignedUrlGrant(
                tokenDigest, asset.assetId(), asset.assetVersion(), context.tenantId(), context.subjectId(),
                channel, range, expiresAt, false);
        grants.put(tokenDigest, grant);
        return new SignedMediaUrl(
                asset.assetId(), asset.assetVersion(), token,
                baseUrl + "/" + asset.assetId() + "?token=" + token,
                channel, range, asset.checksumSha256(), asset.sizeBytes(), issuedAt, expiresAt);
    }

    @Override
    public SignedUrlGrant verify(
            String token,
            MediaAsset asset,
            MediaAuthorizationContext context,
            ByteRange requestedRange,
            Instant now) {
        if (token == null || token.isBlank()) {
            throw MediaOperationException.forbidden("MEDIA_URL_TOKEN_REQUIRED", "signed URL token is required");
        }
        if (revokedAssets.containsKey(asset.assetId())) {
            throw MediaOperationException.forbidden("MEDIA_URL_REVOKED", "signed URL has been revoked");
        }
        SignedUrlGrant grant = grants.get(digest(token));
        if (grant == null) {
            throw MediaOperationException.forbidden("MEDIA_URL_UNKNOWN", "signed URL is unknown or revoked");
        }
        if (grant.expired(now)) {
            grants.remove(digest(token));
            throw MediaOperationException.gone("MEDIA_URL_EXPIRED", "signed URL has expired");
        }
        if (!grant.assetId().equals(asset.assetId())
                || grant.assetVersion() != asset.assetVersion()
                || !grant.tenantId().equals(context.tenantId())
                || !grant.subjectId().equals(context.subjectId())) {
            throw MediaOperationException.forbidden("MEDIA_URL_SCOPE_MISMATCH", "signed URL is not scoped to this request");
        }
        if (!sameRange(grant.range(), requestedRange)) {
            throw MediaOperationException.rangeNotSatisfiable("MEDIA_URL_RANGE_MISMATCH", "requested range differs from signed range");
        }
        return grant;
    }

    @Override
    public void revokeAsset(String assetId) {
        revokedAssets.put(assetId, Boolean.TRUE);
        for (Map.Entry<String, SignedUrlGrant> entry : grants.entrySet()) {
            if (entry.getValue().assetId().equals(assetId)) {
                grants.remove(entry.getKey());
            }
        }
    }

    private static boolean sameRange(ByteRange left, ByteRange right) {
        return left.startInclusive() == right.startInclusive()
                && left.endInclusive() == right.endInclusive()
                && left.totalSize() == right.totalSize();
    }

    private static String digest(String value) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is required by the media boundary", exception);
        }
    }
}
