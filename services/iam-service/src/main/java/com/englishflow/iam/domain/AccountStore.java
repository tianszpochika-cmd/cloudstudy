package com.englishflow.iam.domain;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Duration;
import java.time.Instant;
import java.util.Objects;
import java.util.Optional;

/** IAM-owned account persistence boundary. */
public interface AccountStore {
    AccountRecord save(AccountRecord account);
    Optional<AccountRecord> findByIdentifier(String identifier);
    Optional<AccountRecord> findByPrincipalId(PrincipalId principalId);
    AccountRecord replace(AccountRecord account);

    /**
     * Verifies one observed password hash without a store lock, then applies the result against the
     * current account state under the store lock. A changed principal/hash fails closed without
     * mutating the new credential epoch's counter or lock state. The dummy hash keeps a missing
     * account request on the same single password-check path without taking a gap lock.
     */
    default PasswordLoginResult authenticatePassword(
            String identifier,
            String dummyPasswordHash,
            PasswordHashVerifier verifier,
            Instant at,
            int maxAttempts,
            Duration lockDuration
    ) {
        Objects.requireNonNull(dummyPasswordHash, "dummyPasswordHash");
        Objects.requireNonNull(verifier, "verifier");
        Objects.requireNonNull(at, "at");
        AccountRecord observed = findByIdentifier(identifier).orElse(null);
        boolean passwordMatches = verifier.matches(
                observed == null ? dummyPasswordHash : observed.passwordHash());
        if (observed == null) {
            return new PasswordLoginResult(null, IamDecisionCode.INVALID_CREDENTIALS);
        }
        synchronized (this) {
            AccountRecord current = findByIdentifier(identifier).orElse(null);
            if (current == null) {
                return new PasswordLoginResult(null, IamDecisionCode.INVALID_CREDENTIALS);
            }
            boolean credentialUnchanged = current.principalId().equals(observed.principalId())
                    && sameHash(current.passwordHash(), observed.passwordHash());
            if (!credentialUnchanged) {
                return new PasswordLoginResult(current, IamDecisionCode.INVALID_CREDENTIALS);
            }
            if (current.status() == AccountStatus.DISABLED || current.status() == AccountStatus.DELETED) {
                // Deleted accounts deny exactly like disabled ones: no state change,
                // so a login can never resurrect a deleted account (M6-008).
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
                AccountRecord failed = replace(current.failedLogin(
                        at, Math.max(1, maxAttempts), at.plus(effectiveLockDuration)));
                return new PasswordLoginResult(failed, failed.status() == AccountStatus.LOCKED
                        ? IamDecisionCode.ACCOUNT_LOCKED
                        : IamDecisionCode.INVALID_CREDENTIALS);
            }
            return new PasswordLoginResult(replace(current.successfulLogin(at)), IamDecisionCode.ACCOUNT_LOGIN);
        }
    }

    /** Updates only the password hash from the store's current row, preserving newer security facts. */
    default AccountRecord changePassword(PrincipalId principalId, String passwordHash, Instant at) {
        synchronized (this) {
            AccountRecord current = findByPrincipalId(principalId).orElseThrow(() ->
                    new IamPolicyException(IamDecisionCode.PRINCIPAL_NOT_FOUND, "iam.principal.not_found"));
            return replace(current.withPasswordHashPreservingSecurity(passwordHash, at));
        }
    }

    /**
     * Records one failed password attempt at the store boundary. Durable stores override this
     * with a row-lock/CAS implementation so two IAM processes cannot overwrite one another's
     * failed-attempt counter. The default is intentionally retained for local test stores.
     */
    default AccountRecord recordFailedLogin(AccountRecord observed, Instant at, int maxAttempts,
                                              Duration lockDuration) {
        synchronized (this) {
            return replace(observed.failedLogin(at, maxAttempts, at.plus(lockDuration)));
        }
    }

    /** Records a successful login without allowing a stale snapshot to clear a newer lock. */
    default AccountRecord recordSuccessfulLogin(AccountRecord observed, Instant at) {
        synchronized (this) {
            return replace(observed.successfulLogin(at));
        }
    }

    @FunctionalInterface
    interface PasswordHashVerifier {
        boolean matches(String encodedPassword);
    }

    record PasswordLoginResult(AccountRecord account, IamDecisionCode decisionCode) {
        public PasswordLoginResult {
            Objects.requireNonNull(decisionCode, "decisionCode");
            if (account == null && decisionCode != IamDecisionCode.INVALID_CREDENTIALS) {
                throw new IllegalArgumentException("only a missing account may omit the account result");
            }
        }
    }

    private static Duration positive(Duration value, Duration fallback) {
        return value == null || value.isNegative() || value.isZero() ? fallback : value;
    }

    private static boolean sameHash(String left, String right) {
        return MessageDigest.isEqual(
                left.getBytes(StandardCharsets.UTF_8),
                right.getBytes(StandardCharsets.UTF_8));
    }
}
