package com.englishflow.iam;

import com.englishflow.iam.config.IamServiceProperties;
import com.englishflow.iam.domain.AccountRecord;
import com.englishflow.iam.domain.AccountStore;
import com.englishflow.iam.domain.AccountStatus;
import com.englishflow.iam.domain.PrincipalId;
import com.englishflow.iam.domain.IdempotencyService;
import com.englishflow.iam.domain.IdempotencyStore;
import com.englishflow.iam.domain.IamTransactionRunner;
import com.englishflow.iam.domain.IamDecisionCode;
import com.englishflow.iam.domain.IamPolicyException;
import com.englishflow.iam.domain.PasswordAccountService;
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
import org.springframework.aop.support.AopUtils;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;

import java.util.Set;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

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
                "iam.idempotency.fingerprint-secret=test-only-idempotency-fingerprint-secret",
                "iam.idempotency.v13-writers-drained=true",
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

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private IamServiceProperties properties;

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
        for (String column : Set.of("request_fingerprint", "request_fingerprint_version",
                "replay_ciphertext", "replay_nonce", "replay_key_version",
                "error_code", "error_message_key")) {
            Integer present = jdbc.queryForObject(
                    "SELECT COUNT(*) FROM information_schema.columns "
                            + "WHERE table_schema = DATABASE() AND table_name = 'iam_idempotency_record' AND column_name = ?",
                    Integer.class, column);
            assertTrue(present != null && present == 1, "missing idempotency snapshot column " + column);
        }
        for (String column : Set.of("request_hash", "request_hash_version", "response_ciphertext",
                "response_nonce", "response_key_version")) {
            Integer present = jdbc.queryForObject(
                    "SELECT COUNT(*) FROM information_schema.columns "
                            + "WHERE table_schema = DATABASE() AND table_name = 'iam_idempotency_record' AND column_name = ?",
                    Integer.class, column);
            assertEquals(0, present, "V13 must remove the legacy writer column " + column);
        }
    }

    @Test
    void jdbcIdempotencySnapshotReplaysAfterLaterOperationAndRejectsPersist() {
        String scope = "/api/v1/iam/consents";
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
                    "SELECT replay_ciphertext, replay_nonce FROM iam_idempotency_record "
                            + "WHERE scope_key = ? AND idempotency_key = ?",
                    (rs, rowNum) -> new byte[][]{rs.getBytes(1), rs.getBytes(2)}, scope, firstKey);
            String keyVersion = jdbc.queryForObject(
                    "SELECT replay_key_version FROM iam_idempotency_record "
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
                    "test-only-idempotency-replay-secret",
                    "test-only-idempotency-fingerprint-secret", Duration.ofHours(24));
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

    @Test
    void passwordResetMayCommitDuringBcryptAndTheOldPasswordThenFailsClosed() throws Exception {
        PrincipalId principal = new PrincipalId(UUID.randomUUID());
        String identifier = "jdbc-reset-race-" + principal + "@example.com";
        String oldPassword = "Old password 2026!";
        String newPassword = "New password 2026!";
        String oldHash = passwordEncoder.encode(oldPassword);
        String newHash = passwordEncoder.encode(newPassword);
        Instant now = Instant.now();
        AccountRecord account = new AccountRecord(principal, identifier, oldHash,
                Set.of("learner"), Set.of("iam.self.read"), AccountStatus.ACTIVE,
                0, null, now, now);
        CountDownLatch verificationStarted = new CountDownLatch(1);
        CountDownLatch continueVerification = new CountDownLatch(1);
        PasswordEncoder blockingEncoder = new PasswordEncoder() {
            @Override
            public String encode(CharSequence rawPassword) {
                return passwordEncoder.encode(rawPassword);
            }

            @Override
            public boolean matches(CharSequence rawPassword, String encodedPassword) {
                verificationStarted.countDown();
                awaitLatch(continueVerification);
                return passwordEncoder.matches(rawPassword, encodedPassword);
            }
        };
        PasswordAccountService passwords = new PasswordAccountService(
                accounts, blockingEncoder, decision -> { }, Clock.systemUTC(), properties);
        ExecutorService executor = Executors.newFixedThreadPool(2);
        try {
            accounts.save(account);
            assertTrue(AopUtils.isAopProxy(accounts),
                    "the integration test must exercise Spring's transactional AccountStore proxy");
            Future<IamDecisionCode> login = executor.submit(() -> {
                try {
                    passwords.authenticate(identifier, oldPassword);
                    return IamDecisionCode.ACCOUNT_LOGIN;
                } catch (IamPolicyException exception) {
                    return exception.code();
                }
            });
            assertTrue(verificationStarted.await(15, TimeUnit.SECONDS),
                    "login did not reach the BCrypt callback");

            Future<AccountRecord> reset = executor.submit(() ->
                    accounts.changePassword(principal, newHash, Instant.now()));
            AccountRecord changed = reset.get(15, TimeUnit.SECONDS);
            assertEquals(newHash, changed.passwordHash(),
                    "password reset must not wait for the unlocked BCrypt callback");

            continueVerification.countDown();
            assertEquals(IamDecisionCode.INVALID_CREDENTIALS, login.get(15, TimeUnit.SECONDS),
                    "a password accepted against the pre-reset hash must fail after the locked current read");
            AccountRecord persisted = accounts.findByPrincipalId(principal).orElseThrow();
            assertEquals(newHash, persisted.passwordHash());
            assertEquals(0, persisted.failedAttempts(),
                    "a stale password result must not count against the new credential epoch");
            assertEquals(AccountStatus.ACTIVE, persisted.status());
        } finally {
            continueVerification.countDown();
            executor.shutdownNow();
            jdbc.update("DELETE FROM iam_account WHERE principal_id = ?", principal.toString());
            jdbc.update("DELETE FROM iam_principal WHERE principal_id = ?", principal.toString());
        }
    }

    @Test
    void multipleInFlightOldHashRequestsDoNotPoisonTheNewCredentialEpoch() throws Exception {
        int inFlightRequests = 4;
        PrincipalId principal = new PrincipalId(UUID.randomUUID());
        String identifier = "jdbc-reset-epoch-" + principal + "@example.com";
        String oldPassword = "Old epoch password 2026!";
        String newPassword = "New epoch password 2026!";
        String oldHash = passwordEncoder.encode(oldPassword);
        String newHash = passwordEncoder.encode(newPassword);
        String dummyHash = passwordEncoder.encode("unused epoch dummy");
        Instant now = Instant.now();
        AccountRecord account = new AccountRecord(principal, identifier, oldHash,
                Set.of("learner"), Set.of("iam.self.read"), AccountStatus.ACTIVE,
                0, null, now, now);
        CountDownLatch allVerifying = new CountDownLatch(inFlightRequests);
        CountDownLatch continueVerification = new CountDownLatch(1);
        ExecutorService executor = Executors.newFixedThreadPool(inFlightRequests);
        try {
            accounts.save(account);
            assertTrue(AopUtils.isAopProxy(accounts),
                    "the integration test must exercise Spring's transactional AccountStore proxy");
            List<Future<AccountStore.PasswordLoginResult>> staleLogins = new ArrayList<>();
            for (int index = 0; index < inFlightRequests; index++) {
                Instant attemptAt = now.plusMillis(index + 1L);
                staleLogins.add(executor.submit(() -> accounts.authenticatePassword(
                        identifier,
                        dummyHash,
                        hash -> {
                            allVerifying.countDown();
                            awaitLatch(continueVerification);
                            return passwordEncoder.matches(oldPassword, hash);
                        },
                        attemptAt,
                        2,
                        Duration.ofMinutes(15))));
            }
            assertTrue(allVerifying.await(15, TimeUnit.SECONDS),
                    "all stale requests must observe the old hash before reset");

            AccountRecord reset = accounts.changePassword(principal, newHash, Instant.now());
            assertEquals(newHash, reset.passwordHash(),
                    "reset must commit while all BCrypt callbacks remain in flight");
            continueVerification.countDown();

            for (Future<AccountStore.PasswordLoginResult> staleLogin : staleLogins) {
                AccountStore.PasswordLoginResult result = staleLogin.get(20, TimeUnit.SECONDS);
                assertEquals(IamDecisionCode.INVALID_CREDENTIALS, result.decisionCode());
                assertEquals(0, result.account().failedAttempts());
                assertEquals(AccountStatus.ACTIVE, result.account().status());
            }
            AccountRecord afterStaleLogins = accounts.findByPrincipalId(principal).orElseThrow();
            assertEquals(newHash, afterStaleLogins.passwordHash());
            assertEquals(0, afterStaleLogins.failedAttempts());
            assertEquals(AccountStatus.ACTIVE, afterStaleLogins.status());

            PasswordAccountService currentEpochPasswords = new PasswordAccountService(
                    accounts, passwordEncoder, decision -> { }, Clock.systemUTC(), properties);
            AccountRecord loggedIn = currentEpochPasswords.authenticate(identifier, newPassword);
            assertEquals(principal, loggedIn.principalId());
            assertEquals(0, loggedIn.failedAttempts());
            assertEquals(AccountStatus.ACTIVE, loggedIn.status());
        } finally {
            continueVerification.countDown();
            executor.shutdownNow();
            jdbc.update("DELETE FROM iam_account WHERE principal_id = ?", principal.toString());
            jdbc.update("DELETE FROM iam_principal WHERE principal_id = ?", principal.toString());
        }
    }

    @Test
    void concurrentWrongPasswordsIncrementTheLockedCurrentCounterExactly() throws Exception {
        int attempts = 4;
        PrincipalId principal = new PrincipalId(UUID.randomUUID());
        String identifier = "jdbc-concurrent-failure-" + principal + "@example.com";
        Instant now = Instant.now();
        AccountRecord account = new AccountRecord(principal, identifier,
                passwordEncoder.encode("Correct password 2026!"),
                Set.of("learner"), Set.of("iam.self.read"), AccountStatus.ACTIVE,
                0, null, now, now);
        String dummyHash = passwordEncoder.encode("unused dummy");
        CountDownLatch allVerifying = new CountDownLatch(attempts);
        CountDownLatch continueVerification = new CountDownLatch(1);
        ExecutorService executor = Executors.newFixedThreadPool(attempts);
        try {
            accounts.save(account);
            assertTrue(AopUtils.isAopProxy(accounts),
                    "the integration test must exercise Spring's transactional AccountStore proxy");
            List<Future<AccountStore.PasswordLoginResult>> failures = new ArrayList<>();
            for (int index = 0; index < attempts; index++) {
                Instant attemptAt = now.plusMillis(index + 1L);
                failures.add(executor.submit(() -> accounts.authenticatePassword(
                        identifier,
                        dummyHash,
                        hash -> {
                            allVerifying.countDown();
                            awaitLatch(continueVerification);
                            return passwordEncoder.matches("Wrong password 2026!", hash);
                        },
                        attemptAt,
                        attempts,
                        Duration.ofMinutes(15))));
            }
            assertTrue(allVerifying.await(15, TimeUnit.SECONDS),
                    "every transaction must finish its non-locking read before row-lock accounting starts");
            continueVerification.countDown();

            List<AccountStore.PasswordLoginResult> results = new ArrayList<>();
            for (Future<AccountStore.PasswordLoginResult> failure : failures) {
                results.add(failure.get(20, TimeUnit.SECONDS));
            }
            assertEquals(1L, results.stream()
                    .filter(result -> result.decisionCode() == IamDecisionCode.ACCOUNT_LOCKED)
                    .count());
            assertEquals(attempts - 1L, results.stream()
                    .filter(result -> result.decisionCode() == IamDecisionCode.INVALID_CREDENTIALS)
                    .count());
            AccountRecord persisted = accounts.findByPrincipalId(principal).orElseThrow();
            assertEquals(attempts, persisted.failedAttempts());
            assertEquals(AccountStatus.LOCKED, persisted.status());
        } finally {
            continueVerification.countDown();
            executor.shutdownNow();
            jdbc.update("DELETE FROM iam_account WHERE principal_id = ?", principal.toString());
            jdbc.update("DELETE FROM iam_principal WHERE principal_id = ?", principal.toString());
        }
    }

    @Test
    void auditFailureRollsBackAccountFailureAndIdempotencyClaimTogether() {
        PrincipalId principal = new PrincipalId(UUID.randomUUID());
        String identifier = "jdbc-audit-rollback-" + principal + "@example.com";
        String scope = "/api/v1/auth/login";
        String key = "jdbc-audit-rollback-" + UUID.randomUUID();
        String requestHash = idempotency.fingerprint(identifier, "Wrong password 2026!");
        Instant now = Instant.now();
        AccountRecord account = new AccountRecord(principal, identifier,
                passwordEncoder.encode("Correct password 2026!"),
                Set.of("learner"), Set.of("iam.self.read"), AccountStatus.ACTIVE,
                0, null, now, now);
        PasswordAccountService passwords = new PasswordAccountService(
                accounts,
                passwordEncoder,
                decision -> { throw new IllegalStateException("injected audit outage"); },
                Clock.systemUTC(),
                properties);
        try {
            accounts.save(account);
            assertTrue(AopUtils.isAopProxy(accounts),
                    "the integration test must exercise Spring's transactional AccountStore proxy");

            IamPolicyException failure = assertThrows(IamPolicyException.class, () ->
                    idempotency.execute(scope, key, requestHash,
                            () -> {
                                passwords.authenticate(identifier, "Wrong password 2026!");
                                return new IdempotencyService.Execution<>(ResponseEntity.ok("must-not-run"), "bad");
                            },
                            record -> ResponseEntity.ok("must-not-replay")));

            assertEquals(IamDecisionCode.AUDIT_UNAVAILABLE, failure.code());
            AccountRecord persisted = accounts.findByPrincipalId(principal).orElseThrow();
            assertEquals(0, persisted.failedAttempts(),
                    "the account failure counter must roll back when its required audit fact fails");
            assertEquals(AccountStatus.ACTIVE, persisted.status());
            Integer claimCount = jdbc.queryForObject(
                    "SELECT COUNT(*) FROM iam_idempotency_record WHERE scope_key = ? AND idempotency_key = ?",
                    Integer.class, scope, key);
            assertEquals(0, claimCount,
                    "the idempotency claim must roll back in the same outer transaction");
        } finally {
            jdbc.update("DELETE FROM iam_idempotency_record WHERE scope_key = ? AND idempotency_key = ?", scope, key);
            jdbc.update("DELETE FROM iam_account WHERE principal_id = ?", principal.toString());
            jdbc.update("DELETE FROM iam_principal WHERE principal_id = ?", principal.toString());
        }
    }

    private static void awaitLatch(CountDownLatch latch) {
        try {
            if (!latch.await(30, TimeUnit.SECONDS)) {
                throw new IllegalStateException("timed out waiting for test coordination latch");
            }
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("test coordination interrupted", exception);
        }
    }
}
