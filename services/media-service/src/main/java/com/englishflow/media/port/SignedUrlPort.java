package com.englishflow.media.port;

import com.englishflow.media.domain.ByteRange;
import com.englishflow.media.domain.MediaAsset;
import com.englishflow.media.domain.MediaAuthorizationContext;
import com.englishflow.media.domain.MediaDeliveryChannel;
import com.englishflow.media.domain.MediaOperationException;
import com.englishflow.media.domain.SignedMediaUrl;
import com.englishflow.media.domain.SignedUrlGrant;

import java.time.Instant;

/** Short-lived storage/CDN authorization seam; it never accepts or returns object bytes. */
public interface SignedUrlPort {

    /** The exact object must exist before metadata can advance to ACTIVE. */
    default void verifyObjectForActivation(MediaAsset asset) {
        throw MediaOperationException.unavailable(
                "MEDIA_OBJECT_VERIFICATION_UNAVAILABLE", "media object cannot be verified");
    }

    SignedMediaUrl issue(
            MediaAsset asset,
            MediaAuthorizationContext context,
            MediaDeliveryChannel channel,
            ByteRange range,
            Instant issuedAt,
            Instant expiresAt);

    SignedUrlGrant verify(
            String token,
            MediaAsset asset,
            MediaAuthorizationContext context,
            ByteRange requestedRange,
            Instant now);

    void revokeAsset(String assetId);
}
