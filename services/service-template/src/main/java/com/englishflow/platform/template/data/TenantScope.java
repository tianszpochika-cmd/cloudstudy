package com.englishflow.platform.template.data;

import java.util.Objects;
import java.util.regex.Pattern;

/**
 * Server-derived tenant and subject boundary for service-owned queries.
 *
 * <p>The template deliberately does not accept a client tenant as an authority. A copied
 * service must derive this scope from its verified principal/IAM context and apply it to every
 * query and write.</p>
 */
public record TenantScope(String tenantId, String subjectId) {

    private static final Pattern SAFE_ID = Pattern.compile("[A-Za-z0-9][A-Za-z0-9._:-]{0,127}");

    public TenantScope {
        requireId(tenantId, "tenantId");
        requireId(subjectId, "subjectId");
    }

    public static TenantScope platform(String subjectId) {
        return new TenantScope("platform", subjectId);
    }

    public void assertTenant(String resourceTenantId) {
        if (!tenantId.equals(resourceTenantId)) {
            throw new SecurityException("tenant scope denied");
        }
    }

    public void assertOwner(String resourceOwnerId) {
        if (!subjectId.equals(resourceOwnerId)) {
            throw new SecurityException("resource owner scope denied");
        }
    }

    public boolean owns(String resourceTenantId, String resourceOwnerId) {
        return tenantId.equals(resourceTenantId) && subjectId.equals(resourceOwnerId);
    }

    /** Reject even a client-supplied value; the service must derive tenant from verified context. */
    public void rejectClientTenant(String clientTenantId) {
        if (clientTenantId != null && !clientTenantId.isBlank()) {
            throw new SecurityException("client tenant is not an authority");
        }
    }

    private static void requireId(String value, String field) {
        Objects.requireNonNull(value, field + " is required");
        if (!SAFE_ID.matcher(value).matches()) {
            throw new IllegalArgumentException(field + " has an unsafe format");
        }
    }
}

