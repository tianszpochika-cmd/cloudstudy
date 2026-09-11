package com.englishflow.iam.domain;

import com.englishflow.iam.config.IamServiceProperties;

import java.security.SecureRandom;
import java.time.Clock;
import java.time.Instant;
import java.util.Base64;
import java.util.Objects;

/** One-time password reset boundary. Delivery is intentionally outside IAM. */
public final class PasswordResetService {
    private final AccountStore accounts;
    private final PasswordResetChallengeStore challenges;
    private final PasswordAccountService passwords;
    private final AuditFactPort audit;
    private final Clock clock;
    private final IamServiceProperties.AccountProperties properties;
    private final SessionService sessions;
    private final IamTransactionRunner transactions;
    private final RateLimitStore rateLimits;
    private final PasswordResetDeliveryPort delivery;
    private final String resetTargetSecret;
    private final SecureRandom random = new SecureRandom();

    public PasswordResetService(AccountStore accounts, PasswordResetChallengeStore challenges,
                                PasswordAccountService passwords, AuditFactPort audit, Clock clock,
                                IamServiceProperties properties, SessionService sessions,
                                IamTransactionRunner transactions, RateLimitStore rateLimits,
                                PasswordResetDeliveryPort delivery, String resetTargetSecret) {
        this.accounts = Objects.requireNonNull(accounts, "accounts");
        this.challenges = Objects.requireNonNull(challenges, "challenges");
        this.passwords = Objects.requireNonNull(passwords, "passwords");
        this.audit = Objects.requireNonNull(audit, "audit");
        this.clock = Objects.requireNonNull(clock, "clock");
        this.properties = Objects.requireNonNull(properties, "properties").getAccount();
        this.sessions = sessions;
        this.transactions = Objects.requireNonNull(transactions, "transactions");
        this.rateLimits = rateLimits;
        this.delivery = Objects.requireNonNull(delivery, "delivery");
        if (resetTargetSecret == null || resetTargetSecret.trim().length() < 32) {
            throw new IllegalArgumentException("password reset target secret must be at least 32 characters");
        }
        this.resetTargetSecret = resetTargetSecret;
    }

    /** Returns no token to HTTP callers; the delivery port sends it out-of-band. */
    public void request(String identifier) {
        Instant now = Instant.now(clock);
        String normalizedIdentifier;
        try {
            normalizedIdentifier = AccountRecord.normalizeIdentifier(identifier);
        } catch (RuntimeException ignored) {
            // A malformed identifier is indistinguishable from an unknown account: audit the
            // denied attempt with an unresolved subject and keep the public response uniform.
            appendAudit(AuditDecision.unresolved("password_reset_denied",
                    IamDecisionCode.PASSWORD_RESET_INVALID, false, now));
            return;
        }
        if (rateLimits != null && !rateLimits.allow("password_reset", rateKey(normalizedIdentifier), now,
                Math.max(1, properties.getResetRequestsPerMinute()), java.time.Duration.ofMinutes(1))) {
            appendAudit(AuditDecision.unresolved("password_reset_rate_limited",
                    IamDecisionCode.RATE_LIMITED, false, now));
            throw new IamPolicyException(IamDecisionCode.RATE_LIMITED, "iam.password_reset.rate_limited");
        }
        AccountRecord account;
        try {
            account = accounts.findByIdentifier(normalizedIdentifier).orElse(null);
        } catch (IamPolicyException exception) {
            if (exception.code() == IamDecisionCode.IAM_PERSISTENCE_UNAVAILABLE) throw exception;
            appendAudit(AuditDecision.unresolved("password_reset_denied",
                    IamDecisionCode.PASSWORD_RESET_INVALID, false, now));
            return;
        } catch (RuntimeException ignored) {
            appendAudit(AuditDecision.unresolved("password_reset_denied",
                    IamDecisionCode.PASSWORD_RESET_INVALID, false, now));
            return;
        }
        if (account == null) {
            appendAudit(AuditDecision.unresolved("password_reset_denied",
                    IamDecisionCode.PASSWORD_RESET_INVALID, false, now));
            return;
        }
        if (account.status() == AccountStatus.DISABLED) {
            // A disabled account must never receive a live challenge, and the caller still sees
            // the same accepted result as every other identifier.
            appendAudit(AuditDecision.of("password_reset_denied", IamDecisionCode.PASSWORD_RESET_INVALID,
                    false, TenantScope.derive(account.principalId()), now, java.util.Set.of(), java.util.Set.of()));
            return;
        }
        String token = randomToken();
        PasswordResetChallenge challenge = new PasswordResetChallenge(
                UUIDs.random(), account.principalId(), SecretDigests.sha256Hex(token), now,
                now.plus(positive(properties.getResetTokenTtl(), java.time.Duration.ofMinutes(15))), false);
        challenges.save(challenge);
        appendAudit(AuditDecision.of("password_reset_requested", IamDecisionCode.PASSWORD_RESET_REQUESTED,
                true, TenantScope.derive(account.principalId()), now, java.util.Set.of(), java.util.Set.of()));
        handOff(challenge, account, token, now);
    }

