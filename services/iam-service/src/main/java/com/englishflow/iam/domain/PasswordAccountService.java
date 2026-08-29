package com.englishflow.iam.domain;

import com.englishflow.iam.config.IamServiceProperties;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.Clock;
import java.time.Instant;
import java.util.Objects;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/** Account-password verifier with bounded failed-attempt lockout and non-enumerating failures. */
public final class PasswordAccountService {
    private static final String DUMMY_HASH = "$2a$12$C6UzMDM.H6dfI/f/IKcEe.Vn2xL1Xg9sN8m5p4wJ7w7j9y9e3dF6";
    private static final Set<String> LEARNER_ROLES = Set.of("learner");
    private static final Set<String> LEARNER_PERMISSIONS = Set.of(
            "learner.profile.read", "learner.profile.write", "learning.plan.read",
            "learning.plan.write", "assessment.session.read", "assessment.session.write",
            "content.read", "iam.self.read", "iam.self.write");

    private final AccountStore accounts;
    private final PasswordEncoder passwordEncoder;
    private final AuditFactPort audit;
    private final Clock clock;
    private final IamServiceProperties.AccountProperties properties;
    private final ConcurrentHashMap<String, Object> locks = new ConcurrentHashMap<>();

    public PasswordAccountService(AccountStore accounts, PasswordEncoder passwordEncoder,
                                  AuditFactPort audit, Clock clock, IamServiceProperties properties) {
        this.accounts = Objects.requireNonNull(accounts, "accounts");
        this.passwordEncoder = Objects.requireNonNull(passwordEncoder, "passwordEncoder");
        this.audit = Objects.requireNonNull(audit, "audit");
        this.clock = Objects.requireNonNull(clock, "clock");
        this.properties = Objects.requireNonNull(properties, "properties").getAccount();
    }

    public AccountRecord register(String identifier, String rawPassword, ClientAuthorityClaims clientAuthorityClaims) {
        if (clientAuthorityClaims != null && clientAuthorityClaims.hasOverride()) {
            throw new IamPolicyException(IamDecisionCode.CLIENT_AUTHORITY_OVERRIDE,
                    "iam.authority.client_override_rejected");
        }
        String normalized = AccountRecord.normalizeIdentifier(identifier);
        validatePassword(rawPassword);
        synchronized (locks.computeIfAbsent(normalized, ignored -> new Object())) {
            if (accounts.findByIdentifier(normalized).isPresent()) {
                throw new IamPolicyException(IamDecisionCode.ACCOUNT_CONFLICT, "iam.account.already_exists");
            }
            Instant now = Instant.now(clock);
            AccountRecord account = new AccountRecord(PrincipalId.random(), normalized,
                    passwordEncoder.encode(rawPassword), LEARNER_ROLES, LEARNER_PERMISSIONS,
                    AccountStatus.ACTIVE, 0, null, now, now);
            AccountRecord saved = accounts.save(account);
            appendAudit(saved, IamDecisionCode.ACCOUNT_REGISTERED, "account_registered");
            return saved;
        }
    }

    public AccountRecord authenticate(String identifier, String rawPassword) {
        String normalized = safeIdentifier(identifier);
        AccountRecord account = accounts.findByIdentifier(normalized).orElse(null);
        boolean passwordMatches = account != null && passwordEncoder.matches(rawPassword == null ? "" : rawPassword,
                account.passwordHash());
        if (account == null) {
            passwordEncoder.matches(rawPassword == null ? "" : rawPassword, DUMMY_HASH);
            throw invalidCredentials();
        }
        synchronized (locks.computeIfAbsent(normalized, ignored -> new Object())) {
            Instant now = Instant.now(clock);
            if (account.status() == AccountStatus.DISABLED) throw invalidCredentials();
            if (account.status() == AccountStatus.LOCKED) {
                if (account.lockedUntil() == null || account.lockedUntil().isAfter(now)) {
                    appendAudit(account, IamDecisionCode.ACCOUNT_LOCKED, "account_locked");
                    throw new IamPolicyException(IamDecisionCode.ACCOUNT_LOCKED, "iam.account.locked");
                }
                account = accounts.replace(account.unlocked(now));
            }
            if (!passwordMatches) {
                Instant lockUntil = now.plus(positive(properties.getLockDuration(), java.time.Duration.ofMinutes(15)));
                AccountRecord failed = accounts.replace(account.failedLogin(now,
                        Math.max(1, properties.getMaxFailedAttempts()), lockUntil));
                appendAudit(failed, failed.status() == AccountStatus.LOCKED
                        ? IamDecisionCode.ACCOUNT_LOCKED : IamDecisionCode.INVALID_CREDENTIALS,
                        failed.status() == AccountStatus.LOCKED ? "account_locked" : "login_failed");
                if (failed.status() == AccountStatus.LOCKED) {
                    throw new IamPolicyException(IamDecisionCode.ACCOUNT_LOCKED, "iam.account.locked");
                }
                throw invalidCredentials();
            }
            AccountRecord loggedIn = accounts.replace(account.successfulLogin(now));
            appendAudit(loggedIn, IamDecisionCode.ACCOUNT_LOGIN, "account_login");
            return loggedIn;
        }
    }

    public AccountRecord find(PrincipalId principalId) {
        return accounts.findByPrincipalId(principalId).orElseThrow(() ->
                new IamPolicyException(IamDecisionCode.PRINCIPAL_NOT_FOUND, "iam.principal.not_found"));
    }

    public AccountRecord changePassword(PrincipalId principalId, String rawPassword) {
        validatePassword(rawPassword);
        AccountRecord current = find(principalId);
        AccountRecord changed = accounts.replace(current.withPasswordHash(passwordEncoder.encode(rawPassword), Instant.now(clock)));
        appendAudit(changed, IamDecisionCode.PASSWORD_RESET_COMPLETED, "password_reset_completed");
        return changed;
    }

    private void validatePassword(String rawPassword) {
        if (rawPassword == null || rawPassword.length() < Math.max(8, properties.getPasswordMinLength())
                || rawPassword.length() > 128 || rawPassword.chars().anyMatch(Character::isISOControl)) {
            throw new IamPolicyException(IamDecisionCode.INVALID_REQUEST, "iam.password.invalid");
        }
    }

    private static String safeIdentifier(String value) {
        try { return AccountRecord.normalizeIdentifier(value); }
        catch (RuntimeException ignored) { throw invalidCredentials(); }
    }

    private static IamPolicyException invalidCredentials() {
        return new IamPolicyException(IamDecisionCode.INVALID_CREDENTIALS, "iam.credentials.invalid");
    }

    private void appendAudit(AccountRecord account, IamDecisionCode code, String type) {
        audit.append(AuditDecision.of(type, code, code != IamDecisionCode.INVALID_CREDENTIALS,
                TenantScope.derive(account.principalId()), Instant.now(clock), Set.of(), Set.of()));
    }

    private static java.time.Duration positive(java.time.Duration value, java.time.Duration fallback) {
        return value == null || value.isNegative() || value.isZero() ? fallback : value;
    }
}
