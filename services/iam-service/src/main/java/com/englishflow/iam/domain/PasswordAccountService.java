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
    private static final String DUMMY_HASH = "$2a$12$.E3ViZlXxYqOQ1kI0hTnBOjUaLEQkvjLANReLduflGx9udo9iuOj.";
    private static final Set<String> LEARNER_ROLES = Set.of("learner");
    /**
     * Phase-1 learner permission allow-list, granted only after the adult-gate and all
     * LEARNING-required consents are satisfied (see {@code tokenAccount} stripping).
     *
     * <p>P1-LIVE-002: the set was frozen before the learner v2 endpoints existed, so
     * {@code PUT /learner/targets} ({@code learner.target.write}), {@code GET /learner/first-day}
     * ({@code learner.onboarding.read}) and the learning review/progress/mastery/task chains
     * failed closed for every user. Each entry below is required by a service-side
     * {@code authorize(...)} call or a canonical contract {@code requiredPermission}.
     * <p>P1-LIVE-006: W3 (reward/social/entitlement) endpoints failed closed for the
     * same reason. Gamification/social/commerce entries mirror the services' own
     * {@code require*} permission strings; staff-only capabilities
     * ({@code commerce:sku:write}, {@code commerce:activation:write},
     * {@code commerce:reconciliation:read}, {@code admin.*}) are deliberately absent.
     * <p>P1-LIVE-003: the contract names the targets capability
     * {@code learner.target.write}; {@code learner.goal.write} was the implementation-era
     * alias. Issuance mints the canonical name; the learner PEP accepts either so
     * outstanding tokens keep working.
     */
    private static final Set<String> LEARNER_PERMISSIONS = Set.of(
            "learner.profile.read", "learner.profile.write", "learner.target.write",
            "learner.preference.write", "learner.onboarding.read", "learning.plan.read",
            "learning.plan.write", "learning.review.read", "learning.review.write",
            "learning.progress.read", "learning.progress.write", "learning.mastery.read",
            "learning.mastery.write", "learning.task.write", "assessment.session.read",
            "assessment.session.write", "assessment.placement.session.create",
            "assessment.placement.session.read", "assessment.placement.response.submit",
            "assessment.placement.skip", "assessment.placement.report.read",
            "content.read", "iam.self.read", "iam.self.write",
            // P1R-M1-014 canonical learner-facing B12 scopes. The two trusted-event
            // scopes belong to workload identities and are intentionally excluded.
            "gamification.read.self", "gamification.ledger.read.self",
            "gamification.reward.read.self", "gamification.reward.claim.self",
            "gamification.game.read.self", "gamification.game.play.self",
            "social.focus.write.self", "social.interaction.write.self",
            "social.room.write.self", "social.visibility.write.self",
            "social.report.create.self", "social.report.read.self",
            "gamification.read", "gamification.rewards.claim",
            "social.room.read", "social.room.join", "social.room.member.read", "social.room.write",
            "social.focus.write", "social.interaction.send", "social.leaderboard.read",
            "social.report.create", "social.report.read", "social.visibility.write",
            "commerce:order:read", "commerce:order:write", "commerce:payment:write",
            "commerce:entitlement:read", "commerce:refund:write", "commerce:activation:redeem",
            "support.ticket.create",
            // P1R-M1-016 canonical learner-owned notification preference scopes.
            "notification.preference.read.self", "notification.preference.write.self",
            "notification.read", "notification.write",
            // P1-LIVE-012 (decision A): consented learners may stream licensed media.
            // Pre-gate tokens are stripped of it (see isLearningPermission media: cover).
            "media:read");

    private final AccountStore accounts;
    private final PasswordEncoder passwordEncoder;
    private final AuditFactPort audit;
    private final Clock clock;
    private final IamServiceProperties.AccountProperties properties;
    private final RateLimitStore rateLimits;
    private final ConcurrentHashMap<String, Object> locks = new ConcurrentHashMap<>();

    public PasswordAccountService(AccountStore accounts, PasswordEncoder passwordEncoder,
                                  AuditFactPort audit, Clock clock, IamServiceProperties properties) {
        this(accounts, passwordEncoder, audit, clock, properties, null);
    }

    public PasswordAccountService(AccountStore accounts, PasswordEncoder passwordEncoder,
                                  AuditFactPort audit, Clock clock, IamServiceProperties properties,
                                  RateLimitStore rateLimits) {
        this.accounts = Objects.requireNonNull(accounts, "accounts");
        this.passwordEncoder = Objects.requireNonNull(passwordEncoder, "passwordEncoder");
        this.audit = Objects.requireNonNull(audit, "audit");
        this.clock = Objects.requireNonNull(clock, "clock");
        this.properties = Objects.requireNonNull(properties, "properties").getAccount();
        this.rateLimits = rateLimits;
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
        synchronized (locks.computeIfAbsent(normalized, ignored -> new Object())) {
            Instant now = Instant.now(clock);
            if (rateLimits != null && !rateLimits.allow("login", rateKey(normalized), now,
                    Math.max(1, properties.getLoginRequestsPerMinute()), java.time.Duration.ofMinutes(1))) {
                throw new IamPolicyException(IamDecisionCode.RATE_LIMITED, "iam.login.rate_limited");
            }
            String presentedPassword = rawPassword == null ? "" : rawPassword;
            AccountStore.PasswordLoginResult result = accounts.authenticatePassword(
                    normalized,
                    DUMMY_HASH,
                    encodedPassword -> passwordEncoder.matches(presentedPassword, encodedPassword),
                    now,
                    Math.max(1, properties.getMaxFailedAttempts()),
                    positive(properties.getLockDuration(), java.time.Duration.ofMinutes(15)));
            AccountRecord account = result.account();
            if (result.decisionCode() == IamDecisionCode.ACCOUNT_LOCKED) {
                appendAudit(account, IamDecisionCode.ACCOUNT_LOCKED, "account_locked");
                throw new IamPolicyException(IamDecisionCode.ACCOUNT_LOCKED, "iam.account.locked");
            }
            if (result.decisionCode() == IamDecisionCode.INVALID_CREDENTIALS) {
                // Missing, disabled and deleted accounts remain non-enumerating. A normal failed login
                // retains its durable counter/audit fact from the store result.
                if (account != null && account.status() != AccountStatus.DISABLED && account.status() != AccountStatus.DELETED) {
                    appendAudit(account, IamDecisionCode.INVALID_CREDENTIALS, "login_failed");
                }
                throw invalidCredentials();
            }
            if (result.decisionCode() != IamDecisionCode.ACCOUNT_LOGIN || account == null) {
                throw new IamPolicyException(IamDecisionCode.IAM_PERSISTENCE_UNAVAILABLE,
                        "iam.persistence.unavailable");
            }
            appendAudit(account, IamDecisionCode.ACCOUNT_LOGIN, "account_login");
            return account;
        }
    }

    public AccountRecord find(PrincipalId principalId) {
        return accounts.findByPrincipalId(principalId).orElseThrow(() ->
                new IamPolicyException(IamDecisionCode.PRINCIPAL_NOT_FOUND, "iam.principal.not_found"));
    }

    public AccountRecord changePassword(PrincipalId principalId, String rawPassword) {
        validatePassword(rawPassword);
        AccountRecord changed = accounts.changePassword(principalId,
                passwordEncoder.encode(rawPassword), Instant.now(clock));
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

    private static String rateKey(String normalizedIdentifier) {
        return SecretDigests.sha256Hex("iam-account-rate:" + normalizedIdentifier);
    }

    private void appendAudit(AccountRecord account, IamDecisionCode code, String type) {
        try {
            audit.append(AuditDecision.of(type, code, auditAllows(code),
                    TenantScope.derive(account.principalId()), Instant.now(clock), Set.of(), Set.of()));
        } catch (RuntimeException exception) {
            // A lock/rate/credential decision is only durable when its audit fact is durable.
            // Surface a typed infrastructure failure so the idempotency transaction rolls back
            // unknown persistence faults instead of returning a misleading authentication result.
            throw new IamPolicyException(IamDecisionCode.AUDIT_UNAVAILABLE, "iam.audit.unavailable");
        }
    }

    private static boolean auditAllows(IamDecisionCode code) {
        return code == IamDecisionCode.ACCOUNT_REGISTERED
                || code == IamDecisionCode.ACCOUNT_LOGIN
                || code == IamDecisionCode.PASSWORD_RESET_COMPLETED;
    }

    private static java.time.Duration positive(java.time.Duration value, java.time.Duration fallback) {
        return value == null || value.isNegative() || value.isZero() ? fallback : value;
    }
}
