package com.englishflow.platform.template.security;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Collections;
import java.util.ArrayList;
import java.util.List;
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

    /**
     * Stable, non-secret binding for a remote PDP response.
     *
     * <p>The PEP never accepts a bare {@code allow} from a remote adapter. The adapter must bind
     * its result to this exact verified subject, token, resource and ABAC fact set. The digest is
     * used instead of serializing the values into logs or a response envelope.</p>
     */
    public String requestFingerprint() {
        List<String> rights = new ArrayList<>(requiredContentRights);
        Collections.sort(rights);
        String canonical = String.join("\u001f",
                "b16-pep-context-v1",
                safe(subjectId()),
                safe(principal.claims().issuer()),
                safe(principal.claims().tokenId()),
                safe(tenantScopeId()),
                safe(action),
                safe(resourceType),
                safe(resourceId),
                safe(resourceTenantId),
                safe(resourceOwnerId),
                safe(resourcePhase),
                String.join(",", rights),
                String.valueOf(resourceConsent),
                String.valueOf(pdpRequired));
        return "ctx_" + sha256(canonical);
    }

    private static Set<String> immutableSet(Set<String> values) {
        if (values == null || values.isEmpty()) {
            return Set.of();
        }
        return Collections.unmodifiableSet(new LinkedHashSet<>(values));
    }

    private static String safe(String value) {
        return value == null ? "" : value;
    }

    private static String sha256(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] bytes = digest.digest(value.getBytes(StandardCharsets.UTF_8));
            StringBuilder result = new StringBuilder(bytes.length * 2);
            for (byte item : bytes) {
                result.append(Character.forDigit((item >>> 4) & 0x0f, 16));
                result.append(Character.forDigit(item & 0x0f, 16));
            }
            return result.toString();
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is required by the runtime", exception);
        }
    }
}
