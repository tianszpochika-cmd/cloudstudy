package com.englishflow.media.port;

import com.englishflow.media.domain.ByteRange;
import com.englishflow.media.domain.MediaAsset;

import java.time.Instant;

/** Read-only object facts and a short-lived GET signature; object bytes never enter the domain. */
public interface MediaObjectStorePort {

    ObjectState stat(MediaAsset asset);

    String presignGet(MediaAsset asset, ByteRange range, Instant issuedAt, Instant expiresAt);

    record ObjectState(long sizeBytes, String versionId, String checksumSha256, String contentType) {
    }
}
