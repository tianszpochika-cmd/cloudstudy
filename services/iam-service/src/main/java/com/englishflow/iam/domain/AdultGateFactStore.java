package com.englishflow.iam.domain;

import java.time.Instant;

/** Persistence port for mutable adult-gate status owned by IAM. */
public interface AdultGateFactStore {

    AdultGateFact find(PrincipalId principalId, Instant fallbackEvaluatedAt);

    AdultGateFact approve(PrincipalId principalId, String policyVersion, Instant evaluatedAt);
}
