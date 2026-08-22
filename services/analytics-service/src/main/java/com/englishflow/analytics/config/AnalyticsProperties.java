package com.englishflow.analytics.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "analytics")
public record AnalyticsProperties(
        boolean featureEnabled,
        String metricVersion,
        Security security
) {

    public AnalyticsProperties {
        metricVersion = metricVersion == null || metricVersion.isBlank() ? "analytics.v1" : metricVersion;
        security = security == null ? new Security(false, "", "") : security;
    }

    public record Security(boolean resourceServerEnabled, String issuerUri, String jwkSetUri) {
    }
}
