package com.englishflow.learner.application;

import java.sql.Timestamp;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** Pin writes are owner-scoped, idempotent on re-pin, and never bump versions. */
class TargetPinServiceTest {

    private final Clock clock = Clock.fixed(Instant.parse("2026-09-27T12:00:00Z"), ZoneOffset.UTC);
    private final Map<String, Map<String, Object>> goals = new HashMap<>();
    private final JdbcTemplate jdbc = new JdbcTemplate(new DriverManagerDataSource()) {
        @Override
        public List<Map<String, Object>> queryForList(String sql, Object... args) {
            if (sql.contains("pinned_content_version_id")) {
                Map<String, Object> goal = goals.get(String.valueOf(args[1]));
                if (goal == null) return List.of();
                return List.of(new HashMap<>(goal));
            }
            if (sql.contains("SELECT g.target_id")) {
                Map<String, Object> goal = goals.get(String.valueOf(args[1]));
                if (goal == null) return List.of();
                return List.of(Map.of("target_id", goal.get("target_id")));
            }
            throw new AssertionError("unexpected pin read: " + sql);
        }

        @Override
        public int update(String sql, Object... args) {
            Map<String, Object> goal = goals.get("test-subject");
            if (goal == null) return 0;
            goal.put("pinned_content_version_id", args[0]);
            goal.put("pinned_content_epoch", args[1]);
            goal.put("pinned_at", args[2]);
            return 1;
        }
    };
    private final TargetPinService pins = new TargetPinService(jdbc, clock);

    private void goal(long targetId) {
        Map<String, Object> row = new HashMap<>();
        row.put("target_id", targetId);
        row.put("pinned_content_version_id", null);
        row.put("pinned_content_epoch", null);
        row.put("pinned_at", null);
        goals.put("test-subject", row);
    }

    @Test
    void pinPersistsAndReadsBackWithoutVersionBump() {
        goal(71001L);
        assertTrue(pins.findPin("test-subject").isEmpty());
        TargetPinService.TargetPin pinned = pins.pinTarget("test-subject", 71001L, 266100L, 1L);
        assertEquals(71001L, pinned.targetId());
        assertEquals(266100L, pinned.contentVersionId());
        assertEquals(1L, pinned.contentEpoch());
        Optional<TargetPinService.TargetPin> reread = pins.findPin("test-subject");
        assertTrue(reread.isPresent());
        assertEquals(266100L, reread.get().contentVersionId());
        // Identical re-pin converges.
        pins.pinTarget("test-subject", 71001L, 266100L, 1L);
        assertEquals(266100L, pins.findPin("test-subject").orElseThrow().contentVersionId());
    }

    @Test
    void pinRequiresAnExistingGoalAndMatchingTarget() {
        assertThrows(IllegalStateException.class,
                () -> pins.pinTarget("nobody", 71001L, 266100L, 1L));
        goal(71001L);
        assertThrows(IllegalStateException.class,
                () -> pins.pinTarget("test-subject", 99999L, 266100L, 1L));
        assertThrows(IllegalArgumentException.class,
                () -> pins.pinTarget("test-subject", 71001L, 0L, 1L));
    }
}
