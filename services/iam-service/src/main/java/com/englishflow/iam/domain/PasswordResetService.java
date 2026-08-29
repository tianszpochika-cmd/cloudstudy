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
    private final SecureRandom random = new SecureRandom();

    public PasswordResetService(AccountStore accounts, PasswordResetChallengeStore challenges,
                                PasswordAccountService passwords, AuditFactPort audit, Clock clock,
                                IamServiceProperties properties) {
        this.accounts = Objects.requireNonNull(accounts, "accounts");
        this.challenges = Objects.requireNonNull(challenges, "challenges");
        this.passwords = Objects.requireNonNull(passwords, "passwords");
        this.audit = Objects.requireNonNull(audit, "audit");
        this.clock = Objects.requireNonNull(clock, "clock");
        this.properties = Objects.requireNonNull(properties, "properties").getAccount();
    }

    /** Returns no token to HTTP callers; a delivery adapter must send it out-of-band. */
    public void request(String identifier) {
        AccountRecord account;
        try {
            account = accounts.findByIdentifier(AccountRecord.normalizeIdentifier(identifier)).orElse(null);
        } catch (RuntimeException ignored) {
            return;
        }
        if (account == null) return;
        Instant now = Instant.now(clock);
        String token = randomToken();
        PasswordResetChallenge challenge = new PasswordResetChallenge(
                UUIDs.random(), account.principalId(), SecretDigests.sha256Hex(token), now,
                now.plus(positive(properties.getResetTokenTtl(), java.time.Duration.ofMinutes(15))), false);
        challenges.save(challenge);
        audit.append(AuditDecision.of("password_reset_requested", IamDecisionCode.PASSWORD_RESET_REQUESTED,
                true, TenantScope.derive(account.principalId()), now, java.util.Set.of(), java.util.Set.of()));
        // The delivery port is not part of the HTTP contract. Never log or return token.
    }

    public AccountRecord confirm(String identifier, String token, String newPassword) {
        if (identifier == null || identifier.isBlank() || token == null || token.isBlank()) invalid();
        PasswordResetChallenge challenge = challenges.findByTokenDigest(SecretDigests.sha256Hex(token))
                .orElseThrow(() -> new IamPolicyException(IamDecisionCode.PASSWORD_RESET_INVALID,
                        "iam.password_reset.invalid"));
        Instant now = Instant.now(clock);
        if (challenge.consumed() || !challenge.expiresAt().isAfter(now)) invalid();
        AccountRecord account = passwords.find(challenge.principalId());
        if (!account.identifier().equals(AccountRecord.normalizeIdentifier(identifier))) invalid();
        PasswordResetChallenge consumed = challenges.consume(challenge.challengeId());
        AccountRecord changed = passwords.changePassword(consumed.principalId(), newPassword);
        audit.append(AuditDecision.of("password_reset_confirmed", IamDecisionCode.PASSWORD_RESET_COMPLETED,
                true, TenantScope.derive(changed.principalId()), now, java.util.Set.of(), java.util.Set.of()));
        return changed;
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

    private static final class UUIDs {
        static String random() { return java.util.UUID.randomUUID().toString(); }
    }
}
