package com.englishflow.learning;

import java.util.Set;

import com.englishflow.learning.domain.ClientAuthorityClaims;
import com.englishflow.learning.domain.ConsentState;
import com.englishflow.learning.domain.LearningPrincipalContext;
import com.englishflow.learning.domain.LearningTenantScope;

/**
 * Test-only fixture for a verified Phase 1 learner. Production code must derive every fact from
 * the verified JWT or a server-side policy source; it must never fabricate consent or permissions.
 */
public final class LearningTestPrincipals {

    private LearningTestPrincipals() {
    }

    public static LearningPrincipalContext phaseOne(String principalId, long userId) {
        return new LearningPrincipalContext(
                LearningTenantScope.forPhaseOne(principalId, userId),
                "phase-1",
                Set.of("learner"),
                Set.of(
                        "learning.plan.read",
                        "learning.plan.write",
                        "learning.review.read",
                        "learning.review.write",
                        "learning.progress.read",
                        "learning.progress.write",
                        "learning.mastery.read",
                        "learning.mastery.write",
                        "learning.task.write"),
                ConsentState.GRANTED,
                false,
                ClientAuthorityClaims.none());
    }
}
