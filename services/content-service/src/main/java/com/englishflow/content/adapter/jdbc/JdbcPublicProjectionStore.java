package com.englishflow.content.adapter.jdbc;

import com.englishflow.content.domain.ContentAudience;
import com.englishflow.content.domain.ContentId;
import com.englishflow.content.domain.ContentOperationException;
import com.englishflow.content.domain.ContentVersionId;
import com.englishflow.content.domain.PublicContentProjection;
import com.englishflow.content.port.PublicProjectionStore;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Clock;
import java.time.Instant;
import java.util.Optional;

import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import tools.jackson.databind.ObjectMapper;

/** Durable public/learner projection store with status and rights re-checks on every read. */
public final class JdbcPublicProjectionStore implements PublicProjectionStore {

    private static final Logger LOG = LoggerFactory.getLogger(JdbcPublicProjectionStore.class);

    private static final String FIND_SQL = """
            SELECT p.content_id, p.content_version_id, p.kind, p.title, p.locale, p.target_level,
                   p.goal_code, p.audience, p.fields_json, p.content_hash, p.generated_at
              FROM content_public_projection p
              JOIN content_definition c ON c.content_id = p.content_id
              JOIN content_version v
                ON v.content_id = p.content_id AND v.content_version_id = p.content_version_id
             WHERE p.content_id = ? AND p.content_version_id = ? AND p.audience = ?
               AND v.copyright_status = 'ACTIVE'
               AND v.rights_allows_learning = TRUE
               AND v.rights_permitted_channels IS NOT NULL
               AND (v.rights_starts_at IS NULL OR v.rights_starts_at <= ?)
               AND (v.rights_expires_at IS NULL OR v.rights_expires_at > ?)
               AND JSON_CONTAINS(v.rights_permitted_channels, JSON_QUOTE(?))
               AND (v.status = 'PUBLISHED' AND
                    (? = 'LEARNER' OR c.current_published_version_id = v.content_version_id))
            """;

    private static final String UPSERT_SQL = """
            INSERT INTO content_public_projection
                (content_id, content_version_id, audience, kind, title, locale, target_level,
                 goal_code, fields_json, content_hash, generated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE kind = VALUES(kind), title = VALUES(title), locale = VALUES(locale),
                target_level = VALUES(target_level), goal_code = VALUES(goal_code),
                fields_json = VALUES(fields_json), content_hash = VALUES(content_hash), generated_at = VALUES(generated_at)
            """;

    private final JdbcTemplate jdbc;
    private final ObjectMapper objectMapper;
    private final Clock clock;

    public JdbcPublicProjectionStore(JdbcTemplate jdbc, ObjectMapper objectMapper, Clock clock) {
        this.jdbc = java.util.Objects.requireNonNull(jdbc, "jdbc is required");
        this.objectMapper = java.util.Objects.requireNonNull(objectMapper, "object mapper is required");
        this.clock = java.util.Objects.requireNonNull(clock, "clock is required");
    }

    @Override
    public Optional<PublicContentProjection> find(
            ContentId contentId,
            ContentVersionId versionId,
            ContentAudience audience) {
        java.util.Objects.requireNonNull(contentId, "content id is required");
        java.util.Objects.requireNonNull(versionId, "version id is required");
        java.util.Objects.requireNonNull(audience, "audience is required");
        if (audience != ContentAudience.PUBLIC && audience != ContentAudience.LEARNER) {
            return Optional.empty();
        }
        Instant now = clock.instant();
        try {
            return jdbc.query(
                    FIND_SQL,
                    resultSet -> resultSet.next() ? Optional.of(map(resultSet)) : Optional.empty(),
                    contentId.value(), versionId.value(), audience.name(),
                    JdbcContentJson.timestamp(now), JdbcContentJson.timestamp(now), audience.name(), audience.name());
        } catch (DataAccessException exception) {
            LOG.warn("content projection query failed for contentId={}, versionId={}, audience={}",
                    contentId.value(), versionId.value(), audience, exception);
            throw ContentOperationException.unavailable(
                    "CONTENT_PERSISTENCE_UNAVAILABLE", "content projection could not be read");
        }
    }

    @Override
    public void put(PublicContentProjection projection) {
        java.util.Objects.requireNonNull(projection, "projection is required");
        if (projection.audience() != ContentAudience.PUBLIC && projection.audience() != ContentAudience.LEARNER) {
            throw ContentOperationException.forbidden(
                    "CONTENT_PROJECTION_AUDIENCE_INVALID", "only public and learner projections are durable");
        }
        if (projection.containsAnswerRules()) {
            throw ContentOperationException.forbidden(
                    "ANSWER_RULE_LEAK_BLOCKED", "answer rules cannot be stored in a public projection");
        }
        try {
            jdbc.update(UPSERT_SQL,
                    projection.contentId().value(), projection.versionId().value(), projection.audience().name(),
                    projection.kind().name(), projection.title(), projection.locale(), projection.targetLevel(),
                    projection.goalCode(), JdbcContentJson.write(
                            objectMapper, projection.fields(), "content projection could not be encoded"),
                    projection.contentHash(), JdbcContentJson.timestamp(projection.generatedAt()));
        } catch (DataAccessException exception) {
            throw ContentOperationException.unavailable(
                    "CONTENT_PERSISTENCE_UNAVAILABLE", "content projection could not be saved");
        }
    }

    @Override
    public void remove(ContentId contentId, ContentVersionId versionId) {
        try {
            jdbc.update("DELETE FROM content_public_projection WHERE content_id = ? AND content_version_id = ?",
                    contentId.value(), versionId.value());
        } catch (DataAccessException exception) {
            throw ContentOperationException.unavailable(
                    "CONTENT_PERSISTENCE_UNAVAILABLE", "content projection could not be removed");
        }
    }

    private PublicContentProjection map(ResultSet resultSet) throws SQLException {
        return new PublicContentProjection(
                new ContentId(resultSet.getString("content_id")),
                new ContentVersionId(resultSet.getLong("content_version_id")),
                com.englishflow.content.domain.ContentKind.valueOf(resultSet.getString("kind")),
                resultSet.getString("title"), resultSet.getString("locale"),
                resultSet.getString("target_level"), resultSet.getString("goal_code"),
                ContentAudience.valueOf(resultSet.getString("audience")),
                JdbcContentJson.readMap(objectMapper, resultSet.getString("fields_json"),
                        "stored content projection is unreadable"), resultSet.getString("content_hash"),
                JdbcContentJson.instant(resultSet, "generated_at"));
    }
}
