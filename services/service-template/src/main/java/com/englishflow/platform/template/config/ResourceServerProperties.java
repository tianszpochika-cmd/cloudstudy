package com.englishflow.platform.template.config;

import java.time.Duration;

import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotNull;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/**
 * Explicit seam for independently verified platform JWTs.
 *
 * <p>The seam requires the IAM issuer, audience and explicit JWKS endpoint. A copied service
 * never silently falls back to an unverified token source or trusts client authority headers.</p>
 */
@Validated
@ConfigurationProperties(
        prefix = "security.resource-server",
        ignoreUnknownFields = false,
        ignoreInvalidFields = false)
public class ResourceServerProperties {

    private boolean enabled;

    private String issuerUri;

    private String jwkSetUri;

    private String audience = "yuxuexing-api";

    @NotNull
    private Duration policyCacheTtl = Duration.ofSeconds(30);

    @NotNull
    private Duration pdpTimeout = Duration.ofMillis(250);

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

    public String getAudience() {
        return audience;
    }

    public void setAudience(String audience) {
        this.audience = audience;
    }

    public Duration getPolicyCacheTtl() {
        return policyCacheTtl;
    }

    public void setPolicyCacheTtl(Duration policyCacheTtl) {
        this.policyCacheTtl = policyCacheTtl;
    }

    public Duration getPdpTimeout() {
        return pdpTimeout;
    }

    public void setPdpTimeout(Duration pdpTimeout) {
        this.pdpTimeout = pdpTimeout;
    }

    @AssertTrue(message = "policy-cache-ttl must be positive")
    public boolean isPolicyCacheTtlPositive() {
        return isPositive(policyCacheTtl);
    }

    @AssertTrue(message = "pdp-timeout must be positive")
    public boolean isPdpTimeoutPositive() {
        return isPositive(pdpTimeout);
    }

    @AssertTrue(message = "issuer-uri and jwk-set-uri are required when the resource server is enabled")
    public boolean isVerificationConfigurationComplete() {
        return !enabled || !isBlank(issuerUri) && !isBlank(jwkSetUri) && !isBlank(audience);
    }

    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    private static boolean isPositive(Duration value) {
        return value != null && !value.isZero() && !value.isNegative();
    }
}