    private void handOff(PasswordResetChallenge challenge, AccountRecord account, String token, Instant now) {
        TenantScope scope = TenantScope.derive(account.principalId());
        if (!delivery.provisioned()) {
            // No deployment-provisioned transport is wired yet. The accepted response never
            // claims delivery; the denied handoff is durable in audit for operations.
            appendAudit(AuditDecision.of("password_reset_delivery_unprovisioned",
                    IamDecisionCode.POLICY_UNAVAILABLE, false, scope, now, java.util.Set.of(), java.util.Set.of()));
            return;
        }
        try {
            delivery.deliver(new PasswordResetDelivery(challenge.challengeId(), account.principalId(),
                    account.identifier(), token, challenge.expiresAt()));
        } catch (RuntimeException exception) {
            // The public response stays non-enumerating and never exposes transport state.
            appendAudit(AuditDecision.of("password_reset_delivery_failed",
                    IamDecisionCode.POLICY_UNAVAILABLE, false, scope, now, java.util.Set.of(), java.util.Set.of()));
        }
    }

    public AccountRecord confirm(String identifier, String token, String newPassword) {
        ConfirmOutcome outcome = transactions.execute(() -> {
            try {
                return new ConfirmOutcome(confirmWithinTransaction(identifier, token, newPassword), null);
            } catch (IamPolicyException exception) {
                if (infrastructureFailure(exception.code())) throw exception;
                // Keep the transaction callback successful so an expected invalid/consumed
                // challenge does not poison the caller's idempotency transaction.
                return new ConfirmOutcome(null, exception);
            }
        });
        if (outcome.failure() != null) throw outcome.failure();
        return outcome.account();
    }

    private AccountRecord confirmWithinTransaction(String identifier, String token, String newPassword) {
        if (identifier == null || identifier.isBlank() || token == null || token.isBlank()) invalid();
        validatePasswordShape(newPassword);
        PasswordResetChallenge challenge = challenges.findByTokenDigest(SecretDigests.sha256Hex(token))
                .orElseThrow(() -> new IamPolicyException(IamDecisionCode.PASSWORD_RESET_INVALID,
                        "iam.password_reset.invalid"));
        Instant now = Instant.now(clock);
        if (challenge.consumed() || !challenge.expiresAt().isAfter(now)) invalid();
        AccountRecord account = passwords.find(challenge.principalId());
        if (account.status() == AccountStatus.DISABLED) invalid();
        if (!account.identifier().equals(AccountRecord.normalizeIdentifier(identifier))) invalid();
        PasswordResetChallenge consumed = challenges.consume(challenge.challengeId());
        AccountRecord changed = passwords.changePassword(consumed.principalId(), newPassword);
        if (sessions != null) sessions.revokeAll(changed.principalId(), "password_reset");
        appendAudit(AuditDecision.of("password_reset_confirmed", IamDecisionCode.PASSWORD_RESET_COMPLETED,
                true, TenantScope.derive(changed.principalId()), now, java.util.Set.of(), java.util.Set.of()));
        return changed;
    }

    private void validatePasswordShape(String rawPassword) {
        if (rawPassword == null || rawPassword.length() < Math.max(8, properties.getPasswordMinLength())
                || rawPassword.length() > 128 || rawPassword.chars().anyMatch(Character::isISOControl)) {
            throw new IamPolicyException(IamDecisionCode.INVALID_REQUEST, "iam.password.invalid");
        }
    }

    private void appendAudit(AuditDecision decision) {
        try {
            audit.append(decision);
        } catch (RuntimeException exception) {
            throw new IamPolicyException(IamDecisionCode.AUDIT_UNAVAILABLE, "iam.audit.unavailable");
        }
    }

    private void invalid() {
        throw new IamPolicyException(IamDecisionCode.PASSWORD_RESET_INVALID, "iam.password_reset.invalid");
    }

    private String randomToken() {
        byte[] bytes = new byte[48];
        random.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private static java.time.Duration positive(java.time.Duration value, java.time.Duration fallback) {
        return value == null || value.isNegative() || value.isZero() ? fallback : value;
    }

    private String rateKey(String normalizedIdentifier) {
        // Keyed so an attacker cannot confirm a guessable email by recomputing the bucket key.
        return SecretDigests.hmacSha256Hex(resetTargetSecret,
                "iam-password-reset-target:" + normalizedIdentifier);
    }

    private static boolean infrastructureFailure(IamDecisionCode code) {
        return switch (code) {
            case AUDIT_UNAVAILABLE, IAM_PERSISTENCE_UNAVAILABLE, SESSION_STORE_UNAVAILABLE,
                    IDEMPOTENCY_RESULT_UNAVAILABLE -> true;
            default -> false;
        };
    }

    private record ConfirmOutcome(AccountRecord account, IamPolicyException failure) {}

    private static final class UUIDs {
        static String random() { return java.util.UUID.randomUUID().toString(); }
    }
}
