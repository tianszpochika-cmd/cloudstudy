package com.englishflow.iam.domain;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

/** Explicit production safety fallback when the configured durable IAM store is unavailable. */
public final class FailClosedAccountStore implements AccountStore {
    private IamPolicyException unavailable() {
        return new IamPolicyException(IamDecisionCode.IAM_PERSISTENCE_UNAVAILABLE, "iam.persistence.unavailable");
    }

    @Override public AccountRecord save(AccountRecord account) { throw unavailable(); }
    @Override public Optional<AccountRecord> findByIdentifier(String identifier) { throw unavailable(); }
    @Override public Optional<AccountRecord> findByPrincipalId(PrincipalId principalId) { throw unavailable(); }
    @Override public AccountRecord replace(AccountRecord account) { throw unavailable(); }
    @Override public List<AccountRecord> findLocked(Instant at, int limit) { throw unavailable(); }
}
