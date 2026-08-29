package com.englishflow.iam.domain;

import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;

import java.sql.ResultSet;
import java.sql.Timestamp;
import java.util.Arrays;
import java.util.LinkedHashSet;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

/** Durable IAM account store. Passwords are stored only as BCrypt/Argon-compatible hashes. */
public final class JdbcAccountStore implements AccountStore {
    private final JdbcTemplate jdbc;

    public JdbcAccountStore(JdbcTemplate jdbc) { this.jdbc = Objects.requireNonNull(jdbc, "jdbc"); }

    @Override
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

    @Override
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

    private static IamPolicyException unavailable(Exception exception) {
        return new IamPolicyException(IamDecisionCode.IAM_PERSISTENCE_UNAVAILABLE,
                "iam.persistence.unavailable");
    }
}
