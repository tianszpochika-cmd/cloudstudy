package com.englishflow.learning.adapter.http;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.JdbcTemplate;

import com.englishflow.learning.domain.ZeroMistakeProjection;

import tools.jackson.databind.ObjectMapper;

/** Writes admitted assessment mistakes into the learning-owned interaction trail. */
public final class AssessmentMistakeQueueProjector {
    private static final String TENANT = "platform";

    private final HttpAssessmentMistakeFeed feed;
    private final ObjectMapper mapper;

    private AssessmentMistakeQueueProjector(HttpAssessmentMistakeFeed feed, ObjectMapper mapper) {
        this.feed = feed;
        this.mapper = mapper;
    }

    public static AssessmentMistakeQueueProjector disabled() {
        return new AssessmentMistakeQueueProjector(null, null);
    }

    public static AssessmentMistakeQueueProjector http(ObjectMapper mapper, String assessmentBaseUrl) {
        return new AssessmentMistakeQueueProjector(new HttpAssessmentMistakeFeed(mapper, assessmentBaseUrl), mapper);
    }

    public void project(JdbcTemplate jdbc, String subject, String bearer) {
        if (feed == null || jdbc == null || subject == null || subject.isBlank()) return;
        write(jdbc, subject, feed.list(bearer));
    }

    public int write(JdbcTemplate jdbc, String subject, List<Map<String, Object>> admitted) {
        if (jdbc == null || mapper == null) return 0;
        int written = 0;
        for (Map<String, Object> row : ZeroMistakeProjection.rows(subject, admitted)) {
            String key = String.valueOf(row.get("idempotencyKey"));
            Integer existing = jdbc.queryForObject("""
                    SELECT COUNT(*) FROM b3_learning_interaction
                     WHERE tenant_id = ? AND principal_id = ? AND idempotency_key = ?
                    """, Integer.class, TENANT, subject, key);
            if (existing != null && existing > 0) continue;
            try {
                jdbc.update("""
                        INSERT INTO b3_learning_interaction
                            (interaction_id, tenant_id, principal_id, domain_code, action_code, resource_key,
                             idempotency_key, payload_json, result_json, status)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACCEPTED')
                        """,
                        UUID.randomUUID().toString(), TENANT, subject,
                        row.get("domainCode"), row.get("actionCode"), row.get("resourceKey"), key,
                        json(Map.of(
                                "sourceAttemptId", row.get("sourceAttemptId"),
                                "contentCode", row.get("contentCode"),
                                "itemId", row.get("resourceKey"))),
                        json(row.get("result")));
                written++;
            } catch (DuplicateKeyException ignored) {
                // The same target was projected by a concurrent read.
            }
        }
        return written;
    }

    private String json(Object value) {
        try {
            return mapper.writeValueAsString(value);
        } catch (Exception exception) {
            throw new IllegalStateException("mistake projection is not serializable", exception);
        }
    }
}
