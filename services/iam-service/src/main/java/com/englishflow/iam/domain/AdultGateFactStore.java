package com.englishflow.iam.domain;

import java.time.Instant;

/** Persistence port for mutable adult Gate status; identity mapping remains immutable. */
public interface AdultGateFactStore {

    AdultGateFact find(PrincipalId principalId, Instant fallbackEvaluatedAt);

    AdultGateFact approve(PrincipalId principalId, String policyVersion, Instant evaluatedAt);
}
