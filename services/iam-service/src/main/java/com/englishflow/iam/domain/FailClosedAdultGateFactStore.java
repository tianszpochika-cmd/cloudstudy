package com.englishflow.iam.domain;

import java.time.Instant;

/** No adult access decision is durable when IAM persistence is unavailable. */
public final class FailClosedAdultGateFactStore implements AdultGateFactStore {

    @Override
    public AdultGateFact find(PrincipalId principalId, Instant fallbackEvaluatedAt) {
        throw unavailable();
    }

    @Override
    public AdultGateFact approve(PrincipalId principalId, String policyVersion, Instant evaluatedAt) {
        throw unavailable();
    }

    private static IamPolicyException unavailable() {
        return new IamPolicyException(IamDecisionCode.IAM_PERSISTENCE_UNAVAILABLE,
                "iam.persistence.unavailable");
    }
}
