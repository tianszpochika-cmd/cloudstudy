package com.englishflow.assessment.adapter.memory;

import com.englishflow.assessment.port.AssessmentOutboxPort;

import java.util.ArrayList;
import java.util.List;

/** Test-only adapter; production wiring must replace this with a service-owned durable Outbox. */
public final class InMemoryAssessmentOutbox implements AssessmentOutboxPort {
    private final List<AssessmentOutboxEvent> events = new ArrayList<>();

    @Override
    public synchronized void append(AssessmentOutboxEvent event) {
        for (AssessmentOutboxEvent existing : events) {
            if (existing.dedupeKey().equals(event.dedupeKey())) return;
        }
        events.add(event);
    }

    public synchronized List<AssessmentOutboxEvent> events() { return List.copyOf(events); }
}
