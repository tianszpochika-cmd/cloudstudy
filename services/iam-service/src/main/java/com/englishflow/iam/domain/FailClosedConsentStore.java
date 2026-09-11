package com.englishflow.iam.domain;

import java.util.List;
import java.util.Optional;

/** Explicitly closed consent boundary when IAM durable persistence is not configured. */
public final class FailClosedConsentStore implements ConsentStore {
    private IamPolicyException unavailable() {
        return new IamPolicyException(IamDecisionCode.IAM_PERSISTENCE_UNAVAILABLE,
                "iam.persistence.unavailable");
    }
    @Override public ConsentRecord append(ConsentRecord record) { throw unavailable(); }
    @Override public Optional<ConsentRecord> find(PrincipalId principalId, ConsentType type) { throw unavailable(); }
    @Override public List<ConsentHistoryEntry> history(PrincipalId principalId, ConsentType type) { throw unavailable(); }
}
