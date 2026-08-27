package com.englishflow.gamification.adapter.jdbc;

import com.englishflow.gamification.domain.GamificationPersistenceException;
import com.englishflow.gamification.port.UserTimeZonePort;
import java.time.ZoneId;
import java.util.Objects;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;

/** Reads the service-owned local mirror of the subject timezone without cross-schema joins. */
public final class JdbcUserTimeZonePort implements UserTimeZonePort {

    private final JdbcTemplate jdbc;
    private final ZoneId fallback;

    public JdbcUserTimeZonePort(JdbcTemplate jdbc, ZoneId fallback) {
        this.jdbc = Objects.requireNonNull(jdbc, "jdbc");
        this.fallback = Objects.requireNonNull(fallback, "fallback");
    }

    @Override
    public ZoneId zoneFor(String subjectId) {
        try {
            String value = jdbc.queryForObject(
                    "SELECT time_zone FROM gamification_user_timezone WHERE subject_id = ?",
                    String.class, subjectId);
            return ZoneId.of(value);
        } catch (EmptyResultDataAccessException ignored) {
            return fallback;
        } catch (RuntimeException exception) {
            throw new GamificationPersistenceException("gamification timezone fact could not be read", exception);
        }
    }
}
