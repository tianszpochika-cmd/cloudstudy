package com.englishflow.learner.config;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.Valid;

import org.springframework.boot.context.properties.NestedConfigurationProperty;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/** Service-owned runtime metadata. It must not be populated from request JSON or headers. */
@Validated
@ConfigurationProperties(prefix = "learner", ignoreUnknownFields = false, ignoreInvalidFields = false)
public class LearnerServiceProperties {

    @NotBlank
    @Pattern(regexp = "phase-[1-3]")
    private String phase;

    private boolean legacyReadEnabled;

    /**
     * Keep the learner prefix closed for binding while allowing the separately managed
     * persistence properties to live under the same service-owned namespace.
     */
    @Valid
    @NestedConfigurationProperty
    private LearnerPersistenceProperties persistence = new LearnerPersistenceProperties();

    @Valid
    @NestedConfigurationProperty
    private ConsentRecheckProperties consentRecheck = new ConsentRecheckProperties();

    public String getPhase() {
        return phase;
    }

    public void setPhase(String phase) {
        this.phase = phase;
    }

    public boolean isLegacyReadEnabled() {
        return legacyReadEnabled;
    }

    public void setLegacyReadEnabled(boolean legacyReadEnabled) {
        this.legacyReadEnabled = legacyReadEnabled;
    }

    public LearnerPersistenceProperties getPersistence() {
        return persistence;
    }

    public void setPersistence(LearnerPersistenceProperties persistence) {
        this.persistence = persistence;
    }

    public ConsentRecheckProperties getConsentRecheck() {
        return consentRecheck;
    }

    public void setConsentRecheck(ConsentRecheckProperties consentRecheck) {
        this.consentRecheck = consentRecheck == null ? new ConsentRecheckProperties() : consentRecheck;
    }

    /** Live IAM learning-consent read. On by default; a missing IAM answer fails closed. */
    public static class ConsentRecheckProperties {
        private boolean enabled = true;
        private String iamBaseUrl = "https://127.0.0.1:18087";
        private String clientId = "learner-service";
        private String clientSecret = "";

        public boolean isEnabled() { return enabled; }
        public void setEnabled(boolean enabled) { this.enabled = enabled; }
        public String getIamBaseUrl() { return iamBaseUrl; }
        public void setIamBaseUrl(String iamBaseUrl) { this.iamBaseUrl = iamBaseUrl; }
        public String getClientId() { return clientId; }
        public void setClientId(String clientId) { this.clientId = clientId; }
        public String getClientSecret() { return clientSecret; }
        public void setClientSecret(String clientSecret) { this.clientSecret = clientSecret; }
    }
}
