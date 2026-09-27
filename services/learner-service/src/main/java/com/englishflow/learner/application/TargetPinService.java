package com.englishflow.learner.application;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.springframework.jdbc.core.JdbcTemplate;

/**
 * Owner-side target content pin ("定级完成自动 pin 定级内容").
 *
 * <p>The pin is advisory routing metadata, not a trust root: plan creation
 * always re-verifies the placement report before planning, so a directly
 * written pin can never smuggle an unverified version into a plan. Pin writes
 * never bump the profile version (the pin describes the measured target, it
 * is not a new measurement). Goal content edits clear the pin through the
 * profile store because the measurement no longer describes the edited
 * target. Re-pin on a new placement overwrites; identical re-pin converges.
 */
public final class TargetPinService {

    public record TargetPin(
            long targetId,
            long contentVersionId,
            long contentEpoch,
            Instant pinnedAt) {
    }

    private static final String TENANT = "platform";

    private final JdbcTemplate jdbc;
    private final java.time.Clock clock;

    public TargetPinService(JdbcTemplate jdbc, java.time.Clock clock) {
        this.jdbc = jdbc;
        this.clock = clock;
    }

    public Optional<TargetPin> findPin(String subject) {
        List<Map<String, Object>> rows = jdbc.queryForList("""
                SELECT g.target_id, g.pinned_content_version_id, g.pinned_content_epoch, g.pinned_at
                  FROM learner_goal g
                  JOIN learner_profile p ON p.profile_id = g.profile_id
                 WHERE p.tenant_id = ? AND p.owner_id = ?
                """, TENANT, subject);
        if (rows.isEmpty()) return Optional.empty();
        Map<String, Object> row = rows.getFirst();
        Object version = row.get("pinned_content_version_id");
        Object epoch = row.get("pinned_content_epoch");
        if (!(version instanceof Number contentVersion) || contentVersion.longValue() < 1
                || !(epoch instanceof Number contentEpoch) || contentEpoch.longValue() < 0
                || !(row.get("target_id") instanceof Number targetId) || targetId.longValue() < 1) {
            return Optional.empty();
        }
        Object pinnedAt = row.get("pinned_at");
        Instant at = pinnedAt instanceof Timestamp timestamp ? timestamp.toInstant()
                : pinnedAt instanceof java.time.LocalDateTime dateTime
                        ? dateTime.toInstant(java.time.ZoneOffset.UTC) : clock.instant();
        return Optional.of(new TargetPin(targetId.longValue(), contentVersion.longValue(),
                contentEpoch.longValue(), at));
    }

    public TargetPin pinTarget(String subject, long targetId, long contentVersionId, long contentEpoch) {
        if (targetId < 1 || contentVersionId < 1 || contentEpoch < 0) {
            throw new IllegalArgumentException("pin identifiers are invalid");
        }
        List<Map<String, Object>> rows = jdbc.queryForList("""
                SELECT g.target_id
                  FROM learner_goal g
                  JOIN learner_profile p ON p.profile_id = g.profile_id
                 WHERE p.tenant_id = ? AND p.owner_id = ?
                """, TENANT, subject);
        if (rows.isEmpty()) {
            throw new IllegalStateException("learner target is not initialized");
        }
        if (!(rows.getFirst().get("target_id") instanceof Number current)
                || current.longValue() != targetId) {
            throw new IllegalStateException("pin target does not match the active target");
        }
        Instant now = clock.instant();
        int updated = jdbc.update("""
                UPDATE learner_goal g
                  JOIN learner_profile p ON p.profile_id = g.profile_id
                   SET g.pinned_content_version_id = ?, g.pinned_content_epoch = ?,
                       g.pinned_at = ?, g.updated_at = ?
                 WHERE p.tenant_id = ? AND p.owner_id = ? AND g.target_id = ?
                """, contentVersionId, contentEpoch, Timestamp.from(now), Timestamp.from(now),
                TENANT, subject, targetId);
        if (updated != 1) {
            throw new IllegalStateException("target pin could not be saved");
        }
        return new TargetPin(targetId, contentVersionId, contentEpoch, now);
    }
}
