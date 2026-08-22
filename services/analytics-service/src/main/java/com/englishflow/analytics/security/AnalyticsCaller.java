package com.englishflow.analytics.security;

import com.englishflow.analytics.domain.TenantScope;

/** Authentication facts derived from an already verified JWT. */
public record AnalyticsCaller(TenantScope tenant, String subject, String sourceService) {
}
