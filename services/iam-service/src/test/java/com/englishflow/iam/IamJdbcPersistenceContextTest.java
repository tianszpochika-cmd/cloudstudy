package com.englishflow.iam;

import com.englishflow.iam.domain.AccountRecord;
import com.englishflow.iam.domain.AccountStore;
import com.englishflow.iam.domain.AccountStatus;
import com.englishflow.iam.domain.PrincipalId;
import com.englishflow.iam.domain.IdempotencyService;
import com.englishflow.iam.domain.IdempotencyStore;
import com.englishflow.iam.domain.IamTransactionRunner;
import com.englishflow.iam.domain.IamDecisionCode;
import com.englishflow.iam.domain.IamPolicyException;
import com.englishflow.iam.domain.DeviceId;
import com.englishflow.iam.domain.ServerPrincipalContext;
import com.englishflow.iam.domain.SessionRecord;
import com.englishflow.iam.domain.SessionService;
import com.englishflow.iam.domain.SessionStatus;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.core.type.TypeReference;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;

import java.util.Set;
import java.time.Duration;
import java.time.Instant;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

/**
 * Opt-in smoke check for the local MySQL/Flyway context. It is deliberately skipped in the
 * ordinary unit-test run so an unavailable external dependency cannot be mistaken for a pass.
 */
@SpringBootTest(
        classes = IamServiceApplication.class,
        webEnvironment = SpringBootTest.WebEnvironment.MOCK,
        properties = {
                "iam.persistence.enabled=true",
                "iam.persistence.jdbc-url=${IAM_JDBC_URL:jdbc:mysql://127.0.0.1:13306/iam_service?useUnicode=true&characterEncoding=utf8&serverTimezone=UTC}",
                "iam.persistence.username=${IAM_JDBC_USERNAME:iam_runtime}",
                "iam.persistence.password=${IAM_JDBC_PASSWORD:}",
                "spring.flyway.enabled=true",
                "iam.idempotency.replay-secret=test-only-idempotency-replay-secret",
                "iam.jwt.ephemeral-keys-allowed=true",
                "management.opentelemetry.enabled=false",
                "management.tracing.export.enabled=false",
                "management.otlp.metrics.export.enabled=false",
                "management.otlp.tracing.export.enabled=false"
        })
@ActiveProfiles("test")
@EnabledIfSystemProperty(named = "iam.jdbc.integration", matches = "true")
class IamJdbcPersistenceContextTest {

    private static final Set<String> REQUIRED_TABLES = Set.of(
            "iam_account",
            "iam_principal",
            "iam_session",
            "iam_refresh_token_history",
            "iam_device",
            "iam_decision_audit",
                "iam_consent",
                "iam_password_reset_challenge",
            "iam_idempotency_record",
            "iam_rate_limit");

    @Autowired
    private JdbcTemplate jdbc;

    @Autowired
    private AccountStore accounts;

    @Autowired
    private IdempotencyService idempotency;

    @Autowired
    private IdempotencyStore idempotencyStore;

    @Autowired
    private IamTransactionRunner transactions;

    @Autowired
    private SessionService sessions;

    @Test
    void flywayCreatesAllIamFactTablesInTheConfiguredMySql() {
        Integer applied = jdbc.queryForObject(
                "SELECT COUNT(*) FROM flyway_schema_history WHERE success = 1", Integer.class);
        assertTrue(applied != null && applied >= 7, "expected IAM Flyway migrations to be applied");

        for (String table : REQUIRED_TABLES) {
            Integer present = jdbc.queryForObject(
                    "SELECT COUNT(*) FROM information_schema.tables "
                            + "WHERE table_schema = DATABASE() AND table_name = ?",
                    Integer.class, table);
            assertTrue(present != null && present == 1, "missing IAM table " + table);
        }

        Set<String> forbiddenCredentialColumns = Set.of(
                "response_body", "response_headers", "access_token", "refresh_token", "cookie", "password");
        for (String column : forbiddenCredentialColumns) {
            Integer present = jdbc.queryForObject(
                    "SELECT COUNT(*) FROM information_schema.columns "
                            + "WHERE table_schema = DATABASE() AND table_name = 'iam_idempotency_record' AND column_name = ?",
                    Integer.class, column);
            assertTrue(present != null && present == 0, "idempotency table must not persist credential column " + column);
        }
        for (String column : Set.of("response_ciphertext", "response_nonce", "response_key_version",
                "error_code", "error_message_key")) {
            Integer present = jdbc.queryForObject(
                    "SELECT COUNT(*) FROM information_schema.columns "
                            + "WHERE table_schema = DATABASE() AND table_name = 'iam_idempotency_record' AND column_name = ?",
                    Integer.class, column);
            assertTrue(present != null && present == 1, "missing idempotency snapshot column " + column);
        }
    }

