package com.englishflow.content.config;

import jakarta.validation.constraints.AssertTrue;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/** Explicit OIDC Resource Server seam. It cannot silently fall back to a local decoder. */
@Validated
@ConfigurationProperties(
        prefix = "security.resource-server",
        ignoreUnknownFields = false,
        ignoreInvalidFields = false)
public class ContentResourceServerProperties {

    private boolean enabled;
    private String issuerUri;
    private String jwkSetUri;

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }

    public String getIssuerUri() {
        return issuerUri;
    }

    public void setIssuerUri(String issuerUri) {
        this.issuerUri = issuerUri;
    }

    public String getJwkSetUri() {
        return jwkSetUri;
    }

    public void setJwkSetUri(String jwkSetUri) {
        this.jwkSetUri = jwkSetUri;
    }

    @AssertTrue(message = "issuer-uri and jwk-set-uri are required when the resource server is enabled")
    public boolean isVerificationConfigurationComplete() {
        return !enabled && isBlank(issuerUri) && isBlank(jwkSetUri)
                || enabled && !isBlank(issuerUri) && !isBlank(jwkSetUri);
    }

    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }
}
