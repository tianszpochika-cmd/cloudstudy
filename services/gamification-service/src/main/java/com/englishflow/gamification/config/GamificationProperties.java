package com.englishflow.gamification.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/** Runtime knobs for this service; domain rules do not read client-provided values. */
@ConfigurationProperties(prefix = "gamification")
public class GamificationProperties {

    private String phase = "phase-1";
    private String seasonId = "SEASON_2026_Q3";
    private FeatureFlags featureFlags = new FeatureFlags();
    private Security security = new Security();

    public String getPhase() {
        return phase;
    }

    public void setPhase(String phase) {
        this.phase = phase;
    }

    public String getSeasonId() {
        return seasonId;
    }

    public void setSeasonId(String seasonId) {
        this.seasonId = seasonId;
    }

    public FeatureFlags getFeatureFlags() {
        return featureFlags;
    }

    public void setFeatureFlags(FeatureFlags featureFlags) {
        this.featureFlags = featureFlags;
    }

    public Security getSecurity() {
        return security;
    }

    public void setSecurity(Security security) {
        this.security = security;
    }

    public static class FeatureFlags {
        private boolean enabled = true;
        private boolean rewardsEnabled = true;

        public boolean isEnabled() {
            return enabled;
        }

        public void setEnabled(boolean enabled) {
            this.enabled = enabled;
        }

        public boolean isRewardsEnabled() {
            return rewardsEnabled;
        }

        public void setRewardsEnabled(boolean rewardsEnabled) {
            this.rewardsEnabled = rewardsEnabled;
        }
    }

    public static class Security {
        private boolean resourceServerEnabled;
        private String issuerUri = "";
        private String jwkSetUri = "";
        private boolean allowVerifiedServiceHeader;

        public boolean isResourceServerEnabled() {
            return resourceServerEnabled;
        }

        public void setResourceServerEnabled(boolean resourceServerEnabled) {
            this.resourceServerEnabled = resourceServerEnabled;
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

        public boolean isAllowVerifiedServiceHeader() {
            return allowVerifiedServiceHeader;
        }

        public void setAllowVerifiedServiceHeader(boolean allowVerifiedServiceHeader) {
            this.allowVerifiedServiceHeader = allowVerifiedServiceHeader;
        }
    }
}
