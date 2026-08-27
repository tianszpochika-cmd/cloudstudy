package com.englishflow.notification.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/** Explicit persistence mode. The default is fail-closed so memory is never a production fallback. */
@ConfigurationProperties(prefix = "notification.persistence")
public class NotificationPersistenceProperties {

    private String mode = "fail-closed";
    private String jdbcUrl;
    private String username;
    private String password;
    private String schema = "notification_service";

    public String getMode() {
        return mode;
    }

    public void setMode(String mode) {
        this.mode = mode;
    }

    public String getJdbcUrl() {
        return jdbcUrl;
    }

    public void setJdbcUrl(String jdbcUrl) {
        this.jdbcUrl = jdbcUrl;
    }

    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
    }

    public String getPassword() {
        return password;
    }

    public void setPassword(String password) {
        this.password = password;
    }

    public String getSchema() {
        return schema;
    }

    public void setSchema(String schema) {
        this.schema = schema;
    }

    public boolean isJdbc() {
        return "jdbc".equalsIgnoreCase(mode);
    }

    public boolean isMemory() {
        return "memory".equalsIgnoreCase(mode);
    }
}
