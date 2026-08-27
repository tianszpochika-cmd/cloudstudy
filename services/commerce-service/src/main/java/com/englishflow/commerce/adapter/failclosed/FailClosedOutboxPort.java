package com.englishflow.commerce.adapter.failclosed;

import com.englishflow.commerce.application.ports.OutboxPort;
import com.englishflow.commerce.domain.CommerceException;

/** Cross-service events cannot be acknowledged while the owner outbox is not durable. */
public final class FailClosedOutboxPort implements OutboxPort {
    @Override public void append(Event event) {
        throw CommerceException.unavailable("COMMERCE_OUTBOX_UNAVAILABLE", "durable commerce outbox is not configured");
    }
}
