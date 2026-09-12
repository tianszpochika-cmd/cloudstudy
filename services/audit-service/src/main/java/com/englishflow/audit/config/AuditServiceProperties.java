package com.englishflow.audit.config;

import java.time.Duration;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

@Validated
@ConfigurationProperties(prefix = "audit")
public class AuditServiceProperties {

    @Valid
    private Persistence persistence = new Persistence();

    @Valid
    private Security security = new Security();

    public Persistence getPersistence() { return persistence; }
    public void setPersistence(Persistence persistence) { this.persistence = persistence; }
    public Security getSecurity() { return security; }
    public void setSecurity(Security security) { this.security = security; }

    public static class Persistence {
        private boolean enabled;
        private String jdbcUrl = "";
        private String username = "";
        private String password = "";
        @NotBlank
        private String schema = "audit_service";
        private Duration connectTimeout = Duration.ofSeconds(5);

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
        public Duration getConnectTimeout() { return connectTimeout; }
        public void setConnectTimeout(Duration connectTimeout) { this.connectTimeout = connectTimeout; }
    }

    public static class Security {
        private boolean resourceServerEnabled = true;
        @NotBlank
        private String issuerUri = "http://127.0.0.1:18087";
        @NotBlank
        private String jwkSetUri = "http://127.0.0.1:18087/api/v1/auth/jwks";
        @NotBlank
        private String audience = "yuxuexing-api";
        @NotNull
        private Duration pdpTimeout = Duration.ofMillis(250);

        public boolean isResourceServerEnabled() { return resourceServerEnabled; }
        public void setResourceServerEnabled(boolean resourceServerEnabled) { this.resourceServerEnabled = resourceServerEnabled; }
        public String getIssuerUri() { return issuerUri; }
        public void setIssuerUri(String issuerUri) { this.issuerUri = issuerUri; }
        public String getJwkSetUri() { return jwkSetUri; }
        public void setJwkSetUri(String jwkSetUri) { this.jwkSetUri = jwkSetUri; }
        public String getAudience() { return audience; }
        public void setAudience(String audience) { this.audience = audience; }
        public Duration getPdpTimeout() { return pdpTimeout; }
        public void setPdpTimeout(Duration pdpTimeout) { this.pdpTimeout = pdpTimeout; }
    }
}
