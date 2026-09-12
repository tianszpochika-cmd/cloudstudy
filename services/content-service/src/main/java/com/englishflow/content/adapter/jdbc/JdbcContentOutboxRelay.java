package com.englishflow.content.adapter.jdbc;

import com.englishflow.content.port.ContentOutboxRelayPort;

import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.util.List;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * JDBC claim/mark adapter for the content outbox.
 *
 * <p>PENDING and RETRY are both claimable because the contract's state model treats a retry as a
 * scheduled re-attempt rather than a distinct queue. The claim runs inside a short transaction
 * (SELECT ... FOR UPDATE SKIP LOCKED followed by the state move) so concurrent relays never see the
 * same row; publishing then happens with no lock held.
 */
public final class JdbcContentOutboxRelay implements ContentOutboxRelayPort {

    private static final String CLAIM_SQL = """
            SELECT event_id, aggregate_id, event_name, schema_version, event_version, dedupe_key,
                   payload_json, request_id, trace_id, attempt_count
              FROM content_outbox_event
             WHERE status IN ('PENDING', 'RETRY')
               AND available_at <= ?
               AND (locked_until IS NULL OR locked_until <= ?)
             ORDER BY available_at, created_at
             LIMIT ?
             FOR UPDATE SKIP LOCKED
            """;

    private static final String MARK_CLAIMED_SQL = """
            UPDATE content_outbox_event
               SET status = 'PUBLISHING', locked_by = ?, locked_until = ?, attempt_count = attempt_count + 1
             WHERE event_id = ?
            """;

    private static final String MARK_PUBLISHED_SQL = """
            UPDATE content_outbox_event
               SET status = 'PUBLISHED', published_at = ?, locked_by = NULL, locked_until = NULL,
                   last_error_code = NULL, last_error_message = NULL
             WHERE event_id = ? AND status = 'PUBLISHING'
            """;

    private static final String MARK_FAILED_SQL = """
            UPDATE content_outbox_event
               SET status = ?, available_at = ?, locked_by = NULL, locked_until = NULL,
                   last_error_code = ?, last_error_message = ?
             WHERE event_id = ? AND status = 'PUBLISHING'
            """;

    private static final String RECLAIM_SQL = """
            UPDATE content_outbox_event
               SET status = 'RETRY', available_at = ?, locked_by = NULL, locked_until = NULL,
                   last_error_code = 'LEASE_EXPIRED', last_error_message = 'publishing lease expired'
             WHERE status = 'PUBLISHING' AND locked_until IS NOT NULL AND locked_until <= ?
            """;

    private final JdbcTemplate jdbc;
    private final TransactionTemplate transactions;

    public JdbcContentOutboxRelay(JdbcTemplate jdbc, TransactionTemplate transactions) {
        this.jdbc = java.util.Objects.requireNonNull(jdbc, "jdbc is required");
        this.transactions = java.util.Objects.requireNonNull(transactions, "transactions is required");
    }

    @Override
    public List<ClaimedEvent> claim(String instanceId, Instant now, int batchSize, Duration lease) {
        Timestamp at = Timestamp.from(now);
        List<ClaimedEvent> claimed = transactions.execute(status -> {
            List<ClaimedEvent> rows = jdbc.query(CLAIM_SQL, (resultSet, rowNum) -> new ClaimedEvent(
                    resultSet.getString("event_id"),
                    resultSet.getString("aggregate_id"),
                    resultSet.getString("event_name"),
                    resultSet.getString("schema_version"),
                    resultSet.getInt("event_version"),
                    resultSet.getString("dedupe_key"),
                    resultSet.getString("payload_json"),
                    resultSet.getString("request_id"),
                    resultSet.getString("trace_id"),
                    resultSet.getInt("attempt_count")), at, at, batchSize);
            if (rows.isEmpty()) {
                return rows;
            }
            Timestamp lockedUntil = Timestamp.from(now.plus(lease));
            jdbc.batchUpdate(MARK_CLAIMED_SQL, rows, rows.size(), (statement, row) -> {
                statement.setString(1, instanceId);
                statement.setTimestamp(2, lockedUntil);
                statement.setString(3, row.eventId());
            });
            return rows;
        });
        return claimed == null ? List.of() : claimed;
    }

    @Override
    public void markPublished(String eventId, Instant publishedAt) {
        jdbc.update(MARK_PUBLISHED_SQL, Timestamp.from(publishedAt), eventId);
    }

    @Override
    public void markFailed(String eventId, Instant availableAt, boolean exhausted, String errorCode, String errorMessage) {
        jdbc.update(MARK_FAILED_SQL,
                exhausted ? "DLQ" : "RETRY",
                Timestamp.from(availableAt),
                truncate(errorCode, 64),
                truncate(errorMessage, 255),
                eventId);
    }

    @Override
    public int reclaimExpiredLeases(Instant now) {
        Timestamp at = Timestamp.from(now);
        return jdbc.update(RECLAIM_SQL, at, at);
    }

    private static String truncate(String value, int max) {
        if (value == null) {
            return null;
        }
        return value.length() <= max ? value : value.substring(0, max);
    }
}
