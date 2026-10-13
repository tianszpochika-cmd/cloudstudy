package com.englishflow.content.adapter.jdbc;

import org.springframework.jdbc.core.JdbcTemplate;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/** Content-owned store of reviewer reasons for rejected content versions (V32). */
public final class JdbcContentReviewNotes {

    private final JdbcTemplate jdbc;

    public JdbcContentReviewNotes(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public void record(String contentCode, long contentVersionId, int versionNumber, String stage,
            String decision, String note, String reviewer, Instant decidedAt) {
        jdbc.update("""
                INSERT INTO content_review_note
                    (tenant_id, content_code, content_version_id, version_number, review_stage, decision,
                     note, reviewer, decided_at)
                VALUES ('platform', ?, ?, ?, ?, ?, ?, ?, ?)
                """, contentCode, contentVersionId, versionNumber, stage, decision, note, reviewer,
                JdbcContentJson.timestamp(decidedAt));
    }

    /** Latest rejection for the content (any version), newest first. */
    public Optional<Map<String, Object>> latest(String contentCode) {
        List<Map<String, Object>> rows = jdbc.query("""
                SELECT content_version_id, version_number, review_stage, decision, note, reviewer, decided_at
                  FROM content_review_note
                 WHERE tenant_id = 'platform' AND content_code = ?
                 ORDER BY decided_at DESC, note_id DESC LIMIT 1
                """, (rs, row) -> {
                    Map<String, Object> view = new LinkedHashMap<>();
                    view.put("contentVersionId", rs.getLong("content_version_id"));
                    view.put("versionNumber", rs.getInt("version_number"));
                    view.put("reviewStage", rs.getString("review_stage"));
                    view.put("decision", rs.getString("decision"));
                    view.put("note", rs.getString("note"));
                    view.put("reviewer", rs.getString("reviewer"));
                    Instant at = JdbcContentJson.instant(rs, "decided_at");
                    view.put("decidedAt", at == null ? null : at.toString());
                    return view;
                }, contentCode);
        return rows.stream().findFirst();
    }
}
