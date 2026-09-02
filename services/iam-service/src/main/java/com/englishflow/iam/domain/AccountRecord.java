package com.englishflow.iam.domain;

import java.time.Instant;
import java.util.LinkedHashSet;
import java.util.Objects;
import java.util.Set;

/** IAM-owned account fact. The password field is always a one-way hash. */
public record AccountRecord(
        PrincipalId principalId,
        String identifier,
        String passwordHash,
        Set<String> roles,
        Set<String> permissions,
        AccountStatus status,
        int failedAttempts,
        Instant lockedUntil,
        Instant createdAt,
        Instant updatedAt) {

    public AccountRecord {
        Objects.requireNonNull(principalId, "principalId");
        identifier = normalizeIdentifier(identifier);
        Objects.requireNonNull(passwordHash, "passwordHash");
        if (passwordHash.isBlank() || passwordHash.length() > 512) {
            throw new IllegalArgumentException("password hash is invalid");
        }
        roles = safeSet(roles);
        permissions = safeSet(permissions);
        Objects.requireNonNull(status, "status");
        if (failedAttempts < 0) {
            throw new IllegalArgumentException("failed attempts cannot be negative");
        }
        Objects.requireNonNull(createdAt, "createdAt");
        Objects.requireNonNull(updatedAt, "updatedAt");
        if (status == AccountStatus.LOCKED && lockedUntil == null) {
            throw new IllegalArgumentException("locked account requires lock expiry");
        }
    }

    public static String normalizeIdentifier(String value) {
        Objects.requireNonNull(value, "identifier");
        String normalized = value.trim().toLowerCase(java.util.Locale.ROOT);
        if (normalized.length() < 3 || normalized.length() > 128
                || normalized.chars().anyMatch(Character::isISOControl)
                || normalized.chars().anyMatch(Character::isWhitespace)) {
            throw new IllegalArgumentException("identifier is invalid");
        }
        return normalized;
    }

    private static Set<String> safeSet(Set<String> values) {
        if (values == null) return Set.of();
        LinkedHashSet<String> copy = new LinkedHashSet<>();
        for (String value : values) {
            if (value == null || value.isBlank() || value.length() > 256
                    || value.chars().anyMatch(Character::isWhitespace)) {
                throw new IllegalArgumentException("authority value is invalid");
            }
            copy.add(value);
        }
        return Set.copyOf(copy);
    }

    public AccountRecord successfulLogin(Instant at) {
        return new AccountRecord(principalId, identifier, passwordHash, roles, permissions,
                AccountStatus.ACTIVE, 0, null, createdAt, at);
    }

    public AccountRecord failedLogin(Instant at, int maxAttempts, Instant lockUntil) {
        int attempts = failedAttempts + 1;
        boolean locked = attempts >= maxAttempts;
        return new AccountRecord(principalId, identifier, passwordHash, roles, permissions,
                locked ? AccountStatus.LOCKED : status, attempts, locked ? lockUntil : this.lockedUntil,
                createdAt, at);
    }

    public AccountRecord unlocked(Instant at) {
        return new AccountRecord(principalId, identifier, passwordHash, roles, permissions,
                AccountStatus.ACTIVE, 0, null, createdAt, at);
    }

    public AccountRecord withPasswordHash(String nextHash, Instant at) {
        return new AccountRecord(principalId, identifier, nextHash, roles, permissions,
                AccountStatus.ACTIVE, 0, null, createdAt, at);
    }

    /** Changes credentials without allowing a stale reset request to clear newer lock facts. */
    public AccountRecord withPasswordHashPreservingSecurity(String nextHash, Instant at) {
        return new AccountRecord(principalId, identifier, nextHash, roles, permissions,
                status, failedAttempts, lockedUntil, createdAt, at);
    }

    public AccountRecord withPermissions(Set<String> nextPermissions) {
        return new AccountRecord(principalId, identifier, passwordHash, roles, nextPermissions,
                status, failedAttempts, lockedUntil, createdAt, updatedAt);
    }
}
