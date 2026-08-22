package com.englishflow.learner.config;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

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
}
