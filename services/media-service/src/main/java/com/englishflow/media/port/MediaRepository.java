package com.englishflow.media.port;

import com.englishflow.media.domain.MediaAsset;

import java.util.Optional;

/** Media-owned persistence boundary. Implementations must use media-service's own schema. */
public interface MediaRepository {

    Optional<MediaAsset> findById(String assetId);

    MediaAsset save(MediaAsset asset);
}
