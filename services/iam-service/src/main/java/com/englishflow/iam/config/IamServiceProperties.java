package com.englishflow.iam.config;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

import java.util.LinkedHashSet;
import java.util.Set;

/**
 * Fail-closed IAM runtime configuration.
 *
 * <p>OIDC settings are deliberately separate from the product IAM facts. Enabling them only
 * selects an external OIDC client; it never enables token issuance. An incomplete configuration
 * is rejected by the runtime wiring and is never replaced by an in-memory or fake provider.</p>
 */
@Validated
@ConfigurationProperties(prefix = "iam", ignoreUnknownFields = false, ignoreInvalidFields = false)
public class IamServiceProperties {

    private static final String IDENTIFIER = "[a-z][a-z0-9-]{0,62}[a-z0-9]";

    @NotBlank
    @Pattern(regexp = "phase-[1-3]")
    private String phase;

    @NotBlank
    @Size(max = 63)
    @Pattern(regexp = "[a-z][a-z0-9_-]{0,62}")
    private String platformTenant;

    @NotBlank
    @Pattern(regexp = IDENTIFIER)
    private String providerMode;

    /** Explicit deployment switch. The default is false and keeps the HTTP boundary unavailable. */
    private boolean realProviderEnabled;

    /**
     * Test-only local adult-gate attestation. Production deployments must leave this disabled
     * and obtain age evidence from the approved IdP or a separately authenticated service.
     */
    private boolean localAdultGateEnabled;

    @jakarta.validation.Valid
    private OidcProperties oidc = new OidcProperties();

    @jakarta.validation.Valid
    private PersistenceProperties persistence = new PersistenceProperties();

    public String getPhase() {
        return phase;
    }

    public void setPhase(String phase) {
        this.phase = phase;
    }

    public String getPlatformTenant() {
        return platformTenant;
    }

    public void setPlatformTenant(String platformTenant) {
        this.platformTenant = platformTenant;
    }

    public String getProviderMode() {
        return providerMode;
    }

    public void setProviderMode(String providerMode) {
        this.providerMode = providerMode;
    }

    public boolean isRealProviderEnabled() {
        return realProviderEnabled;
    }

    public void setRealProviderEnabled(boolean realProviderEnabled) {
        this.realProviderEnabled = realProviderEnabled;
    }

    public boolean isLocalAdultGateEnabled() {
        return localAdultGateEnabled;
    }

    public void setLocalAdultGateEnabled(boolean localAdultGateEnabled) {
        this.localAdultGateEnabled = localAdultGateEnabled;
    }

    public OidcProperties getOidc() {
        return oidc;
    }

    public void setOidc(OidcProperties oidc) {
        this.oidc = oidc;
    }

    public PersistenceProperties getPersistence() {
        return persistence;
    }

    public void setPersistence(PersistenceProperties persistence) {
        this.persistence = persistence;
    }

    /** Provider-side OIDC client settings. Secrets are supplied only by environment/secret store. */
    public static class OidcProperties {

        private boolean enabled;

        @NotBlank
        @Pattern(regexp = IDENTIFIER)
        private String providerId = "local-idp";

        private String discoveryUri;

        private String expectedIssuer;

        private String clientId;

        private String learnerClientId = "yuxuexing-learner-web";

        private String adminClientId = "yuxuexing-admin-web";

        private String mobileH5ClientId = "yuxuexing-mobile-h5";

        private String mobileAppClientId = "yuxuexing-mobile-app";

        private String clientSecret;

        private String audience = "yuxuexing-api";

        @NotBlank
        @Pattern(regexp = "none|client_secret_basic|client_secret_post")
        private String clientAuthenticationMethod = "none";

        @Size(max = 32)
        private Set<String> redirectUris = new LinkedHashSet<>();

        @Size(max = 16)
        private Set<String> scopes = new LinkedHashSet<>(Set.of("openid", "profile"));

        private String ageClaim = "age";

        private java.time.Duration requestTimeout = java.time.Duration.ofSeconds(5);

        private java.time.Duration discoveryCacheTtl = java.time.Duration.ofMinutes(5);

        private java.time.Duration jwksMaxAge = java.time.Duration.ofMinutes(15);

        private java.time.Duration transactionTtl = java.time.Duration.ofMinutes(5);

        private java.time.Duration clockSkew = java.time.Duration.ofSeconds(60);

        public boolean isEnabled() {
            return enabled;
        }

        public void setEnabled(boolean enabled) {
            this.enabled = enabled;
        }

        public String getProviderId() {
            return providerId;
        }

        public void setProviderId(String providerId) {
            this.providerId = providerId;
        }

