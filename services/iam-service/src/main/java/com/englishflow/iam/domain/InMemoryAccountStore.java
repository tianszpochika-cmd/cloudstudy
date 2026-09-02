package com.englishflow.iam.domain;

import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.time.Instant;
import java.time.Duration;

/** Local development/test account store. Production must select the IAM-owned JDBC store. */
public final class InMemoryAccountStore implements AccountStore {
    private final Map<String, AccountRecord> byIdentifier = new ConcurrentHashMap<>();
    private final Map<PrincipalId, AccountRecord> byPrincipal = new ConcurrentHashMap<>();

    @Override
    public synchronized AccountRecord save(AccountRecord account) {
        String identifier = account.identifier();
        if (byIdentifier.containsKey(identifier)) {
            throw new IamPolicyException(IamDecisionCode.ACCOUNT_CONFLICT, "iam.account.already_exists");
        }
        byIdentifier.put(identifier, account);
        byPrincipal.put(account.principalId(), account);
        return account;
    }

    @Override
    public Optional<AccountRecord> findByIdentifier(String identifier) {
        return Optional.ofNullable(byIdentifier.get(AccountRecord.normalizeIdentifier(identifier)));
    }

    @Override
    public Optional<AccountRecord> findByPrincipalId(PrincipalId principalId) {
        return Optional.ofNullable(byPrincipal.get(principalId));
    }

    @Override
    public synchronized AccountRecord replace(AccountRecord account) {
        AccountRecord previous = byPrincipal.get(account.principalId());
        if (previous != null && !previous.identifier().equals(account.identifier())) {
            byIdentifier.remove(previous.identifier());
        }
        byIdentifier.put(account.identifier(), account);
        byPrincipal.put(account.principalId(), account);
        return account;
    }

    @Override
    public synchronized AccountRecord changePassword(PrincipalId principalId, String passwordHash, Instant at) {
        AccountRecord current = byPrincipal.get(principalId);
        if (current == null) throw new IamPolicyException(IamDecisionCode.PRINCIPAL_NOT_FOUND,
                "iam.principal.not_found");
        AccountRecord changed = current.withPasswordHashPreservingSecurity(passwordHash, at);
        byIdentifier.put(changed.identifier(), changed);
        byPrincipal.put(principalId, changed);
        return changed;
    }

    @Override
    public synchronized AccountRecord recordFailedLogin(AccountRecord observed, Instant at,
                                                         int maxAttempts, Duration lockDuration) {
        AccountRecord current = byPrincipal.get(observed.principalId());
        if (current == null) throw new IamPolicyException(IamDecisionCode.IAM_PERSISTENCE_UNAVAILABLE,
                "iam.persistence.unavailable");
        if (current.status() == AccountStatus.DISABLED) return current;
        if (current.status() == AccountStatus.LOCKED
                && current.lockedUntil() != null && current.lockedUntil().isAfter(at)) return current;
        if (current.status() == AccountStatus.LOCKED) current = current.unlocked(at);
        Duration effective = lockDuration == null || lockDuration.isNegative() || lockDuration.isZero()
                ? Duration.ofMinutes(15) : lockDuration;
        AccountRecord failed = current.failedLogin(at, Math.max(1, maxAttempts), at.plus(effective));
        byIdentifier.put(failed.identifier(), failed);
        byPrincipal.put(failed.principalId(), failed);
        return failed;
    }

    @Override
    public synchronized AccountRecord recordSuccessfulLogin(AccountRecord observed, Instant at) {
        AccountRecord current = byPrincipal.get(observed.principalId());
        if (current == null) throw new IamPolicyException(IamDecisionCode.IAM_PERSISTENCE_UNAVAILABLE,
                "iam.persistence.unavailable");
        if (current.status() == AccountStatus.DISABLED) return current;
        if (current.status() == AccountStatus.LOCKED) {
            if (current.lockedUntil() == null || current.lockedUntil().isAfter(at)) return current;
            current = current.unlocked(at);
        }
        AccountRecord loggedIn = current.successfulLogin(at);
        byIdentifier.put(loggedIn.identifier(), loggedIn);
        byPrincipal.put(loggedIn.principalId(), loggedIn);
        return loggedIn;
    }
}
