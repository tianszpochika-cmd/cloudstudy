package com.englishflow.adminops.closure;

import java.sql.Timestamp;
import java.time.Instant;

import org.springframework.jdbc.core.JdbcTemplate;

import tools.jackson.databind.ObjectMapper;

/** One owner-schema row. A restarted process loads this row and does not replay commands. */
public final class JdbcClosureDeskStore implements ClosureDeskStore {

    static final String DESK_ID = "primary";

    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;
    private final boolean durable;

    public JdbcClosureDeskStore(JdbcTemplate jdbc, ObjectMapper mapper) {
        this.jdbc = jdbc;
        this.mapper = mapper;
        this.durable = tablePresent();
    }

    public boolean durable() {
        return durable;
    }

    @Override
    public ClosureDeskState load() {
        if (!durable) {
            return ClosureDeskState.empty();
        }
        String json = jdbc.query("""
                SELECT state_json FROM it7_closure_desk WHERE desk_id = ?
                """, (rs, rowNum) -> rs.getString(1), DESK_ID).stream().findFirst().orElse(null);
        if (json == null || json.isBlank()) {
            return ClosureDeskState.empty();
        }
        return mapper.readValue(json, ClosureDeskState.class);
    }

    private boolean tablePresent() {
        Integer count = jdbc.queryForObject("""
                SELECT COUNT(*) FROM information_schema.tables
                 WHERE table_schema = DATABASE() AND table_name = 'it7_closure_desk'
                """, Integer.class);
        return count != null && count > 0;
    }

    @Override
    public void save(ClosureDeskState state) {
        if (!durable) {
            return;
        }
        ClosureDeskState stored = state == null ? ClosureDeskState.empty() : state;
        String json = mapper.writeValueAsString(stored);
        Timestamp now = Timestamp.from(Instant.now());
        int updated = jdbc.update("""
                UPDATE it7_closure_desk
                   SET state_json = ?, state_version = state_version + 1, updated_at = ?
                 WHERE desk_id = ?
                """, json, now, DESK_ID);
        if (updated == 0) {
            jdbc.update("""
                    INSERT INTO it7_closure_desk (desk_id, state_json, state_version, updated_at)
                    VALUES (?, ?, 1, ?)
                    """, DESK_ID, json, now);
        }
    }
}