        public String getDiscoveryUri() {
            return discoveryUri;
        }

        public void setDiscoveryUri(String discoveryUri) {
            this.discoveryUri = discoveryUri;
        }

        public String getExpectedIssuer() {
            return expectedIssuer;
        }

        public void setExpectedIssuer(String expectedIssuer) {
            this.expectedIssuer = expectedIssuer;
        }

        public String getClientId() {
            return clientId;
        }

        public void setClientId(String clientId) {
            this.clientId = clientId;
        }

        public String getLearnerClientId() {
            return learnerClientId;
        }

        public void setLearnerClientId(String learnerClientId) {
            this.learnerClientId = learnerClientId;
        }

        public String getAdminClientId() {
            return adminClientId;
        }

        public void setAdminClientId(String adminClientId) {
            this.adminClientId = adminClientId;
        }

        public String getMobileH5ClientId() {
            return mobileH5ClientId;
        }

        public void setMobileH5ClientId(String mobileH5ClientId) {
            this.mobileH5ClientId = mobileH5ClientId;
        }

        public String getMobileAppClientId() {
            return mobileAppClientId;
        }

        public void setMobileAppClientId(String mobileAppClientId) {
            this.mobileAppClientId = mobileAppClientId;
        }

        public String getClientSecret() {
            return clientSecret;
        }

        public void setClientSecret(String clientSecret) {
            this.clientSecret = clientSecret;
        }

        public String getAudience() {
            return audience;
        }

        public void setAudience(String audience) {
            this.audience = audience;
        }

        public String getClientAuthenticationMethod() {
            return clientAuthenticationMethod;
        }

        public void setClientAuthenticationMethod(String clientAuthenticationMethod) {
            this.clientAuthenticationMethod = clientAuthenticationMethod;
        }

        public Set<String> getRedirectUris() {
            return Set.copyOf(redirectUris);
        }

        public void setRedirectUris(Set<String> redirectUris) {
            this.redirectUris = redirectUris == null ? new LinkedHashSet<>() : new LinkedHashSet<>(redirectUris);
        }

        public Set<String> getScopes() {
            return Set.copyOf(scopes);
        }

        public void setScopes(Set<String> scopes) {
            this.scopes = scopes == null ? new LinkedHashSet<>() : new LinkedHashSet<>(scopes);
        }

        public String getAgeClaim() {
            return ageClaim;
        }

        public void setAgeClaim(String ageClaim) {
            this.ageClaim = ageClaim;
        }

        public java.time.Duration getRequestTimeout() {
            return requestTimeout;
        }

        public void setRequestTimeout(java.time.Duration requestTimeout) {
            this.requestTimeout = requestTimeout;
        }

        public java.time.Duration getDiscoveryCacheTtl() {
            return discoveryCacheTtl;
        }

        public void setDiscoveryCacheTtl(java.time.Duration discoveryCacheTtl) {
            this.discoveryCacheTtl = discoveryCacheTtl;
        }

        public java.time.Duration getJwksMaxAge() {
            return jwksMaxAge;
        }

        public void setJwksMaxAge(java.time.Duration jwksMaxAge) {
            this.jwksMaxAge = jwksMaxAge;
        }

        public java.time.Duration getTransactionTtl() {
            return transactionTtl;
        }

        public void setTransactionTtl(java.time.Duration transactionTtl) {
            this.transactionTtl = transactionTtl;
        }

        public java.time.Duration getClockSkew() {
            return clockSkew;
        }

        public void setClockSkew(java.time.Duration clockSkew) {
            this.clockSkew = clockSkew;
        }
    }

    /** IAM-owned JDBC settings; no in-memory fallback is allowed when enabled. */
    public static class PersistenceProperties {

        private boolean enabled;

        private String jdbcUrl;

        private String username;

        private String password;

        @NotBlank
        @Pattern(regexp = "[a-zA-Z][a-zA-Z0-9_]{0,63}")
        private String schema = "iam_service";

        public boolean isEnabled() {
            return enabled;
        }

        public void setEnabled(boolean enabled) {
            this.enabled = enabled;
        }

        public String getJdbcUrl() {
            return jdbcUrl;
        }

        public void setJdbcUrl(String jdbcUrl) {
            this.jdbcUrl = jdbcUrl;
        }

        public String getUsername() {
            return username;
        }

        public void setUsername(String username) {
            this.username = username;
        }

        public String getPassword() {
            return password;
        }

        public void setPassword(String password) {
            this.password = password;
        }

        public String getSchema() {
            return schema;
        }

        public void setSchema(String schema) {
            this.schema = schema;
        }
    }
}
