package com.englishflow.iam.domain;

import java.util.Optional;

/** Prevents principal creation when the IAM database adapter is not configured. */
public final class FailClosedPrincipalMappingPort implements PrincipalMappingPort {

    @Override
    public Optional<PrincipalMapping> findByExternalIdentity(ExternalIdentity identity) {
        throw unavailable();
    }

    @Override
    public PrincipalMapping createIfAbsent(PrincipalMapping mapping) {
        throw unavailable();
    }

    private IamPolicyException unavailable() {
        return new IamPolicyException(
                IamDecisionCode.IAM_PERSISTENCE_UNAVAILABLE,
                "iam.persistence.unavailable");
    }
}
