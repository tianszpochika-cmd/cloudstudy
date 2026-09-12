package com.englishflow.content.adapter.jdbc;

import com.englishflow.content.port.ContentInboundEventPort;

import java.sql.Timestamp;
import java.time.Instant;

import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Transactional consumer-side deduplication.
 *
 * <p>Both writes happen inside one transaction started by this method: the receipt insert depends on
 * the primary key (consumer_group, event_id) to detect a redelivery, and the effect is the counter
 * update that follows it. On a duplicate the primary key violation rolls the transaction back, so
 * the counter is not touched and the caller learns the delivery was a duplicate. No read-then-write
 * check is used, because that window is exactly what at-least-once delivery exploits.
 */
public final class JdbcContentInboundEventApplier implements ContentInboundEventPort {

    private static final String INSERT_RECEIPT_SQL = """
            INSERT INTO content_event_receipt
                (consumer_group, event_id, event_name, schema_version, dedupe_key, payload_hash,
                 receipt_state, received_at)
            VALUES (?, ?, ?, ?, ?, ?, 'APPLIED', ?)
            """;

    private static final String APPLY_EFFECT_SQL = """
            INSERT INTO content_inbound_event_stat
                (consumer_group, event_name, applied_count, first_applied_at, last_applied_at)
            VALUES (?, ?, 1, ?, ?)
            ON DUPLICATE KEY UPDATE
                applied_count = applied_count + 1,
                last_applied_at = VALUES(last_applied_at)
            """;

    private final JdbcTemplate jdbc;

    public JdbcContentInboundEventApplier(JdbcTemplate jdbc) {
        this.jdbc = java.util.Objects.requireNonNull(jdbc, "jdbc is required");
    }

    @Override
    @Transactional(propagation = Propagation.REQUIRED, rollbackFor = DuplicateKeyException.class)
    public ApplyOutcome applyOnce(InboundEvent event, Instant receivedAt) {
        Timestamp at = Timestamp.from(receivedAt);
        try {
            jdbc.update(INSERT_RECEIPT_SQL,
                    event.consumerGroup(), event.eventId(), event.eventName(),
                    event.schemaVersion(), event.dedupeKey(), event.payloadHash(), at);
        } catch (DuplicateKeyException duplicate) {
            // The same event was already applied for this consumer group. Nothing else in this
            // transaction has run yet, so the rollback leaves no trace of the redelivery.
            return ApplyOutcome.DUPLICATE;
        }
        jdbc.update(APPLY_EFFECT_SQL, event.consumerGroup(), event.eventName(), at, at);
        return ApplyOutcome.APPLIED;
    }
}
