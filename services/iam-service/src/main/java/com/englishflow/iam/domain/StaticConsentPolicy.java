package com.englishflow.iam.domain;

import java.util.Map;
import java.util.Objects;

/** Explicit policy-version adapter for tests/local configuration. */
public final class StaticConsentPolicy implements ConsentPolicyPort {

    private final Map<ConsentType, ConsentVersion> versions;

    public StaticConsentPolicy(Map<ConsentType, ConsentVersion> versions) {
        this.versions = Map.copyOf(Objects.requireNonNull(versions, "versions"));
        if (!this.versions.keySet().containsAll(java.util.Set.of(ConsentType.values()))) {
            throw new IllegalArgumentException("all Phase 1 consent types need a current version");
        }
    }

    @Override
    public ConsentVersion currentVersion(ConsentType type) {
        ConsentVersion version = versions.get(type);
        if (version == null) {
            throw new IamPolicyException(
                    IamDecisionCode.CONSENT_VERSION_MISMATCH,
                    "iam.consent.version_unavailable");
        }
        return version;
    }
}
