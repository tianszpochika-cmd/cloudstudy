package com.englishflow.content.domain;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Media-asset references declared inside a version payload.
 *
 * <p>Phase 1 payloads carry media only as opaque asset references under
 * {@code assetId}/{@code mediaAssetId} keys. An empty result means a text-only
 * version: the media gate passes vacuously and the empty set is stored for
 * audit. A non-empty result with no stored media-eligibility fact fails the
 * gate closed (MEDIA_ELIGIBILITY_UNAVAILABLE) — there is no media-fact
 * pipeline to consult yet, and inventing readiness is forbidden.
 */
public final class MediaRefs {

    private static final Set<String> MEDIA_KEYS = Set.of("assetId", "mediaAssetId");

    private MediaRefs() {
    }

    public static List<String> extract(Object payload) {
        LinkedHashSet<String> refs = new LinkedHashSet<>();
        collect(payload, refs);
        return List.copyOf(refs);
    }

    private static void collect(Object value, LinkedHashSet<String> refs) {
        if (value instanceof Map<?, ?> map) {
            for (Map.Entry<?, ?> entry : map.entrySet()) {
                if (entry.getKey() instanceof String key && MEDIA_KEYS.contains(key)
                        && entry.getValue() instanceof String ref && !ref.isBlank()
                        && ref.length() <= 128) {
                    refs.add(ref.trim());
                } else {
                    collect(entry.getValue(), refs);
                }
            }
            return;
        }
        if (value instanceof List<?> list) {
            for (Object item : list) collect(item, refs);
        }
    }
}
