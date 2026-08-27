package com.englishflow.content.adapter.failclosed;

import com.englishflow.content.domain.ContentOutboxEvent;
import com.englishflow.content.port.ContentOutboxPort;

/** Outbox writes fail closed until the content-owned durable store is enabled. */
public final class FailClosedContentOutbox implements ContentOutboxPort {

    @Override
    public void appendAfterFact(ContentOutboxEvent event) {
        throw ContentPersistenceFailure.unavailable();
    }
}
