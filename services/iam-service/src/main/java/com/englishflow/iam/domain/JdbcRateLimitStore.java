package com.englishflow.iam.domain;

import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.annotation.Propagation;

import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.util.Objects;

/** MySQL row-lock rate limiter; the key itself is already a non-reversible digest. */
public class JdbcRateLimitStore implements RateLimitStore {
    private final JdbcTemplate jdbc;

    public JdbcRateLimitStore(JdbcTemplate jdbc) { this.jdbc = Objects.requireNonNull(jdbc, "jdbc"); }

    @Override
    @Transactional(transactionManager = "iamTransactionManager", propagation = Propagation.REQUIRES_NEW)
    public boolean allow(String scope, String keyDigest, Instant now, int limit, Duration window) {
        if (limit <= 0) return false;
        Duration effectiveWindow = window == null || window.isNegative() || window.isZero()
                ? Duration.ofMinutes(1) : window;
        try {
            jdbc.update("INSERT INTO iam_rate_limit (scope_key, key_digest, window_started_at, request_count, updated_at) "
                            + "VALUES (?, ?, ?, 0, ? ) ON DUPLICATE KEY UPDATE key_digest = key_digest",
                    scope, digestBytes(keyDigest), Timestamp.from(now), Timestamp.from(now));
            Window current = jdbc.query("SELECT window_started_at, request_count FROM iam_rate_limit "
                            + "WHERE scope_key = ? AND key_digest = ? FOR UPDATE",
                    (rs, rowNum) -> new Window(rs.getTimestamp("window_started_at").toInstant(),
                            rs.getInt("request_count")), scope, digestBytes(keyDigest))
                    .stream().findFirst().orElseThrow(JdbcRateLimitStore::unavailable);
            if (!now.isBefore(current.startedAt().plus(effectiveWindow))) {
                jdbc.update("UPDATE iam_rate_limit SET window_started_at = ?, request_count = 1, updated_at = ? "
                                + "WHERE scope_key = ? AND key_digest = ?",
                        Timestamp.from(now), Timestamp.from(now), scope, digestBytes(keyDigest));
                return true;
            }
            if (current.count() >= limit) return false;
            jdbc.update("UPDATE iam_rate_limit SET request_count = request_count + 1, updated_at = ? "
                            + "WHERE scope_key = ? AND key_digest = ?",
                    Timestamp.from(now), scope, digestBytes(keyDigest));
            return true;
        } catch (DataAccessException | IllegalArgumentException exception) {
            throw unavailable();
        }
    }

    private static byte[] digestBytes(String digest) {
        if (digest == null || !digest.matches("[0-9a-fA-F]{64}")) throw new IllegalArgumentException("key digest");
        return java.util.HexFormat.of().parseHex(digest);
    }

    private static IamPolicyException unavailable() {
        return new IamPolicyException(IamDecisionCode.IAM_PERSISTENCE_UNAVAILABLE,
                "iam.persistence.unavailable");
    }

    private record Window(Instant startedAt, int count) {}
}
