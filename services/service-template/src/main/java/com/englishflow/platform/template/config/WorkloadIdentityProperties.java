package com.englishflow.platform.template.config;

import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.Set;

import jakarta.validation.constraints.AssertTrue;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/**
 * Explicit workload-identity/mTLS boundary for internal service calls.
 *
 * <p>The TLS key/trust stores are deployment inputs and must be injected by the platform secret
 * manager. This type deliberately stores only their locations, never certificate material or
 * passwords. A service identity is accepted only from the TLS client certificate; forwarded
 * certificate and service headers are never trusted.</p>
 */
@Validated
@ConfigurationProperties(
        prefix = "security.workload-identity",
        ignoreUnknownFields = false,
        ignoreInvalidFields = false)
public class WorkloadIdentityProperties {

    private boolean enabled;

    private boolean required;

    private String serviceId;

    private Set<String> allowedCallers = Set.of();

    private String keyStore;

    private String trustStore;

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }

    public boolean isRequired() {
        return required;
    }

    public void setRequired(boolean required) {
        this.required = required;
    }

    public String getServiceId() {
        return serviceId;
    }

    public void setServiceId(String serviceId) {
        this.serviceId = normalize(serviceId);
    }

    public Set<String> getAllowedCallers() {
        return allowedCallers;
    }

    public void setAllowedCallers(Set<String> allowedCallers) {
        if (allowedCallers == null || allowedCallers.isEmpty()) {
            this.allowedCallers = Set.of();
            return;
        }
        Set<String> normalized = new LinkedHashSet<>();
        for (String caller : allowedCallers) {
            String value = normalize(caller);
            if (value != null) {
                normalized.add(value);
            }
        }
        this.allowedCallers = Collections.unmodifiableSet(normalized);
    }

    public String getKeyStore() {
        return keyStore;
    }

    public void setKeyStore(String keyStore) {
        this.keyStore = normalize(keyStore);
    }

    public String getTrustStore() {
        return trustStore;
    }

    public void setTrustStore(String trustStore) {
        this.trustStore = normalize(trustStore);
    }

    @AssertTrue(message = "enabled workload identity requires mTLS key/trust stores, service id and allowed callers")
    public boolean isConfigurationComplete() {
        if (!enabled) {
            return !required;
        }
        return !isBlank(serviceId) && !allowedCallers.isEmpty()
                && !isBlank(keyStore) && !isBlank(trustStore);
    }

    private static String normalize(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }
}
