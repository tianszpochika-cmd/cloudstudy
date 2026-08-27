package com.englishflow.learning.web;

import java.util.Objects;

import com.englishflow.learning.config.LearningServiceProperties;
import com.englishflow.learning.domain.LearningPrincipalContext;

/**
 * Composition seam for verified IAM facts. It has no HTTP/header fallback; callers must pass
 * facts that were already verified by the service security boundary.
 */
public final class LearningPrincipalContextResolver {
    private final LearningServiceProperties properties;

    public LearningPrincipalContextResolver(LearningServiceProperties properties) {
        this.properties = Objects.requireNonNull(properties, "properties is required");
    }

    public LearningPrincipalContext resolveVerified(String principalId, long userId) {
        if (principalId == null || principalId.isBlank()) throw new IllegalArgumentException("principalId is required");
        if (!"phase-1".equals(properties.getPhase())) throw new IllegalStateException("B25 learner flow is Phase 1 only");
        return LearningPrincipalContext.phaseOne(principalId, userId);
    }
}
