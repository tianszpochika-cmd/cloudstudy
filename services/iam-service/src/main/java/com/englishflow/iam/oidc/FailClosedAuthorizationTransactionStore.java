package com.englishflow.iam.oidc;

import com.englishflow.iam.domain.IamDecisionCode;
import com.englishflow.iam.domain.IamPolicyException;

import java.util.Optional;

/** Prevents the production process from silently using the in-memory state store. */
public final class FailClosedAuthorizationTransactionStore implements AuthorizationTransactionPort {

    @Override
    public Optional<AuthorizationTransaction> find(String state) {
        throw unavailable();
    }

    @Override
    public void save(AuthorizationTransaction transaction) {
        throw unavailable();
    }

    @Override
    public Optional<AuthorizationTransaction> consume(String state) {
        throw unavailable();
    }

    @Override
    public boolean wasConsumed(String state) {
        throw unavailable();
    }

    private IamPolicyException unavailable() {
        return new IamPolicyException(
                IamDecisionCode.IAM_PERSISTENCE_UNAVAILABLE,
                "iam.persistence.unavailable");
    }
}
