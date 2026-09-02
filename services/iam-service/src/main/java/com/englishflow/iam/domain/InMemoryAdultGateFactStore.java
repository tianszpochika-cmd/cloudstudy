package com.englishflow.iam.domain;

import java.time.Instant;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

/** Local-only adult-gate projection used when durable IAM persistence is disabled. */
public final class InMemoryAdultGateFactStore implements AdultGateFactStore {
    private final Map<PrincipalId, AdultGateFact> facts = new ConcurrentHashMap<>();

    @Override
    public AdultGateFact find(PrincipalId principalId, Instant fallbackEvaluatedAt) {
        return facts.getOrDefault(principalId, AdultGateFact.pending(fallbackEvaluatedAt));
    }

    @Override
    public AdultGateFact approve(PrincipalId principalId, String policyVersion, Instant evaluatedAt) {
        AdultGateFact fact = new AdultGateFact("APPROVED", policyVersion, evaluatedAt, false);
        facts.put(principalId, fact);
        return fact;
    }

    @Override
    public AdultGateFact invalidate(PrincipalId principalId, String policyVersion, Instant evaluatedAt) {
        AdultGateFact fact = new AdultGateFact("REJECTED", policyVersion, evaluatedAt, true);
        facts.put(principalId, fact);
        return fact;
    }
}
