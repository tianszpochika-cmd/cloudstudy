package com.englishflow.workflow.adapter.jdbc;

import org.springframework.jdbc.core.JdbcTemplate;

import java.util.List;
import java.util.UUID;

/**
 * The workflow outbox, claimed rather than read.
 *
 * <p>Claiming uses {@code FOR UPDATE SKIP LOCKED}, so two relays running at once take different rows instead
 * of both taking the same one and publishing it twice. A read followed by an update would let both see the
 * same pending rows; the lock is what makes the claim exclusive.
 *
 * <p>A publish that fails is recorded with its error and made available again after a backoff, because the
 * alternative is either losing the event or retrying it in a tight loop. What must not happen is a row being
 * marked published without having been published, so the status is only advanced after the caller reports
 * success.
 */
public class JdbcWorkflowOutbox {

    /** One claimed event. */
    public record ClaimedEvent(String eventId, String aggregateId, String eventName, String schemaVersion,
                               String dedupeKey, String payloadJson, int attemptCount) {
    }

    private final JdbcTemplate jdbc;
    private final String holder;

    public JdbcWorkflowOutbox(JdbcTemplate jdbc, String holder) {
        this.jdbc = jdbc;
        this.holder = holder;
    }

    /** Appends an event, leaving it pending for the relay. */
    public String append(String aggregateId, String eventName, String schemaVersion, String dedupeKey,
                         String payloadJson) {
        String eventId = UUID.randomUUID().toString();
        jdbc.update("""
                INSERT INTO workflow_service.workflow_outbox_event
                    (event_id, aggregate_id, event_name, schema_version, dedupe_key, payload_json, status,
                     attempt_count, available_at, created_at, occurred_at)
                VALUES (?, ?, ?, ?, ?, ?, 'PENDING', 0, UTC_TIMESTAMP(6), UTC_TIMESTAMP(6), UTC_TIMESTAMP(6))
                """, eventId, aggregateId, eventName, schemaVersion, dedupeKey, payloadJson);
        return eventId;
    }

    /**
     * Claims up to {@code limit} pending events for this holder.
     *
     * <p>The select and the update run in one transaction, and the select locks the rows it returns while
     * skipping the ones another relay already holds. Without SKIP LOCKED the second relay would block and then
     * claim rows the first had already published.
     */
    public List<ClaimedEvent> claim(int limit, int leaseSeconds) {
        return jdbc.execute((java.sql.Connection connection) -> {
            boolean previous = connection.getAutoCommit();
            connection.setAutoCommit(false);
            try {
                List<ClaimedEvent> claimed;
                try (java.sql.PreparedStatement statement = connection.prepareStatement("""
                        SELECT event_id, aggregate_id, event_name, schema_version, dedupe_key, payload_json, attempt_count
                          FROM workflow_service.workflow_outbox_event
                         WHERE status = 'PENDING' AND available_at <= UTC_TIMESTAMP(6)
                         ORDER BY available_at, event_id
                         LIMIT ? FOR UPDATE SKIP LOCKED
                        """)) {
                    statement.setInt(1, limit);
                    claimed = new java.util.ArrayList<>();
                    try (java.sql.ResultSet rows = statement.executeQuery()) {
                        while (rows.next()) {
                            claimed.add(new ClaimedEvent(rows.getString(1), rows.getString(2), rows.getString(3),
                                    rows.getString(4), rows.getString(5), rows.getString(6), rows.getInt(7)));
                        }
                    }
                }
                if (!claimed.isEmpty()) {
                    try (java.sql.PreparedStatement update = connection.prepareStatement("""
                            UPDATE workflow_service.workflow_outbox_event
                               SET status = 'CLAIMED', locked_by = ?,
                                   locked_until = DATE_ADD(UTC_TIMESTAMP(6), INTERVAL ? SECOND)
                             WHERE event_id = ?
                            """)) {
                        for (ClaimedEvent event : claimed) {
                            update.setString(1, holder);
                            update.setInt(2, leaseSeconds);
                            update.setString(3, event.eventId());
                            update.addBatch();
                        }
                        update.executeBatch();
                    }
                }
                connection.commit();
                return claimed;
            } catch (RuntimeException | java.sql.SQLException failure) {
                connection.rollback();
                throw failure instanceof RuntimeException runtime ? runtime
                        : new IllegalStateException("claim failed", failure);
            } finally {
                connection.setAutoCommit(previous);
            }
        });
    }

    /** Marks a claimed event published. Only called after the broker accepted it. */
    public boolean markPublished(String eventId) {
        return jdbc.update("""
                UPDATE workflow_service.workflow_outbox_event
                   SET status = 'PUBLISHED', published_at = UTC_TIMESTAMP(6), locked_by = NULL, locked_until = NULL
                 WHERE event_id = ? AND status = 'CLAIMED'
                """, eventId) == 1;
    }

    /** Records a failed publish and makes the row available again after the backoff. */
    public boolean markFailed(String eventId, String errorCode, String errorMessage, int backoffSeconds) {
        return jdbc.update("""
                UPDATE workflow_service.workflow_outbox_event
                   SET status = 'PENDING', attempt_count = attempt_count + 1, locked_by = NULL, locked_until = NULL,
                       last_error_code = ?, last_error_message = ?,
                       available_at = DATE_ADD(UTC_TIMESTAMP(6), INTERVAL ? SECOND)
                 WHERE event_id = ? AND status = 'CLAIMED'
                """, errorCode, errorMessage, backoffSeconds, eventId) == 1;
    }

    /** Releases claims whose holder never came back, so a crashed relay does not strand its rows. */
    public int releaseExpiredClaims() {
        return jdbc.update("""
                UPDATE workflow_service.workflow_outbox_event
                   SET status = 'PENDING', locked_by = NULL, locked_until = NULL
                 WHERE status = 'CLAIMED' AND locked_until IS NOT NULL AND locked_until <= UTC_TIMESTAMP(6)
                """);
    }

    /** The status of one event, read back rather than assumed. */
    public String statusOf(String eventId) {
        List<String> rows = jdbc.query("""
                SELECT CONCAT(status, '|', IFNULL(locked_by,'null'), '|', attempt_count)
                  FROM workflow_service.workflow_outbox_event WHERE event_id = ?
                """, (resultSet, index) -> resultSet.getString(1), eventId);
        return rows.stream().filter(java.util.Objects::nonNull).findFirst().orElse(null);
    }
}
