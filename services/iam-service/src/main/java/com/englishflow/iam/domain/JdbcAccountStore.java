package com.englishflow.iam.domain;

import org.springframework.dao.DataAccessException;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.sql.ResultSet;
import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.util.Arrays;
import java.util.LinkedHashSet;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

/** Durable IAM account store. Passwords are stored only as BCrypt/Argon-compatible hashes. */
public class JdbcAccountStore implements AccountStore {
    private final JdbcTemplate jdbc;

    public JdbcAccountStore(JdbcTemplate jdbc) { this.jdbc = Objects.requireNonNull(jdbc, "jdbc"); }

    @Override
    @Transactional(transactionManager = "iamTransactionManager")
    public AccountRecord save(AccountRecord account) {
        try {
            jdbc.update("INSERT INTO iam_principal (principal_id, tenant_id, status) VALUES (?, ?, 'ACTIVE')",
                    account.principalId().toString(), TenantScope.PLATFORM_TENANT);
            jdbc.update("INSERT INTO iam_account (principal_id, identifier, password_hash, roles, permissions, "
                            + "status, failed_attempts, locked_until, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    account.principalId().toString(), account.identifier(), account.passwordHash(), csv(account.roles()),
                    csv(account.permissions()), account.status().name(), account.failedAttempts(),
                    account.lockedUntil() == null ? null : Timestamp.from(account.lockedUntil()),
                    Timestamp.from(account.createdAt()), Timestamp.from(account.updatedAt()));
            return account;
        } catch (DuplicateKeyException exception) {
            throw new IamPolicyException(IamDecisionCode.ACCOUNT_CONFLICT, "iam.account.already_exists");
        } catch (DataAccessException | IllegalArgumentException exception) {
            throw unavailable(exception);
        }
    }

    @Override
    public Optional<AccountRecord> findByIdentifier(String identifier) {
        return query("SELECT principal_id, identifier, password_hash, roles, permissions, status, failed_attempts, "
                + "locked_until, created_at, updated_at FROM iam_account WHERE identifier = ?",
                AccountRecord.normalizeIdentifier(identifier));
    }

    @Override
    public Optional<AccountRecord> findByPrincipalId(PrincipalId principalId) {
        return query("SELECT principal_id, identifier, password_hash, roles, permissions, status, failed_attempts, "
                + "locked_until, created_at, updated_at FROM iam_account WHERE principal_id = ?",
                principalId.toString());
    }

    /**
     * Performs the expensive password check before taking the account row lock. The later locking
     * read is a MySQL current read, so a password reset may complete during BCrypt and the login
     * then fails closed without mutating the new credential epoch if principal/hash changed. A
     * missing identifier returns after the dummy check and therefore never takes an InnoDB gap lock.
     */
    @Override
    @Transactional(transactionManager = "iamTransactionManager")
    public PasswordLoginResult authenticatePassword(
            String identifier,
            String dummyPasswordHash,
            PasswordHashVerifier verifier,
            Instant at,
            int maxAttempts,
            Duration lockDuration
    ) {
        try {
            Objects.requireNonNull(dummyPasswordHash, "dummyPasswordHash");
            Objects.requireNonNull(verifier, "verifier");
            Objects.requireNonNull(at, "at");
            String normalizedIdentifier = AccountRecord.normalizeIdentifier(identifier);
            AccountRecord observed = query("SELECT principal_id, identifier, password_hash, roles, permissions, status, failed_attempts, "
                            + "locked_until, created_at, updated_at FROM iam_account WHERE identifier = ?",
                    normalizedIdentifier).orElse(null);
            boolean passwordMatches = verifier.matches(
                    observed == null ? dummyPasswordHash : observed.passwordHash());
            if (observed == null) {
                return new PasswordLoginResult(null, IamDecisionCode.INVALID_CREDENTIALS);
            }
            AccountRecord current = query("SELECT principal_id, identifier, password_hash, roles, permissions, status, failed_attempts, "
                            + "locked_until, created_at, updated_at FROM iam_account WHERE identifier = ? FOR UPDATE",
                    normalizedIdentifier).orElse(null);
            if (current == null) {
                return new PasswordLoginResult(null, IamDecisionCode.INVALID_CREDENTIALS);
            }
            boolean credentialUnchanged = current.principalId().equals(observed.principalId())
                    && sameHash(current.passwordHash(), observed.passwordHash());
            if (!credentialUnchanged) {
                return new PasswordLoginResult(current, IamDecisionCode.INVALID_CREDENTIALS);
            }
            if (current.status() == AccountStatus.DISABLED || current.status() == AccountStatus.DELETED) {
                return new PasswordLoginResult(current, IamDecisionCode.INVALID_CREDENTIALS);
            }
            if (current.status() == AccountStatus.LOCKED) {
                if (current.lockedUntil() == null || current.lockedUntil().isAfter(at)) {
                    return new PasswordLoginResult(current, IamDecisionCode.ACCOUNT_LOCKED);
                }
                current = current.unlocked(at);
            }
            if (!passwordMatches) {
                Duration effectiveLockDuration = positive(lockDuration, Duration.ofMinutes(15));
                AccountRecord failed = current.failedLogin(
                        at, Math.max(1, maxAttempts), at.plus(effectiveLockDuration));
                updateLoginSecurity(failed);
                return new PasswordLoginResult(failed, failed.status() == AccountStatus.LOCKED
                        ? IamDecisionCode.ACCOUNT_LOCKED
                        : IamDecisionCode.INVALID_CREDENTIALS);
            }
            AccountRecord loggedIn = current.successfulLogin(at);
            updateLoginSecurity(loggedIn);
            return new PasswordLoginResult(loggedIn, IamDecisionCode.ACCOUNT_LOGIN);
        } catch (IamPolicyException exception) {
            throw exception;
        } catch (DataAccessException | IllegalArgumentException exception) {
            throw unavailable(exception);
        }
    }

