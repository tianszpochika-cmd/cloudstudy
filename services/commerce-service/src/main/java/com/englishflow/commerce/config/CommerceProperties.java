package com.englishflow.commerce.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "commerce")
public record CommerceProperties(Security security, Payment payment, String publicTenantId) {
    public CommerceProperties {
        security = security == null ? new Security(false) : security;
        payment = payment == null ? new Payment(false, "DISABLED", false, "change-me-in-test-only") : payment;
        publicTenantId = publicTenantId == null || publicTenantId.isBlank() ? "platform" : publicTenantId.trim();
    }

    public record Security(boolean resourceServerEnabled) { }

    public record Payment(boolean enabled, String environment, boolean realProvidersEnabled, String sandboxSecret) {
        public Payment {
            environment = environment == null || environment.isBlank() ? "DISABLED" : environment;
            sandboxSecret = sandboxSecret == null ? "change-me-in-test-only" : sandboxSecret;
        }
    }
}
