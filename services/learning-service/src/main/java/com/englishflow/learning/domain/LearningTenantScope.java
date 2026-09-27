package com.englishflow.learning.domain;

import java.util.Objects;
import java.util.regex.Pattern;

/** Server-derived tenant, principal and numeric user identity for every learning fact. */
public record LearningTenantScope(String tenantId, String principalId, long userId) {

    public static final String PLATFORM_TENANT = "platform";
    private static final Pattern SAFE_ID = Pattern.compile("[A-Za-z0-9][A-Za-z0-9._:-]{0,127}");
    private static final Pattern PRINCIPAL_ID = Pattern.compile(
            "prn_[A-Za-z0-9._:-]{15,127}|[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}");

    public LearningTenantScope {
        requireId(tenantId, "tenantId");
        requireId(principalId, "principalId");
        if (!PRINCIPAL_ID.matcher(principalId).matches()) {
            // prn_ service identities and IAM-minted UUID subjects are both
            // verified unforgeable caller identities; anything else is denied.
            throw new IllegalArgumentException("principalId must be an IAM principal id");
        }
        if (userId < 1) {
            throw new IllegalArgumentException("userId must be positive");
        }
    }

    public static LearningTenantScope forPhaseOne(String principalId, long userId) {
        return new LearningTenantScope(PLATFORM_TENANT, principalId, userId);
    }

    /**
     * Stable numeric user key for IAM-minted UUID subjects, which carry no
     * numeric user id. Deterministic key function (first 63 bits of the
     * subject digest), never an invented identity; used only for the numeric
     * user_id columns alongside the string principal id.
     */
    public static long stableUserIdFor(String subject) {
        if (subject == null || subject.isBlank()) {
            throw new IllegalArgumentException("subject is required");
        }
        try {
            byte[] hash = java.security.MessageDigest.getInstance("SHA-256")
                    .digest(subject.getBytes(java.nio.charset.StandardCharsets.UTF_8));
            long value = 0;
            for (int index = 0; index < 8; index++) value = (value << 8) | (hash[index] & 0xFFL);
            value &= Long.MAX_VALUE;
            return value == 0 ? 1L : value;
        } catch (java.security.NoSuchAlgorithmException impossible) {
            throw new IllegalStateException(impossible);
        }
    }

    public String ownerId() {
        return principalId;
    }

    public String storageKey() {
        return tenantId + ":" + principalId;
    }

    public void assertResource(String resourceTenantId, String resourceOwnerId) {
        if (resourceTenantId == null || resourceTenantId.isBlank()) {
            throw new LearningDomainException(LearningDecisionCode.MISSING_TENANT,
                    "resource tenant is required");
        }
        if (!tenantId.equals(resourceTenantId)) {
            throw new LearningDomainException(LearningDecisionCode.TENANT_MISMATCH,
                    "resource tenant is outside the verified scope");
        }
        if (resourceOwnerId == null || resourceOwnerId.isBlank()) {
            throw new LearningDomainException(LearningDecisionCode.MISSING_OWNER,
                    "resource owner is required");
        }
        if (!principalId.equals(resourceOwnerId)) {
            throw new LearningDomainException(LearningDecisionCode.OWNER_MISMATCH,
                    "resource owner is outside the verified scope");
        }
    }

    public void rejectClientAuthority(ClientAuthorityClaims claims) {
        if (claims != null && claims.containsAuthorityAttempt()) {
            throw new LearningDomainException(LearningDecisionCode.CLIENT_AUTHORITY_REJECTED,
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