    /**
     * Serializes failed-attempt accounting at the MySQL row boundary. A JVM monitor in
     * PasswordAccountService cannot protect two IAM processes; SELECT ... FOR UPDATE keeps the
     * counter and lock transition from being lost under concurrent invalid passwords.
     */
    @Override
    @Transactional(transactionManager = "iamTransactionManager")
    public AccountRecord recordFailedLogin(AccountRecord observed, Instant at, int maxAttempts,
                                           Duration lockDuration) {
        try {
            AccountRecord current = query("SELECT principal_id, identifier, password_hash, roles, permissions, status, failed_attempts, "
                            + "locked_until, created_at, updated_at FROM iam_account WHERE principal_id = ? FOR UPDATE",
                    observed.principalId().toString()).orElseThrow(() -> unavailable(null));
            if (current.status() == AccountStatus.DISABLED) return current;
            if (current.status() == AccountStatus.LOCKED
                    && current.lockedUntil() != null && current.lockedUntil().isAfter(at)) {
                return current;
            }
            if (current.status() == AccountStatus.LOCKED) current = current.unlocked(at);
            AccountRecord failed = current.failedLogin(at, Math.max(1, maxAttempts),
                    at.plus(lockDuration == null || lockDuration.isNegative() || lockDuration.isZero()
                            ? Duration.ofMinutes(15) : lockDuration));
            int updated = jdbc.update("UPDATE iam_account SET status = ?, failed_attempts = ?, locked_until = ?, updated_at = ? "
                            + "WHERE principal_id = ?",
                    failed.status().name(), failed.failedAttempts(),
                    failed.lockedUntil() == null ? null : Timestamp.from(failed.lockedUntil()),
                    Timestamp.from(failed.updatedAt()), failed.principalId().toString());
            if (updated != 1) throw unavailable(null);
            return failed;
        } catch (IamPolicyException exception) {
            throw exception;
        } catch (DataAccessException | IllegalArgumentException exception) {
            throw unavailable(exception);
        }
    }

    @Override
    @Transactional(transactionManager = "iamTransactionManager")
    public AccountRecord recordSuccessfulLogin(AccountRecord observed, Instant at) {
        try {
            AccountRecord current = query("SELECT principal_id, identifier, password_hash, roles, permissions, status, failed_attempts, "
                            + "locked_until, created_at, updated_at FROM iam_account WHERE principal_id = ? FOR UPDATE",
                    observed.principalId().toString()).orElseThrow(() -> unavailable(null));
            // A stale successful-password check must never clear a newer lock or disabled
            // account. An expired lock may be cleared only after the current row is re-read.
            if (current.status() == AccountStatus.DISABLED) return current;
            AccountStatus persistedStatus = current.status();
            if (current.status() == AccountStatus.LOCKED) {
                if (current.lockedUntil() == null || current.lockedUntil().isAfter(at)) return current;
                current = current.unlocked(at);
            }
            AccountRecord loggedIn = current.successfulLogin(at);
            int updated = jdbc.update("UPDATE iam_account SET status = ?, failed_attempts = 0, locked_until = NULL, updated_at = ? "
                            + "WHERE principal_id = ? AND status = ?",
                    loggedIn.status().name(), Timestamp.from(loggedIn.updatedAt()), loggedIn.principalId().toString(),
                    persistedStatus.name());
            if (updated != 1) throw unavailable(null);
            return loggedIn;
        } catch (IamPolicyException exception) {
            throw exception;
        } catch (DataAccessException | IllegalArgumentException exception) {
            throw unavailable(exception);
        }
    }

