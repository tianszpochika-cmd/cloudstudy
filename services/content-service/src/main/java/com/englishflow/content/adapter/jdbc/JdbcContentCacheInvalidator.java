package com.englishflow.content.adapter.jdbc;

import com.englishflow.content.domain.ContentId;
import com.englishflow.content.domain.ContentOperationException;
import com.englishflow.content.domain.ContentVersionId;
import com.englishflow.content.port.ContentCacheInvalidator;

import java.time.Clock;

import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;

/** Durable invalidation intent; a cache worker may consume it without changing content ownership. */
public final class JdbcContentCacheInvalidator implements ContentCacheInvalidator {

    private final JdbcTemplate jdbc;
    private final Clock clock;

    public JdbcContentCacheInvalidator(JdbcTemplate jdbc, Clock clock) {
        this.jdbc = java.util.Objects.requireNonNull(jdbc, "jdbc is required");
        this.clock = java.util.Objects.requireNonNull(clock, "clock is required");
    }

    @Override
    public void invalidate(ContentId contentId, ContentVersionId versionId, String reason) {
        try {
            jdbc.update("""
                    INSERT INTO content_cache_invalidation
                        (content_id, content_version_id, reason, invalidated_at)
                    VALUES (?, ?, ?, ?)
                    ON DUPLICATE KEY UPDATE invalidated_at = VALUES(invalidated_at)
                    """, contentId.value(), versionId.value(), reason, java.sql.Timestamp.from(clock.instant()));
        } catch (DataAccessException exception) {
            throw ContentOperationException.unavailable(
                    "CONTENT_CACHE_INVALIDATION_UNAVAILABLE", "content cache invalidation could not be persisted");
        }
    }
}
