package com.englishflow.content.port;

import com.englishflow.content.domain.ContentOutboxEvent;

/**
 * Outbox port. A production implementation must append the event in the same local transaction
 * as the content fact, then let Kafka delivery/retry happen outside the transaction.
 */
public interface ContentOutboxPort {

    void appendAfterFact(ContentOutboxEvent event);
}
