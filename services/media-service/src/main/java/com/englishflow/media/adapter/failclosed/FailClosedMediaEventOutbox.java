package com.englishflow.media.adapter.failclosed;

import com.englishflow.media.domain.MediaEvent;
import com.englishflow.media.port.MediaEventPort;

/** Local-real outbox boundary; an event cannot be acknowledged without durable storage. */
public final class FailClosedMediaEventOutbox implements MediaEventPort {

    @Override
    public void append(MediaEvent event) {
        throw MediaPersistenceNotEnabled.exception();
    }
}
