package com.englishflow.platform.template.security;

import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.Objects;
import java.util.Set;

/**
 * Authorization input assembled from a verified principal plus service-owned resource facts.
 *
 * <p>Nullable resource fields intentionally represent missing facts so the pure evaluator can
 * return a stable deny reason instead of making an adapter turn missing data into a default.</p>
 */
public record AuthorizationContext(
        VerifiedPrincipal principal,
        String action,
        String resourceType,
        String resourceId,
        String resourceTenantId,
        String resourceOwnerId,
        String resourcePhase,
        Set<String> requiredContentRights,
        ConsentState resourceConsent,
        ClientSecurityFacts clientSecurityFacts,
        boolean pdpRequired
) {

    public AuthorizationContext(
            VerifiedPrincipal principal,
            String action,
            String resourceType,
            String resourceId,
            String resourceTenantId,
            String resourceOwnerId,
            String resourcePhase,
            Set<String> requiredContentRights,
            ConsentState resourceConsent) {
        this(principal, action, resourceType, resourceId, resourceTenantId, resourceOwnerId,
                resourcePhase, requiredContentRights, resourceConsent, ClientSecurityFacts.none(), false);
    }

    public AuthorizationContext {
        Objects.requireNonNull(principal, "verified principal is required");
        requiredContentRights = immutableSet(requiredContentRights);
        resourceConsent = resourceConsent == null ? ConsentState.UNKNOWN : resourceConsent;
        clientSecurityFacts = clientSecurityFacts == null ? ClientSecurityFacts.none() : clientSecurityFacts;
    }

    /** Tenant is derived from the verified principal; this is never populated from a request. */
    public String tenantScopeId() {
        return principal.tenantScope().tenantId();
    }

    public String subjectId() {
        return principal.subjectId();
    }

    private static Set<String> immutableSet(Set<String> values) {
        if (values == null || values.isEmpty()) {
            return Set.of();
        }
        return Collections.unmodifiableSet(new LinkedHashSet<>(values));
    }
}
