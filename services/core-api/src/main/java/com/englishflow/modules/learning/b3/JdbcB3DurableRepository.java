package com.englishflow.modules.learning.b3;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/** MySQL adapter for the learner write tables created by V0012. */
@Repository
@ConditionalOnProperty(prefix = "englishflow.b3", name = "persistence", havingValue = "jdbc")
public final class JdbcB3DurableRepository implements B3DurableRepository {
    private final JdbcTemplate jdbc;

    public JdbcB3DurableRepository(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    @Override
    public void savePracticeSession(PracticeSession session) {
        jdbc.update("""
                INSERT INTO lrn_b3_practice_session
                    (session_uuid, user_id, domain_code, content_id, content_version_id, rule_version, status, current_index, position_version)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE status = VALUES(status), current_index = VALUES(current_index),
                    position_version = VALUES(position_version), rule_version = VALUES(rule_version)
                """, session.sessionUuid(), session.userId(), session.domainCode(), session.contentId(),
                session.contentVersionId(), session.ruleVersion(), session.status(), session.currentIndex(), session.positionVersion());
    }

    @Override
    public void saveShadowingSession(ShadowingSession session) {
        jdbc.update("""
                INSERT INTO lrn_shadowing_session
                    (session_uuid, user_id, source_segment_code, target_gap_ms, attempt_count, last_position_ms, status, content_version_id, client_event_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE attempt_count = VALUES(attempt_count), last_position_ms = VALUES(last_position_ms), status = VALUES(status)
                """, session.sessionUuid(), session.userId(), session.sourceSegmentCode(), session.targetGapMs(), session.attemptCount(),
                session.lastPositionMs(), session.status(), session.contentVersionId(), session.clientEventId());
    }

    @Override
    public void saveRoleplaySession(RoleplaySession session) {
        jdbc.update("""
                INSERT INTO lrn_speaking_roleplay_session
                    (session_uuid, user_id, roleplay_code, turn_index, content_version_id, status, client_event_id)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE turn_index = VALUES(turn_index), status = VALUES(status)
                """, session.sessionUuid(), session.userId(), session.roleplayCode(), session.turnIndex(),
                session.contentVersionId(), session.status(), session.clientEventId());
    }

    @Override
    public void saveAttempt(Attempt attempt) {
        jdbc.update("""
                INSERT INTO lrn_b3_attempt
                    (session_id, user_id, item_code, content_version_id, answer_hash, score, is_correct, feedback_code, client_event_id)
                VALUES (0, ?, ?, ?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE score = VALUES(score), is_correct = VALUES(is_correct), feedback_code = VALUES(feedback_code)
                """, attempt.userId(), attempt.itemCode(), attempt.contentVersionId(), attempt.answerHash(), attempt.score(),
                attempt.correct(), attempt.feedbackCode(), attempt.clientEventId());
    }

    @Override
    public void saveReadingProgress(ReadingProgress progress) {
        jdbc.update("""
                INSERT INTO lrn_reading_progress
                    (user_id, article_id, content_version_id, block_code, token_code, progress_percent, position_version, client_event_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE block_code = VALUES(block_code), token_code = VALUES(token_code),
                    progress_percent = VALUES(progress_percent), position_version = VALUES(position_version), client_event_id = VALUES(client_event_id)
                """, progress.userId(), progress.articleId(), progress.contentVersionId(), progress.blockCode(), progress.tokenCode(),
                progress.progressPercent(), progress.positionVersion(), progress.clientEventId());
    }

    @Override
    public void saveRecording(Recording recording) {
        jdbc.update("""
                INSERT INTO lrn_speaking_recording
                    (recording_uuid, user_id, source_segment_code, content_hash, duration_ms, storage_mode, status, retention_until, ai_scoring_available, client_event_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
                ON DUPLICATE KEY UPDATE status = VALUES(status), retention_until = VALUES(retention_until)
                """, recording.recordingUuid(), recording.userId(), recording.sourceSegmentCode(), recording.contentHash(),
                recording.durationMs(), recording.storageMode(), recording.status(), Timestamp.from(recording.retentionUntil()), recording.clientEventId());
    }

    @Override
    public void saveSelfRating(long userId, String recordingUuid, String ratingCode, List<String> tags, String clientEventId) {
        Long recordingId = jdbc.query("SELECT id FROM lrn_speaking_recording WHERE recording_uuid = ? AND user_id = ?",
                statement -> { statement.setString(1, recordingUuid); statement.setLong(2, userId); },
                result -> result.next() ? result.getLong(1) : null);
        if (recordingId == null) return;
        jdbc.update("INSERT INTO lrn_speaking_self_rating (recording_id, user_id, rating_code, tags_json, client_event_id) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE rating_code = VALUES(rating_code), tags_json = VALUES(tags_json)",
                recordingId, userId, ratingCode, tagsJson(tags), clientEventId);
    }

    @Override
    public void saveOfflineChange(OfflineChange change) {
        jdbc.update("""
                INSERT INTO lrn_offline_change
                    (user_id, device_id, change_id, client_batch_id, entity_type, entity_id, entity_version, operation, payload_hash, occurred_at, applied_at, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP(3), ?)
                ON DUPLICATE KEY UPDATE entity_version = VALUES(entity_version), status = VALUES(status), applied_at = CURRENT_TIMESTAMP(3)
                """, change.userId(), change.deviceId(), change.changeId(), change.clientBatchId(), change.entityType(), change.entityId(),
                change.entityVersion(), change.operation(), change.payloadHash(), Timestamp.from(change.occurredAt()), change.status());
    }

    @Override
    public void saveOfflineCursor(OfflineCursor cursor) {
        jdbc.update("""
                INSERT INTO lrn_offline_cursor (user_id, device_id, cursor_value, schema_version)
                VALUES (?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE cursor_value = VALUES(cursor_value), schema_version = VALUES(schema_version)
                """, cursor.userId(), cursor.deviceId(), cursor.cursorValue(), cursor.schemaVersion());
    }

    @Override
    public void saveOfflineConflict(long userId, String changeId, String entityType, String entityId,
                                    long localVersion, long serverVersion, String resolutionCode) {
        jdbc.update("INSERT INTO lrn_offline_conflict (user_id, change_id, entity_type, entity_id, local_version, server_version, resolution_code) VALUES (?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE resolution_code = VALUES(resolution_code), server_version = VALUES(server_version)",
                userId, changeId, entityType, entityId, localVersion, serverVersion, resolutionCode);
    }

    private static String tagsJson(List<String> tags) {
        if (tags == null || tags.isEmpty()) return "[]";
        return tags.stream().map(tag -> "\"" + tag.replace("\\", "\\\\").replace("\"", "\\\"") + "\"").collect(java.util.stream.Collectors.joining(",", "[", "]"));
    }
}
