package com.englishflow.social.security;

import org.springframework.boot.context.properties.ConfigurationProperties;

/** OIDC resource-server seam; disabled by default until the IdP gate is supplied. */
@ConfigurationProperties(prefix = "security.resource-server")
public class SocialResourceServerProperties {

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
}