    @Test
    void jdbcIdempotencySnapshotReplaysAfterLaterOperationAndRejectsPersist() {
        String scope = "/integration/refresh/" + UUID.randomUUID();
        String firstKey = "jdbc-k1-123456789";
        String secondKey = "jdbc-k2-123456789";
        TypeReference<String> type = new TypeReference<>() {};
        String firstHash = idempotency.fingerprint("K1", "refresh");
        String secondHash = idempotency.fingerprint("K2", "refresh");
        try {
            ResponseEntity<String> first = idempotency.execute(scope, firstKey, firstHash, type,
                    () -> new IdempotencyService.Execution<>(ResponseEntity.ok()
                            .header(HttpHeaders.SET_COOKIE, "refresh=opaque-secret; HttpOnly")
                            .body("access-opaque-secret"), "session-ref"),
                    record -> ResponseEntity.status(500).body("fallback-must-not-run"));
            byte[][] snapshotColumns = jdbc.queryForObject(
                    "SELECT response_ciphertext, response_nonce FROM iam_idempotency_record "
                            + "WHERE scope_key = ? AND idempotency_key = ?",
                    (rs, rowNum) -> new byte[][]{rs.getBytes(1), rs.getBytes(2)}, scope, firstKey);
            String keyVersion = jdbc.queryForObject(
                    "SELECT response_key_version FROM iam_idempotency_record "
                            + "WHERE scope_key = ? AND idempotency_key = ?", String.class, scope, firstKey);
            assertTrue(snapshotColumns != null && snapshotColumns[0] != null
                            && snapshotColumns[0].length > 0 && snapshotColumns[1] != null
                            && snapshotColumns[1].length == 12 && "v1".equals(keyVersion)
                            && !Arrays.equals(snapshotColumns[0], "access-opaque-secret".getBytes(StandardCharsets.UTF_8))
                            && !new String(snapshotColumns[0], StandardCharsets.UTF_8).contains("opaque-secret"),
                    "V9 must persist only encrypted response ciphertext, nonce and key version");
            idempotency.execute(scope, secondKey, secondHash, type,
                    () -> new IdempotencyService.Execution<>(ResponseEntity.ok("later"), "later"),
                    record -> ResponseEntity.status(500).body("fallback-must-not-run"));
            IdempotencyService restarted = new IdempotencyService(idempotencyStore,
                    new com.englishflow.iam.config.IamRuntimeConfiguration().iamObjectMapper(), transactions,
                    "test-only-idempotency-replay-secret", Duration.ofHours(24));
            ResponseEntity<String> replay = restarted.execute(scope, firstKey, firstHash, type,
                    () -> new IdempotencyService.Execution<>(ResponseEntity.ok("must-not-run"), "bad"),
                    record -> ResponseEntity.status(500).body("fallback-must-not-run"));
            assertTrue(first.getStatusCode().equals(replay.getStatusCode())
                            && first.getBody().equals(replay.getBody())
                            && first.getHeaders().get(HttpHeaders.SET_COOKIE)
                            .equals(replay.getHeaders().get(HttpHeaders.SET_COOKIE)),
                    "JDBC replay must return the original encrypted snapshot exactly");
        } finally {
            jdbc.update("DELETE FROM iam_idempotency_record WHERE scope_key = ?", scope);
        }
    }

