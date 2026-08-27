package com.englishflow.learning.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/** Runtime-owned learning switches; no request payload can override these values. */
@ConfigurationProperties(prefix = "learning")
public class LearningServiceProperties {

    private String phase = "phase-1";
    private String srsRulesVersion = "SM2_Q03_V1";

    public String getPhase() {
        return phase;
    }

    public void setPhase(String phase) {
        this.phase = phase;
    }

    public String getSrsRulesVersion() {
        return srsRulesVersion;
    }

    public void setSrsRulesVersion(String srsRulesVersion) {
        this.srsRulesVersion = srsRulesVersion;
    }
}
