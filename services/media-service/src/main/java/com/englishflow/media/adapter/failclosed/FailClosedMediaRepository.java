package com.englishflow.media.adapter.failclosed;

import com.englishflow.media.domain.MediaAsset;
import com.englishflow.media.port.MediaRepository;

import java.util.Optional;

/**
 * Local-real safety boundary until the media-owned JDBC repository is implemented.
 * It deliberately never returns an empty result or accepts a write as a success.
 */
public final class FailClosedMediaRepository implements MediaRepository {

    @Override
    public Optional<MediaAsset> findById(String assetId) {
        throw MediaPersistenceNotEnabled.exception();
    }

    @Override
    public MediaAsset save(MediaAsset asset) {
        throw MediaPersistenceNotEnabled.exception();
    }
}
