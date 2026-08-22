package com.englishflow.analytics.domain;

/** Tenant scope is always constructed by a verified workload/user adapter. */
public record TenantScope(String tenantId) {

    public TenantScope {
        AnalyticsPrivacyBoundary.requireOpaqueReference(tenantId, "tenantId");
    }
}