    @Test
    void jdbcReplayRejectionCommitsSessionRevocationAndAudit() {
        PrincipalId principal = new PrincipalId(UUID.randomUUID());
        SessionService.SessionCreation creation = sessions.open(
                ServerPrincipalContext.forPlatform(principal, Set.of("learner")),
                new DeviceId(UUID.randomUUID().toString()));
        SessionRecord session = creation.session();
        sessions.rotate(session.sessionId(), creation.refreshToken());
        String scope = "/integration/replay-rejection/" + UUID.randomUUID();
        String key = "jdbc-replay-123456";
        String hash = idempotency.fingerprint("old-refresh", session.sessionId());
        TypeReference<String> type = new TypeReference<>() {};
        try {
            IamPolicyException failure = assertThrows(IamPolicyException.class, () ->
                    idempotency.execute(scope, key, hash, type,
                            () -> {
                                sessions.rotate(session.sessionId(), creation.refreshToken());
                                return new IdempotencyService.Execution<>(ResponseEntity.ok("must-not-run"), "bad");
                            }, record -> ResponseEntity.ok("must-not-run")));
            assertEquals(IamDecisionCode.SESSION_REPLAY, failure.code());
            assertEquals(SessionStatus.REVOKED, sessions.find(session.sessionId()).status(),
                    "replay security revocation must commit with the rejected response");
            String state = jdbc.queryForObject(
                    "SELECT state FROM iam_idempotency_record WHERE scope_key = ? AND idempotency_key = ?",
                    String.class, scope, key);
            assertEquals("REJECTED", state, "expected policy failure must be durably replayable");
            Integer auditCount = jdbc.queryForObject(
                    "SELECT COUNT(*) FROM iam_decision_audit WHERE principal_id = ? "
                            + "AND reason_code = 'session_replay' AND decision = 'DENY'",
                    Integer.class, principal.toString());
            assertTrue(auditCount != null && auditCount >= 1,
                    "replay revoke and deny audit must commit even though HTTP operation fails");
        } finally {
            jdbc.update("DELETE FROM iam_idempotency_record WHERE scope_key = ?", scope);
            jdbc.update("DELETE FROM iam_decision_audit WHERE principal_id = ?", principal.toString());
            jdbc.update("DELETE FROM iam_refresh_token_history WHERE session_id = ?", session.sessionId().toString());
            jdbc.update("DELETE FROM iam_session WHERE session_id = ?", session.sessionId().toString());
        }
    }

    @Test
    void accountFailedAttemptsAreRowLockedAndStaleSuccessCannotClearLock() {
        PrincipalId principal = new PrincipalId(UUID.randomUUID());
        Instant now = Instant.now();
        AccountRecord observed = new AccountRecord(principal, "jdbc-lock-" + principal + "@example.com",
                "$2a$12$C6UzMDM.H6dfI/f/IKcEeVn2xL1Xg9sN8m5p4wJ7w7j9y9e3dF6",
                Set.of("learner"), Set.of("iam.self.read"), AccountStatus.ACTIVE, 0, null, now, now);
        try {
            accounts.save(observed);
            AccountRecord first = accounts.recordFailedLogin(observed, now, 5, Duration.ofMinutes(15));
            AccountRecord second = accounts.recordFailedLogin(observed, now.plusMillis(1), 5, Duration.ofMinutes(15));
            assertTrue(first.failedAttempts() == 1 && second.failedAttempts() == 2,
                    "failed attempts must increment from the locked current row, not a stale snapshot");

            AccountRecord locked = accounts.recordFailedLogin(observed, now.plusMillis(2), 1, Duration.ofMinutes(15));
            assertTrue(locked.status() == AccountStatus.LOCKED);
            AccountRecord staleSuccess = accounts.recordSuccessfulLogin(observed, now.plusMillis(3));
            assertTrue(staleSuccess.status() == AccountStatus.LOCKED,
                    "a stale successful login must not clear a newer lock");
            AccountRecord persisted = accounts.findByPrincipalId(principal).orElseThrow();
            assertTrue(persisted.status() == AccountStatus.LOCKED && persisted.failedAttempts() >= 3);
            AccountRecord afterExpiry = accounts.recordSuccessfulLogin(observed, now.plus(Duration.ofMinutes(16)));
            assertTrue(afterExpiry.status() == AccountStatus.ACTIVE && afterExpiry.failedAttempts() == 0,
                    "only an expired current-row lock may be cleared by a successful login");
        } finally {
            jdbc.update("DELETE FROM iam_account WHERE principal_id = ?", principal.toString());
            jdbc.update("DELETE FROM iam_principal WHERE principal_id = ?", principal.toString());
        }
    }
}
