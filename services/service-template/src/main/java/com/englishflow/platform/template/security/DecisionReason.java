package com.englishflow.platform.template.security;

/**
 * Bounded, non-sensitive reasons used for audit/replay and the 403 error boundary.
 *
 * <p>Authentication failures are deliberately not represented as an authorization decision:
 * Spring Security maps an absent/unverifiable identity to the separate 401 envelope.</p>
 */
public enum DecisionReason {
    ALLOWED,
    INVALID_CONTEXT,
    UNTRUSTED_CLIENT_FACTS,
    MISSING_TENANT,
    TENANT_MISMATCH,
    MISSING_OWNER,
    OWNER_MISMATCH,
    MISSING_PHASE,
    PHASE_MISMATCH,
    MISSING_CONTENT_RIGHTS,
    CONTENT_RIGHTS_DENIED,
    MISSING_CONSENT,
    CONSENT_DENIED,
    REVOKED,
    REVOCATION_UNKNOWN,
    RBAC_DENIED,
    POLICY_UNAVAILABLE,
    POLICY_STALE,
    POLICY_SIGNATURE_INVALID,
    POLICY_VERSION_MISMATCH,
    PDP_UNAVAILABLE,
    PDP_TIMEOUT,
    PDP_DENIED,
    PDP_INVALID
}
