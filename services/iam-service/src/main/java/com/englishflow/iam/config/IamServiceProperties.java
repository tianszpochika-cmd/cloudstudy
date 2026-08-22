package com.englishflow.iam.config;

import jakarta.validation.constraints.AssertFalse;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/**
 * Fail-closed service identity and phase boundary.
 *
 * <p>The provider flag is deliberately constrained to false until G-IDP is approved. A future
 * provider adapter must be introduced through an ADR and a separate deployment configuration,
 * not by changing this service into a token server.</p>
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

    @AssertFalse
    private boolean realProviderEnabled;

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
}
