package com.englishflow.media.port;

import com.englishflow.media.domain.MediaEvent;

/** Outbox boundary for safe media facts; payloads must remain metadata-only. */
public interface MediaEventPort {

    void append(MediaEvent event);
}
