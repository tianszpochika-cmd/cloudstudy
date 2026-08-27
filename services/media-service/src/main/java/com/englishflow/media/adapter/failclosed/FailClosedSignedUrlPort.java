package com.englishflow.media.adapter.failclosed;

import com.englishflow.media.domain.ByteRange;
import com.englishflow.media.domain.MediaAsset;
import com.englishflow.media.domain.MediaAuthorizationContext;
import com.englishflow.media.domain.MediaDeliveryChannel;
import com.englishflow.media.domain.SignedMediaUrl;
import com.englishflow.media.domain.SignedUrlGrant;
import com.englishflow.media.port.SignedUrlPort;

import java.time.Instant;

/**
 * Local-real signed URL boundary. It never manufactures a URL for an unconfigured object store.
 */
public final class FailClosedSignedUrlPort implements SignedUrlPort {

    @Override
    public SignedMediaUrl issue(
            MediaAsset asset,
            MediaAuthorizationContext context,
            MediaDeliveryChannel channel,
            ByteRange range,
            Instant issuedAt,
            Instant expiresAt) {
        throw MediaPersistenceNotEnabled.exception();
    }

    @Override
    public SignedUrlGrant verify(
            String token,
            MediaAsset asset,
            MediaAuthorizationContext context,
            ByteRange requestedRange,
            Instant now) {
        throw MediaPersistenceNotEnabled.exception();
    }

    @Override
    public void revokeAsset(String assetId) {
        throw MediaPersistenceNotEnabled.exception();
    }
}
