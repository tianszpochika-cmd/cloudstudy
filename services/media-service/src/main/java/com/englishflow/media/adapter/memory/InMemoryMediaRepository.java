package com.englishflow.media.adapter.memory;

import com.englishflow.media.domain.MediaAsset;
import com.englishflow.media.port.MediaRepository;

import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

/** Pure code-layer fixture. It stores metadata only and has no object-byte store. */
public final class InMemoryMediaRepository implements MediaRepository {

    private final ConcurrentMap<String, MediaAsset> assets = new ConcurrentHashMap<>();

    @Override
    public Optional<MediaAsset> findById(String assetId) {
        return Optional.ofNullable(assets.get(assetId));
    }

    @Override
    public MediaAsset save(MediaAsset asset) {
        assets.put(asset.assetId(), asset);
        return asset;
    }
}
