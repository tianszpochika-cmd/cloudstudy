package com.englishflow.learner.domain;

import java.util.Objects;
import java.util.regex.Pattern;

/**
 * Server-derived tenant/owner scope used on every learner read and write.
 * Phase 1 creates it from IAM's verified subject and the fixed platform tenant; clients never
 * construct it from JSON fields.
 */
public record LearnerTenantScope(String tenantId, String subjectId) {

    public static final String PLATFORM_TENANT = "platform";
    private static final Pattern SAFE_ID = Pattern.compile("[A-Za-z0-9][A-Za-z0-9._:-]{0,127}");
    private static final Pattern PRINCIPAL_ID = Pattern.compile("prn_[A-Za-z0-9._:-]{15,127}");

    public LearnerTenantScope {
        requireId(tenantId, "tenantId");
        requireId(subjectId, "subjectId");
        if (!PRINCIPAL_ID.matcher(subjectId).matches()) {
            throw new IllegalArgumentException("subjectId must be an IAM principal id");
        }
    }

    public static LearnerTenantScope forPhaseOne(String subjectId) {
        return new LearnerTenantScope(PLATFORM_TENANT, subjectId);
    }

    public String ownerId() {
        return subjectId;
    }

    public String storageKey() {
        return tenantId + ":" + subjectId;
    }

    public void assertResource(String resourceTenantId, String resourceOwnerId) {
        if (resourceTenantId == null || resourceTenantId.isBlank()) {
            throw new LearnerDomainException(LearnerDecisionCode.MISSING_TENANT,
                    "resource tenant is required");
        }
        if (!tenantId.equals(resourceTenantId)) {
            throw new LearnerDomainException(LearnerDecisionCode.TENANT_MISMATCH,
                    "resource tenant is outside the verified scope");
        }
        if (resourceOwnerId == null || resourceOwnerId.isBlank()) {
            throw new LearnerDomainException(LearnerDecisionCode.MISSING_OWNER,
                    "resource owner is required");
        }
        if (!subjectId.equals(resourceOwnerId)) {
            throw new LearnerDomainException(LearnerDecisionCode.OWNER_MISMATCH,
                    "resource owner is outside the verified scope");
        }
    }

    public void rejectClientAuthority(ClientAuthorityClaims claims) {
        if (claims != null && claims.containsAuthorityAttempt()) {
            throw new LearnerDomainException(LearnerDecisionCode.CLIENT_AUTHORITY_REJECTED,
                    "client role, tenant and owner values are not authorities");
        }
    }

    private static void requireId(String value, String field) {
        Objects.requireNonNull(value, field + " is required");
        if (!SAFE_ID.matcher(value).matches()) {
            throw new IllegalArgumentException(field + " has an unsafe format");
        }
    }
}