    @Override
    @Transactional(transactionManager = "iamTransactionManager", readOnly = true)
    public java.util.List<AccountRecord> findLocked(java.time.Instant at, int limit) {
        java.util.Objects.requireNonNull(at, "instant is required");
        int bound = Math.max(1, Math.min(limit <= 0 ? 50 : limit, 100));
        try {
            return jdbc.query("SELECT principal_id, identifier, password_hash, roles, permissions, status, failed_attempts, "
                            + "locked_until, created_at, updated_at FROM iam_account "
                            + "WHERE status = 'LOCKED' AND locked_until IS NOT NULL AND locked_until > ? "
                            + "ORDER BY updated_at LIMIT " + bound,
                    (ResultSet rs, int rowNum) -> map(rs), java.sql.Timestamp.from(at));
        } catch (DataAccessException | IllegalArgumentException exception) {
            throw unavailable(exception);
        }
    }

    @Override
    @Transactional(transactionManager = "iamTransactionManager")
    public AccountRecord replace(AccountRecord account) {
        try {
            int updated = jdbc.update("UPDATE iam_account SET identifier = ?, password_hash = ?, roles = ?, permissions = ?, "
                            + "status = ?, failed_attempts = ?, locked_until = ?, updated_at = ? WHERE principal_id = ?",
                    account.identifier(), account.passwordHash(), csv(account.roles()), csv(account.permissions()),
                    account.status().name(), account.failedAttempts(),
                    account.lockedUntil() == null ? null : Timestamp.from(account.lockedUntil()),
                    Timestamp.from(account.updatedAt()), account.principalId().toString());
            if (updated != 1) throw unavailable(null);
            return account;
        } catch (DataAccessException | IllegalArgumentException exception) {
            throw unavailable(exception);
        }
    }

    @Override
    @Transactional(transactionManager = "iamTransactionManager")
    public AccountRecord changePassword(PrincipalId principalId, String passwordHash, Instant at) {
        try {
            AccountRecord current = query("SELECT principal_id, identifier, password_hash, roles, permissions, status, failed_attempts, "
                            + "locked_until, created_at, updated_at FROM iam_account WHERE principal_id = ? FOR UPDATE",
                    principalId.toString()).orElseThrow(() -> new IamPolicyException(
                            IamDecisionCode.PRINCIPAL_NOT_FOUND, "iam.principal.not_found"));
            int updated = jdbc.update("UPDATE iam_account SET password_hash = ?, updated_at = ? "
                            + "WHERE principal_id = ?", passwordHash, Timestamp.from(at), principalId.toString());
            if (updated != 1) throw unavailable(null);
            return current.withPasswordHashPreservingSecurity(passwordHash, at);
        } catch (IamPolicyException exception) {
            throw exception;
        } catch (DataAccessException | IllegalArgumentException exception) {
            throw unavailable(exception);
        }
    }

    private void updateLoginSecurity(AccountRecord account) {
        int updated = jdbc.update("UPDATE iam_account SET status = ?, failed_attempts = ?, locked_until = ?, updated_at = ? "
                        + "WHERE principal_id = ?",
                account.status().name(), account.failedAttempts(),
                account.lockedUntil() == null ? null : Timestamp.from(account.lockedUntil()),
                Timestamp.from(account.updatedAt()), account.principalId().toString());
        if (updated != 1) throw unavailable(null);
    }

    private Optional<AccountRecord> query(String sql, Object argument) {
        try {
            return jdbc.query(sql, (ResultSet rs, int rowNum) -> map(rs), argument).stream().findFirst();
        } catch (DataAccessException | IllegalArgumentException exception) {
            throw unavailable(exception);
        }
    }

    private static AccountRecord map(ResultSet rs) throws java.sql.SQLException {
        Timestamp lockedUntil = rs.getTimestamp("locked_until");
        return new AccountRecord(
                new PrincipalId(UUID.fromString(rs.getString("principal_id"))),
                rs.getString("identifier"), rs.getString("password_hash"),
                parseSet(rs.getString("roles")), parseSet(rs.getString("permissions")),
                AccountStatus.valueOf(rs.getString("status")), rs.getInt("failed_attempts"),
                lockedUntil == null ? null : lockedUntil.toInstant(),
                rs.getTimestamp("created_at").toInstant(), rs.getTimestamp("updated_at").toInstant());
    }

    private static Set<String> parseSet(String value) {
        if (value == null || value.isBlank()) return Set.of();
        return Set.copyOf(new LinkedHashSet<>(Arrays.asList(value.split(","))));
    }

    private static String csv(Set<String> values) { return String.join(",", values); }

    private static Duration positive(Duration value, Duration fallback) {
        return value == null || value.isNegative() || value.isZero() ? fallback : value;
    }

    private static boolean sameHash(String left, String right) {
        return MessageDigest.isEqual(
                left.getBytes(StandardCharsets.UTF_8),
                right.getBytes(StandardCharsets.UTF_8));
    }

    private static IamPolicyException unavailable(Exception exception) {
        return new IamPolicyException(IamDecisionCode.IAM_PERSISTENCE_UNAVAILABLE,
                "iam.persistence.unavailable");
    }
}
