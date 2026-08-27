package com.englishflow.content.adapter.jdbc;

import com.englishflow.content.domain.ContentOperationException;
import com.englishflow.content.integration.PublishedContentReadProjection;
import com.englishflow.content.integration.PublishedContentReadProjectionPort;

import java.time.Clock;
import java.time.Instant;
import java.util.Optional;

import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;

/** Trusted service-to-service read seam; HTTP authority headers are not part of this adapter. */
public final class JdbcPublishedContentReadProjectionPort implements PublishedContentReadProjectionPort {

    private static final String FIND_SQL = """
            SELECT v.content_id, v.content_version_id, v.rights_source_code, v.authorization_evidence_ref
              FROM content_definition c
              JOIN content_version v
                ON v.content_id = c.content_id AND v.content_version_id = c.current_published_version_id
             WHERE c.content_id = ? AND c.tenant_id = ? AND v.content_version_id = ?
               AND v.status = 'PUBLISHED' AND v.copyright_status = 'ACTIVE'
               AND v.rights_allows_learning = TRUE
               AND v.authorization_evidence_ref IS NOT NULL
               AND (v.rights_starts_at IS NULL OR v.rights_starts_at <= ?)
               AND (v.rights_expires_at IS NULL OR v.rights_expires_at > ?)
               AND v.rights_permitted_channels IS NOT NULL
               AND JSON_CONTAINS(v.rights_permitted_channels, JSON_QUOTE(?))
            """;

    private final JdbcTemplate jdbc;
    private final Clock clock;

    public JdbcPublishedContentReadProjectionPort(JdbcTemplate jdbc, Clock clock) {
        this.jdbc = java.util.Objects.requireNonNull(jdbc, "jdbc is required");
        this.clock = java.util.Objects.requireNonNull(clock, "clock is required");
    }

    @Override
    public Optional<PublishedContentReadProjection> findPublished(
            String contentId,
            long expectedVersion,
            String tenantId,
            String subject) {
        requireTrustedFact(contentId, "contentId");
        requireTrustedFact(tenantId, "tenantId");
        requireTrustedFact(subject, "subject");
        if (expectedVersion < 1) {
            throw ContentOperationException.badRequest(
                    "CONTENT_VERSION_ID_INVALID", "expected content version must be positive");
        }
        Instant now = clock.instant();
        try {
            return jdbc.query(
                    FIND_SQL,
                    resultSet -> resultSet.next()
                            ? Optional.of(new PublishedContentReadProjection(
                                    resultSet.getString("content_id"),
                                    resultSet.getLong("content_version_id"),
                                    true,
                                    true,
                                    resultSet.getString("authorization_evidence_ref")))
                            : Optional.empty(),
                    contentId, tenantId, expectedVersion,
                    JdbcContentJson.timestamp(now), JdbcContentJson.timestamp(now), "LEARNER");
        } catch (DataAccessException exception) {
            throw ContentOperationException.unavailable(
                    "CONTENT_PERSISTENCE_UNAVAILABLE", "published content could not be read");
        }
    }

    private static void requireTrustedFact(String value, String field) {
        if (value == null || value.isBlank()) {
            throw ContentOperationException.forbidden(
                    "CONTENT_TRUSTED_PRINCIPAL_REQUIRED", field + " must come from a verified service boundary");
        }
    }
}
