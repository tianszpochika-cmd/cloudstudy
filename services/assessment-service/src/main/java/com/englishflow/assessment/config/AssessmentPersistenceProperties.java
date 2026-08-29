package com.englishflow.assessment.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/** Environment-controlled JDBC settings; no database configuration means no runtime service bean. */
@ConfigurationProperties(prefix = "assessment.persistence")
public class AssessmentPersistenceProperties {
    private boolean enabled;
    private String schema = "assessment_service";
    private String jdbcUrl;
    private String username;
    private String password;
    private String driverClassName = "com.mysql.cj.jdbc.Driver";
    private boolean tolerateCorruptLegacyRows;

    public boolean isEnabled() { return enabled; }
    public void setEnabled(boolean enabled) { this.enabled = enabled; }
    public String getSchema() { return schema; }
    public void setSchema(String schema) { this.schema = schema; }
    public String getJdbcUrl() { return jdbcUrl; }
    public void setJdbcUrl(String jdbcUrl) { this.jdbcUrl = jdbcUrl; }
    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }
    public String getPassword() { return password; }
    public void setPassword(String password) { this.password = password; }
    public String getDriverClassName() { return driverClassName; }
    public void setDriverClassName(String driverClassName) { this.driverClassName = driverClassName; }
    public boolean isTolerateCorruptLegacyRows() { return tolerateCorruptLegacyRows; }
    public void setTolerateCorruptLegacyRows(boolean tolerateCorruptLegacyRows) { this.tolerateCorruptLegacyRows = tolerateCorruptLegacyRows; }
}
