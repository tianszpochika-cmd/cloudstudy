package com.englishflow.media.adapter.memory;

import com.englishflow.media.domain.MediaEvent;
import com.englishflow.media.port.MediaEventPort;

import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

/** Test outbox with safe metadata-only event records. */
public final class InMemoryMediaEventOutbox implements MediaEventPort {

    private final CopyOnWriteArrayList<MediaEvent> events = new CopyOnWriteArrayList<>();

    @Override
    public void append(MediaEvent event) {
        events.add(event);
    }

    public List<MediaEvent> snapshot() {
        return List.copyOf(events);
    }
}
