package com.englishflow.content.release;

import java.sql.Timestamp;
import java.time.Instant;

import org.springframework.jdbc.core.JdbcTemplate;

import tools.jackson.databind.ObjectMapper;

/** One owner-schema row. A restarted process loads this row and does not replay commands. */
public final class JdbcReleaseStudioStore implements ReleaseStudioStore {

    static final String STUDIO_ID = "primary";

    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;
    private final boolean durable;

    public JdbcReleaseStudioStore(JdbcTemplate jdbc, ObjectMapper mapper) {
        this.jdbc = jdbc;
        this.mapper = mapper;
        this.durable = tablePresent();
    }

    public boolean durable() {
        return durable;
    }

    @Override
    public ReleaseStudioState load() {
        if (!durable) {
            return ReleaseStudioState.empty();
        }
        String json = jdbc.query("""
                SELECT state_json FROM it6_release_studio WHERE studio_id = ?
                """, (rs, rowNum) -> rs.getString(1), STUDIO_ID).stream().findFirst().orElse(null);
        if (json == null || json.isBlank()) {
            return ReleaseStudioState.empty();
        }
        return mapper.readValue(json, ReleaseStudioState.class);
    }

    private boolean tablePresent() {
        Integer count = jdbc.queryForObject("""
                SELECT COUNT(*) FROM information_schema.tables
                 WHERE table_schema = DATABASE() AND table_name = 'it6_release_studio'
                """, Integer.class);
        return count != null && count > 0;
    }

    @Override
    public void save(ReleaseStudioState state) {
        if (!durable) {
            return;
        }
        ReleaseStudioState stored = state == null ? ReleaseStudioState.empty() : state;
        String json = mapper.writeValueAsString(stored);
        Timestamp now = Timestamp.from(Instant.now());
        int updated = jdbc.update("""
                UPDATE it6_release_studio
                   SET state_json = ?, state_version = state_version + 1, updated_at = ?
                 WHERE studio_id = ?
                """, json, now, STUDIO_ID);
        if (updated == 0) {
            jdbc.update("""
                    INSERT INTO it6_release_studio (studio_id, state_json, state_version, updated_at)
                    VALUES (?, ?, 1, ?)
                    """, STUDIO_ID, json, now);
        }
    }
}
