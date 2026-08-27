package com.englishflow.media.adapter.failclosed;

import com.englishflow.media.domain.MediaOperationException;

/** Stable error used when local-real has no durable media persistence implementation. */
public final class MediaPersistenceNotEnabled {

    private MediaPersistenceNotEnabled() {
    }

    public static MediaOperationException exception() {
        return MediaOperationException.unavailable(
                "MEDIA_PERSISTENCE_NOT_ENABLED",
                "media-service persistence is not enabled for local-real; the operation was rejected");
    }
}
