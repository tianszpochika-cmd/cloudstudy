package com.englishflow.iam.config;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

import java.time.Duration;

/**
 * Runtime configuration for the platform-owned authentication center.
 *
 * <p>The IAM service is the only signer. It verifies account passwords, signs short-lived
 * asymmetric access JWTs, publishes the public JWKS and persists opaque refresh-token families.
 * There is deliberately no external identity-provider configuration here.</p>
 */
@Validated
@ConfigurationProperties(prefix = "iam", ignoreUnknownFields = false, ignoreInvalidFields = false)
public class IamServiceProperties {

    @NotBlank
    @Pattern(regexp = "phase-[1-3]")
    private String phase = "phase-1";

    @NotBlank
    @Size(max = 63)
    @Pattern(regexp = "[a-z][a-z0-9_-]{0,62}")
    private String platformTenant = "platform";

    /** Local-only birth-year attestation switch. Production must keep this false. */
    private boolean localAdultGateEnabled;

    @Valid
    private ConsentProperties consent = new ConsentProperties();

    @Valid
    private JwtProperties jwt = new JwtProperties();

    @Valid
    private AccountProperties account = new AccountProperties();

    @Valid
    private PersistenceProperties persistence = new PersistenceProperties();

    @Valid
    private IdempotencyProperties idempotency = new IdempotencyProperties();

    @Valid
    private PolicyProperties policy = new PolicyProperties();

    public String getPhase() { return phase; }
    public void setPhase(String phase) { this.phase = phase; }
    public String getPlatformTenant() { return platformTenant; }
    public void setPlatformTenant(String platformTenant) { this.platformTenant = platformTenant; }
    public boolean isLocalAdultGateEnabled() { return localAdultGateEnabled; }
    public void setLocalAdultGateEnabled(boolean localAdultGateEnabled) { this.localAdultGateEnabled = localAdultGateEnabled; }
    public ConsentProperties getConsent() { return consent; }
    public void setConsent(ConsentProperties consent) { this.consent = consent == null ? new ConsentProperties() : consent; }
    public JwtProperties getJwt() { return jwt; }
    public void setJwt(JwtProperties jwt) { this.jwt = jwt == null ? new JwtProperties() : jwt; }
    public AccountProperties getAccount() { return account; }
    public void setAccount(AccountProperties account) { this.account = account == null ? new AccountProperties() : account; }
    public PersistenceProperties getPersistence() { return persistence; }
    public void setPersistence(PersistenceProperties persistence) { this.persistence = persistence == null ? new PersistenceProperties() : persistence; }
    public IdempotencyProperties getIdempotency() { return idempotency; }
    public void setIdempotency(IdempotencyProperties idempotency) { this.idempotency = idempotency == null ? new IdempotencyProperties() : idempotency; }
    public PolicyProperties getPolicy() { return policy; }
    public void setPolicy(PolicyProperties policy) { this.policy = policy == null ? new PolicyProperties() : policy; }

    /** Selects where server-published consent documents come from. */
    public static class ConsentProperties {
        @NotBlank
        @Pattern(regexp = "auto|control-plane|local-candidate")
        private String policySource = "auto";

        public String getPolicySource() { return policySource; }
        public void setPolicySource(String policySource) { this.policySource = policySource; }
    }

    public static class JwtProperties {
        @NotBlank
        private String issuer = "http://127.0.0.1:18087";
        @NotBlank
        private String audience = "yuxuexing-api";
        @NotBlank
        @Pattern(regexp = "RS256")
        private String algorithm = "RS256";
        @NotBlank
        @Size(max = 128)
        private String keyId = "iam-local-2026-08";
        private String privateKeyPem;
        private String privateKeyFile;
        /** JSON JWK set containing previous public signing keys kept during rotation overlap. */
        private String previousPublicKeysJson;
        /** Ephemeral keys are allowed only for local development; production sets this false. */
        private boolean ephemeralKeysAllowed;
        private Duration accessTokenTtl = Duration.ofMinutes(15);
        private Duration refreshTokenTtl = Duration.ofDays(30);
        private Duration clockSkew = Duration.ofSeconds(60);
        @NotBlank
        @Size(max = 64)
        private String refreshCookieName = "yuxuexing_refresh";
        private boolean refreshCookieSecure = true;

        public String getIssuer() { return issuer; }
        public void setIssuer(String issuer) { this.issuer = issuer; }
        public String getAudience() { return audience; }
        public void setAudience(String audience) { this.audience = audience; }
        public String getAlgorithm() { return algorithm; }
        public void setAlgorithm(String algorithm) { this.algorithm = algorithm; }
        public String getKeyId() { return keyId; }
        public void setKeyId(String keyId) { this.keyId = keyId; }
        public String getPrivateKeyPem() { return privateKeyPem; }
        public void setPrivateKeyPem(String privateKeyPem) { this.privateKeyPem = privateKeyPem; }
        public String getPrivateKeyFile() { return privateKeyFile; }
        public void setPrivateKeyFile(String privateKeyFile) { this.privateKeyFile = privateKeyFile; }
        public String getPreviousPublicKeysJson() { return previousPublicKeysJson; }
        public void setPreviousPublicKeysJson(String previousPublicKeysJson) { this.previousPublicKeysJson = previousPublicKeysJson; }
        public boolean isEphemeralKeysAllowed() { return ephemeralKeysAllowed; }
        public void setEphemeralKeysAllowed(boolean ephemeralKeysAllowed) { this.ephemeralKeysAllowed = ephemeralKeysAllowed; }
        public Duration getAccessTokenTtl() { return accessTokenTtl; }
        public void setAccessTokenTtl(Duration accessTokenTtl) { this.accessTokenTtl = accessTokenTtl; }
        public Duration getRefreshTokenTtl() { return refreshTokenTtl; }
        public void setRefreshTokenTtl(Duration refreshTokenTtl) { this.refreshTokenTtl = refreshTokenTtl; }
        public Duration getClockSkew() { return clockSkew; }
        public void setClockSkew(Duration clockSkew) { this.clockSkew = clockSkew; }
        public String getRefreshCookieName() { return refreshCookieName; }
        public void setRefreshCookieName(String refreshCookieName) { this.refreshCookieName = refreshCookieName; }
        public boolean isRefreshCookieSecure() { return refreshCookieSecure; }
        public void setRefreshCookieSecure(boolean refreshCookieSecure) { this.refreshCookieSecure = refreshCookieSecure; }
    }

