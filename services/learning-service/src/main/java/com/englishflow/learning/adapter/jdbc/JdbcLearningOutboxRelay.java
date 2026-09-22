package com.englishflow.learning.adapter.jdbc;

import com.englishflow.learning.port.LearningOutboxRelayPort;

import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Objects;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * JDBC claim/mark adapter for the learning outbox. PENDING and RETRY are both
 * claimable; publishing then happens with no lock held.
 */
public final class JdbcLearningOutboxRelay implements LearningOutboxRelayPort {

    private static final String CLAIM_SQL = """
            SELECT event_id, aggregate_id, event_type, schema_version, event_version, dedupe_key,
                   payload_json, request_id, trace_id, attempt_count
              FROM learning_runtime_outbox_event
             WHERE status IN ('PENDING', 'RETRY')
               AND available_at <= ?
             ORDER BY available_at, created_at
             LIMIT ?
             FOR UPDATE SKIP LOCKED
            """;

    private static final String MARK_CLAIMED_SQL = """
            UPDATE learning_runtime_outbox_event
               SET status = 'PUBLISHING', locked_by = ?, locked_until = ?, attempt_count = attempt_count + 1
             WHERE event_id = ?
            """;

    private static final String MARK_PUBLISHED_SQL = """
            UPDATE learning_runtime_outbox_event
               SET status = 'PUBLISHED', published_at = ?, locked_by = NULL, locked_until = NULL,
                   last_error_code = NULL, last_error_message = NULL
             WHERE event_id = ? AND status = 'PUBLISHING'
            """;

    private static final String MARK_FAILED_SQL = """
            UPDATE learning_runtime_outbox_event
               SET status = ?, available_at = ?, locked_by = NULL, locked_until = NULL,
                   last_error_code = ?, last_error_message = ?
             WHERE event_id = ? AND status = 'PUBLISHING'
            """;

    private static final String RECLAIM_SQL = """
            UPDATE learning_runtime_outbox_event
               SET status = 'RETRY', available_at = ?, locked_by = NULL, locked_until = NULL,
                   last_error_code = 'LEASE_EXPIRED', last_error_message = 'publishing lease expired'
             WHERE status = 'PUBLISHING' AND locked_until IS NOT NULL AND locked_until <= ?
            """;

    private final JdbcTemplate jdbc;
    private final TransactionTemplate transactions;

    public JdbcLearningOutboxRelay(JdbcTemplate jdbc, TransactionTemplate transactions) {
        this.jdbc = Objects.requireNonNull(jdbc, "jdbc is required");
        this.transactions = Objects.requireNonNull(transactions, "transactions is required");
    }

    @Override
    public List<ClaimedEvent> claim(String instanceId, Instant now, int batchSize, Duration lease) {
        Timestamp at = Timestamp.from(now);
        List<ClaimedEvent> claimed = transactions.execute(status -> {
            List<ClaimedEvent> rows = jdbc.query(CLAIM_SQL, (resultSet, rowNum) -> new ClaimedEvent(
                    resultSet.getString("event_id"),
                    resultSet.getString("aggregate_id"),
                    resultSet.getString("event_type"),
                    resultSet.getString("schema_version"),
                    resultSet.getInt("event_version"),
                    resultSet.getString("dedupe_key"),
                    resultSet.getString("payload_json"),
                    resultSet.getString("request_id"),
                    resultSet.getString("trace_id"),
                    resultSet.getInt("attempt_count")), at, batchSize);
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
    public void markFailed(String eventId, Instant availableAt, boolean exhausted, String errorCode,
            String errorMessage) {
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
