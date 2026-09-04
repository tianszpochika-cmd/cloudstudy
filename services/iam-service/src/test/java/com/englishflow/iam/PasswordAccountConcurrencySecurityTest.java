package com.englishflow.iam;

import com.englishflow.iam.config.IamServiceProperties;
import com.englishflow.iam.domain.AccountRecord;
import com.englishflow.iam.domain.AccountStatus;
import com.englishflow.iam.domain.AccountStore;
import com.englishflow.iam.domain.IamDecisionCode;
import com.englishflow.iam.domain.IamPolicyException;
import com.englishflow.iam.domain.InMemoryAccountStore;
import com.englishflow.iam.domain.InMemoryAuditFactPort;
import com.englishflow.iam.domain.JdbcAccountStore;
import com.englishflow.iam.domain.PasswordAccountService;
import com.englishflow.iam.domain.PrincipalId;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class PasswordAccountConcurrencySecurityTest {
    private static final Instant NOW = Instant.parse("2026-09-04T00:00:00Z");
    private static final Clock CLOCK = Clock.fixed(NOW, ZoneOffset.UTC);
    private static final String CURRENT_PASSWORD = "Current password 2026!";
    private static final String RESET_PASSWORD = "Reset password 2026!";

    @Test
    void missingDisabledAndNormalFailuresEachRunOneValidCost12BcryptCheck() {
        RecordingPasswordEncoder encoder = new RecordingPasswordEncoder();
        InMemoryAccountStore store = new InMemoryAccountStore();
        store.save(account("disabled@example.com", encoder.encode(CURRENT_PASSWORD), AccountStatus.DISABLED));
        store.save(account("active@example.com", encoder.encode(CURRENT_PASSWORD), AccountStatus.ACTIVE));
        PasswordAccountService service = new PasswordAccountService(
                store, encoder, decision -> { }, CLOCK, new IamServiceProperties());

        assertInvalidCredentials(() -> service.authenticate("missing@example.com", RESET_PASSWORD));
        assertSingleCost12Check(encoder);

        encoder.clearChecks();
        assertInvalidCredentials(() -> service.authenticate("disabled@example.com", RESET_PASSWORD));
        assertSingleCost12Check(encoder);

        encoder.clearChecks();
        assertInvalidCredentials(() -> service.authenticate("active@example.com", RESET_PASSWORD));
        assertSingleCost12Check(encoder);
    }

    @Test
    void defaultStoreRejectsAStalePasswordWithoutMutatingTheNewCredentialEpoch() {
        BCryptPasswordEncoder encoder = new BCryptPasswordEncoder(12);
        AccountRecord staleBeforeReset = account(
                "race@example.com", encoder.encode(CURRENT_PASSWORD), AccountStatus.ACTIVE);
        AccountRecord currentAfterReset = staleBeforeReset.withPasswordHashPreservingSecurity(
                encoder.encode(RESET_PASSWORD), NOW.plusSeconds(1));
        ResetRaceAccountStore store = new ResetRaceAccountStore(staleBeforeReset, currentAfterReset);
        PasswordAccountService service = new PasswordAccountService(
                store, encoder, decision -> { }, CLOCK, new IamServiceProperties());

        IamPolicyException rejected = assertThrows(IamPolicyException.class,
                () -> service.authenticate("race@example.com", CURRENT_PASSWORD));

        assertEquals(IamDecisionCode.INVALID_CREDENTIALS, rejected.code());
        assertEquals(2, store.identifierReads);
        assertEquals(0, store.replaceCalls,
                "a changed credential epoch must be rejected without recording a failed attempt");
        assertEquals(currentAfterReset.passwordHash(), store.current.passwordHash());
        assertEquals(0, store.current.failedAttempts());
        assertEquals(AccountStatus.ACTIVE, store.current.status());
    }

    @Test
    void jdbcAuthenticationChecksWithoutALockThenRejectsAChangedCurrentHash() {
        BCryptPasswordEncoder encoder = new BCryptPasswordEncoder(12);
        String observedHash = encoder.encode(CURRENT_PASSWORD);
        String resetHash = encoder.encode(RESET_PASSWORD);
        AccountRecord observed = account("jdbc-race@example.com", observedHash, AccountStatus.ACTIVE);
        AccountRecord current = observed.withPasswordHashPreservingSecurity(resetHash, NOW.plusSeconds(1));
        StubJdbcTemplate jdbc = new StubJdbcTemplate(observed, current);
        JdbcAccountStore store = new JdbcAccountStore(jdbc);
        AtomicReference<String> verifiedHash = new AtomicReference<>();

        AccountStore.PasswordLoginResult result = store.authenticatePassword(
                "jdbc-race@example.com",
                encoder.encode("dummy-password"),
                hash -> {
                    verifiedHash.set(hash);
                    return encoder.matches(CURRENT_PASSWORD, hash);
                },
                NOW,
                5,
                Duration.ofMinutes(15));

        assertEquals(IamDecisionCode.INVALID_CREDENTIALS, result.decisionCode());
        assertEquals(observedHash, verifiedHash.get());
        assertEquals(2, jdbc.selectSql.size());
        assertFalse(jdbc.selectSql.get(0).endsWith(" FOR UPDATE"),
                "BCrypt must run after a non-locking consistent read");
        assertTrue(jdbc.selectSql.get(1).endsWith(" FOR UPDATE"),
                "the current password hash and counter must be re-read under the row lock");
        assertEquals(resetHash, result.account().passwordHash());
        assertEquals(0, result.account().failedAttempts());
        assertEquals(AccountStatus.ACTIVE, result.account().status());
        assertNull(jdbc.updateSql,
                "a changed credential epoch must not update current security state");
    }

    @Test
    void missingJdbcIdentifierRunsTheDummyCheckWithoutTakingAGapLock() {
        BCryptPasswordEncoder encoder = new BCryptPasswordEncoder(12);
        String dummyHash = encoder.encode("non-account dummy password");
        StubJdbcTemplate jdbc = new StubJdbcTemplate(null, null);
        JdbcAccountStore store = new JdbcAccountStore(jdbc);
        AtomicReference<String> verifiedHash = new AtomicReference<>();

        AccountStore.PasswordLoginResult result = store.authenticatePassword(
                "missing-jdbc@example.com",
                dummyHash,
                hash -> {
                    verifiedHash.set(hash);
                    return encoder.matches(CURRENT_PASSWORD, hash);
                },
                NOW,
                5,
                Duration.ofMinutes(15));

        assertEquals(IamDecisionCode.INVALID_CREDENTIALS, result.decisionCode());
        assertEquals(dummyHash, verifiedHash.get());
        assertEquals(1, jdbc.selectSql.size());
        assertFalse(jdbc.selectSql.getFirst().endsWith(" FOR UPDATE"));
    }

    @Test
    void lockedAccountAuditIsADenyDecision() {
        BCryptPasswordEncoder encoder = new BCryptPasswordEncoder(12);
        InMemoryAccountStore store = new InMemoryAccountStore();
        AccountRecord active = account("locked@example.com", encoder.encode(CURRENT_PASSWORD), AccountStatus.ACTIVE);
        AccountRecord locked = active.failedLogin(NOW, 1, NOW.plus(Duration.ofMinutes(15)));
        store.save(locked);
        InMemoryAuditFactPort audit = new InMemoryAuditFactPort();
        PasswordAccountService service = new PasswordAccountService(
                store, encoder, audit, CLOCK, new IamServiceProperties());

        IamPolicyException rejected = assertThrows(IamPolicyException.class,
                () -> service.authenticate("locked@example.com", RESET_PASSWORD));

        assertEquals(IamDecisionCode.ACCOUNT_LOCKED, rejected.code());
        assertEquals(1, audit.decisions().size());
        assertEquals(IamDecisionCode.ACCOUNT_LOCKED, audit.decisions().getFirst().code());
        assertFalse(audit.decisions().getFirst().allowed());
    }

    private static AccountRecord account(String identifier, String passwordHash, AccountStatus status) {
        return new AccountRecord(
                PrincipalId.random(), identifier, passwordHash, Set.of("learner"), Set.of("iam.self.read"),
                status, 0, null, NOW, NOW);
    }

    private static void assertInvalidCredentials(Runnable request) {
        IamPolicyException rejected = assertThrows(IamPolicyException.class, request::run);
        assertEquals(IamDecisionCode.INVALID_CREDENTIALS, rejected.code());
    }

    private static void assertSingleCost12Check(RecordingPasswordEncoder encoder) {
        assertEquals(1, encoder.checkedHashes.size());
        String checkedHash = encoder.checkedHashes.getFirst();
        assertEquals(60, checkedHash.length());
        assertTrue(checkedHash.matches("^\\$2[aby]\\$12\\$[./A-Za-z0-9]{53}$"));
    }

    private static final class RecordingPasswordEncoder implements PasswordEncoder {
        private final BCryptPasswordEncoder delegate = new BCryptPasswordEncoder(12);
        private final List<String> checkedHashes = new ArrayList<>();

        @Override
        public String encode(CharSequence rawPassword) {
            return delegate.encode(rawPassword);
        }

        @Override
        public boolean matches(CharSequence rawPassword, String encodedPassword) {
            checkedHashes.add(encodedPassword);
            return delegate.matches(rawPassword, encodedPassword);
        }

        void clearChecks() {
            checkedHashes.clear();
        }
    }

    /** Models the exact old race: the pre-lock read is stale, while the store's current row is reset. */
    private static final class ResetRaceAccountStore implements AccountStore {
        private final AccountRecord staleSnapshot;
        private AccountRecord current;
        private int identifierReads;
        private int replaceCalls;

        private ResetRaceAccountStore(AccountRecord staleSnapshot, AccountRecord current) {
            this.staleSnapshot = staleSnapshot;
            this.current = current;
        }

        @Override
        public AccountRecord save(AccountRecord account) {
            current = account;
            return account;
        }

        @Override
        public Optional<AccountRecord> findByIdentifier(String identifier) {
            identifierReads++;
            return Optional.of(identifierReads == 1 ? staleSnapshot : current);
        }

        @Override
        public Optional<AccountRecord> findByPrincipalId(PrincipalId principalId) {
            return Optional.of(current);
        }

        @Override
        public AccountRecord replace(AccountRecord account) {
            replaceCalls++;
            current = account;
            return account;
        }
    }

    private static final class StubJdbcTemplate extends JdbcTemplate {
        private final AccountRecord observed;
        private final AccountRecord current;
        private final List<String> selectSql = new ArrayList<>();
        private String updateSql;

        private StubJdbcTemplate(AccountRecord observed, AccountRecord current) {
            this.observed = observed;
            this.current = current;
        }

        @Override
        @SuppressWarnings("unchecked")
        public <T> List<T> query(String sql, RowMapper<T> rowMapper, Object... args) {
            selectSql.add(sql);
            AccountRecord selected = sql.endsWith(" FOR UPDATE") ? current : observed;
            return selected == null ? List.of() : List.of((T) selected);
        }

        @Override
        public int update(String sql, Object... args) {
            updateSql = sql;
            return 1;
        }
    }
}