    public static class AccountProperties {
        private int passwordMinLength = 12;
        private int maxFailedAttempts = 5;
        private Duration lockDuration = Duration.ofMinutes(15);
        private Duration resetTokenTtl = Duration.ofMinutes(15);
        private int loginRequestsPerMinute = 20;
        private int resetRequestsPerMinute = 5;

        public int getPasswordMinLength() { return passwordMinLength; }
        public void setPasswordMinLength(int passwordMinLength) { this.passwordMinLength = passwordMinLength; }
        public int getMaxFailedAttempts() { return maxFailedAttempts; }
        public void setMaxFailedAttempts(int maxFailedAttempts) { this.maxFailedAttempts = maxFailedAttempts; }
        public Duration getLockDuration() { return lockDuration; }
        public void setLockDuration(Duration lockDuration) { this.lockDuration = lockDuration; }
        public Duration getResetTokenTtl() { return resetTokenTtl; }
        public void setResetTokenTtl(Duration resetTokenTtl) { this.resetTokenTtl = resetTokenTtl; }
        public int getLoginRequestsPerMinute() { return loginRequestsPerMinute; }
        public void setLoginRequestsPerMinute(int loginRequestsPerMinute) { this.loginRequestsPerMinute = loginRequestsPerMinute; }
        public int getResetRequestsPerMinute() { return resetRequestsPerMinute; }
        public void setResetRequestsPerMinute(int resetRequestsPerMinute) { this.resetRequestsPerMinute = resetRequestsPerMinute; }
    }

    public static class PersistenceProperties {
        private boolean enabled;
        private String jdbcUrl;
        private String username;
        private String password;
        @NotBlank
        @Pattern(regexp = "[a-zA-Z][a-zA-Z0-9_]{0,63}")
        private String schema = "iam_service";

        public boolean isEnabled() { return enabled; }
        public void setEnabled(boolean enabled) { this.enabled = enabled; }
        public String getJdbcUrl() { return jdbcUrl; }
        public void setJdbcUrl(String jdbcUrl) { this.jdbcUrl = jdbcUrl; }
        public String getUsername() { return username; }
        public void setUsername(String username) { this.username = username; }
        public String getPassword() { return password; }
        public void setPassword(String password) { this.password = password; }
        public String getSchema() { return schema; }
        public void setSchema(String schema) { this.schema = schema; }
    }

    public static class IdempotencyProperties {
        /** Stable secret for deterministic credential replay; production must inject it. */
        @Size(max = 256)
        private String replaySecret = "";
        /** Independent HMAC key that prevents persisted request bindings becoming password oracles. */
        @Size(max = 256)
        private String fingerprintSecret = "";
        /** One-time operator confirmation that all V12 writers and in-flight requests are drained. */
        private boolean v13WritersDrained;
        private Duration retention = Duration.ofHours(24);

        public String getReplaySecret() { return replaySecret; }
        public void setReplaySecret(String replaySecret) { this.replaySecret = replaySecret == null ? "" : replaySecret; }
        public String getFingerprintSecret() { return fingerprintSecret; }
        public void setFingerprintSecret(String fingerprintSecret) {
            this.fingerprintSecret = fingerprintSecret == null ? "" : fingerprintSecret;
        }
        public boolean isV13WritersDrained() { return v13WritersDrained; }
        public void setV13WritersDrained(boolean v13WritersDrained) {
            this.v13WritersDrained = v13WritersDrained;
        }
        public Duration getRetention() { return retention; }
        public void setRetention(Duration retention) { this.retention = retention; }
    }

    public static class PolicyProperties {
        @Valid
        private BootstrapProperties bootstrap = new BootstrapProperties();

        public BootstrapProperties getBootstrap() { return bootstrap; }
        public void setBootstrap(BootstrapProperties bootstrap) {
            this.bootstrap = bootstrap == null ? new BootstrapProperties() : bootstrap;
        }
    }

    public static class BootstrapProperties {
        /** Explicitly local/test-only. Production must provision policy operators outside this seam. */
        private boolean enabled;
        @Size(max = 128)
        private String existingAccountIdentifier = "";

        public boolean isEnabled() { return enabled; }
        public void setEnabled(boolean enabled) { this.enabled = enabled; }
        public String getExistingAccountIdentifier() { return existingAccountIdentifier; }
        public void setExistingAccountIdentifier(String existingAccountIdentifier) {
            this.existingAccountIdentifier = existingAccountIdentifier == null ? "" : existingAccountIdentifier;
        }
    }
}
