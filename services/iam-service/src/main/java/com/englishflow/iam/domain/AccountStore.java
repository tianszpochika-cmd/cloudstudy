package com.englishflow.iam.domain;

import java.time.Duration;
import java.time.Instant;
import java.util.Optional;

/** IAM-owned account persistence boundary. */
public interface AccountStore {
    AccountRecord save(AccountRecord account);
    Optional<AccountRecord> findByIdentifier(String identifier);
    Optional<AccountRecord> findByPrincipalId(PrincipalId principalId);
    AccountRecord replace(AccountRecord account);

    /** Updates only the password hash from the store's current row, preserving newer security facts. */
    default AccountRecord changePassword(PrincipalId principalId, String passwordHash, Instant at) {
        AccountRecord current = findByPrincipalId(principalId).orElseThrow(() ->
                new IamPolicyException(IamDecisionCode.PRINCIPAL_NOT_FOUND, "iam.principal.not_found"));
        return replace(current.withPasswordHashPreservingSecurity(passwordHash, at));
    }

    /**
     * Records one failed password attempt at the store boundary. Durable stores override this
     * with a row-lock/CAS implementation so two IAM processes cannot overwrite one another's
     * failed-attempt counter. The default is intentionally retained for local test stores.
     */
    default AccountRecord recordFailedLogin(AccountRecord observed, Instant at, int maxAttempts,
                                             Duration lockDuration) {
        return replace(observed.failedLogin(at, maxAttempts, at.plus(lockDuration)));
    }

    /** Records a successful login without allowing a stale snapshot to clear a newer lock. */
    default AccountRecord recordSuccessfulLogin(AccountRecord observed, Instant at) {
        return replace(observed.successfulLogin(at));
    }
}
