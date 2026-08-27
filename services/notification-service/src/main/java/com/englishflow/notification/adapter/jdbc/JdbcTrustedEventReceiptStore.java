package com.englishflow.notification.adapter.jdbc;

import com.englishflow.notification.domain.NotificationDomainException;
import com.englishflow.notification.domain.TrustedEventReceipt;
import com.englishflow.notification.domain.TrustedEventReceiptStatus;
import com.englishflow.notification.port.TrustedEventReceiptPort;
import org.springframework.dao.DataAccessException;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.JdbcTemplate;

import java.sql.Timestamp;
import java.util.Objects;
import java.util.Optional;

/** Durable event-id/dedupe receipt ledger for replayable trusted notifications. */
public final class JdbcTrustedEventReceiptStore implements TrustedEventReceiptPort {

    private final JdbcTemplate jdbc;

    public JdbcTrustedEventReceiptStore(JdbcTemplate jdbc) {
        this.jdbc = Objects.requireNonNull(jdbc, "jdbc");
    }

    @Override
    public synchronized ReceiptClaim claim(TrustedEventReceipt candidate) {
        Objects.requireNonNull(candidate, "candidate");
        try {
            Optional<TrustedEventReceipt> byEvent = findByEvent(candidate.consumerName(), candidate.eventId());
            if (byEvent.isPresent()) return compare(candidate, byEvent.get());
            Optional<TrustedEventReceipt> byDedupe = findByDedupe(candidate.consumerName(), candidate.dedupeKey());
            if (byDedupe.isPresent()) return compare(candidate, byDedupe.get());
            try {
                jdbc.update(insertSql(), values(candidate));
                return ReceiptClaim.newClaim();
            } catch (DuplicateKeyException duplicate) {
                Optional<TrustedEventReceipt> existing = findByEvent(candidate.consumerName(), candidate.eventId());
                if (existing.isEmpty()) {
                    existing = findByDedupe(candidate.consumerName(), candidate.dedupeKey());
                }
                return existing.map(value -> compare(candidate, value)).orElseThrow(this::unavailable);
            }
        } catch (DataAccessException exception) {
            throw unavailable();
        }
    }

    @Override
    public void save(TrustedEventReceipt receipt) {
        Objects.requireNonNull(receipt, "receipt");
        try {
            jdbc.update("""
                    INSERT INTO notification_trusted_event_receipt
                        (consumer_name, event_id, event_name, dedupe_key, fingerprint, status, attempt,
                         reason_code, message_id, workflow_task_id, first_seen_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON DUPLICATE KEY UPDATE
                        status = VALUES(status), attempt = VALUES(attempt), reason_code = VALUES(reason_code),
                        message_id = VALUES(message_id), workflow_task_id = VALUES(workflow_task_id),
                        updated_at = VALUES(updated_at)
                    """, values(receipt));
        } catch (DataAccessException exception) {
            throw unavailable();
        }
    }

    private Optional<TrustedEventReceipt> findByEvent(String consumer, String eventId) {
        return jdbc.query(selectSql() + " WHERE consumer_name = ? AND event_id = ?",
                (rs, row) -> map(rs), consumer, eventId).stream().findFirst();
    }

    private Optional<TrustedEventReceipt> findByDedupe(String consumer, String dedupeKey) {
        return jdbc.query(selectSql() + " WHERE consumer_name = ? AND dedupe_key = ?",
                (rs, row) -> map(rs), consumer, dedupeKey).stream().findFirst();
    }

    private ReceiptClaim compare(TrustedEventReceipt candidate, TrustedEventReceipt existing) {
        if (!existing.fingerprint().equals(candidate.fingerprint())) {
            throw new NotificationDomainException(NotificationDomainException.Code.IDEMPOTENCY_CONFLICT,
                    "trusted event id was reused with a different envelope");
        }
        return ReceiptClaim.existingClaim(existing);
    }

    private TrustedEventReceipt map(java.sql.ResultSet rs) throws java.sql.SQLException {
        return new TrustedEventReceipt(rs.getString("consumer_name"), rs.getString("event_id"),
                rs.getString("event_name"), rs.getString("dedupe_key"), rs.getString("fingerprint"),
                TrustedEventReceiptStatus.valueOf(rs.getString("status")), rs.getInt("attempt"),
                rs.getString("reason_code"), rs.getString("message_id"), rs.getString("workflow_task_id"),
                rs.getTimestamp("first_seen_at").toInstant(), rs.getTimestamp("updated_at").toInstant());
    }

    private static String selectSql() {
        return "SELECT consumer_name, event_id, event_name, dedupe_key, fingerprint, status, attempt, "
                + "reason_code, message_id, workflow_task_id, first_seen_at, updated_at "
                + "FROM notification_trusted_event_receipt";
    }

    private static String insertSql() {
        return "INSERT INTO notification_trusted_event_receipt "
                + "(consumer_name, event_id, event_name, dedupe_key, fingerprint, status, attempt, "
                + "reason_code, message_id, workflow_task_id, first_seen_at, updated_at) "
                + "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
    }

    private static Object[] values(TrustedEventReceipt receipt) {
        return new Object[]{receipt.consumerName(), receipt.eventId(), receipt.eventName(), receipt.dedupeKey(),
                receipt.fingerprint(), receipt.status().name(), receipt.attempt(), receipt.reasonCode(),
                receipt.messageId(), receipt.workflowTaskId(), Timestamp.from(receipt.firstSeenAt()),
                Timestamp.from(receipt.updatedAt())};
    }

    private NotificationDomainException unavailable() {
        return new NotificationDomainException(NotificationDomainException.Code.NETWORK_UNAVAILABLE,
                "notification durable persistence is unavailable");
    }
}
