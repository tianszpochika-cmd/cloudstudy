package com.englishflow.learning.config;

import java.util.Locale;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Explicit persistence mode. The default is fail-closed so a missing MySQL connection cannot
 * be mistaken for durable learning data.
 */
@ConfigurationProperties(prefix = "learning.persistence")
public class LearningPersistenceProperties {

    private String mode = "fail-closed";
    private String jdbcUrl;
    private String username;
    private String password;
    private String driverClassName = "com.mysql.cj.jdbc.Driver";

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

    public String getDriverClassName() {
        return driverClassName;
    }

    public void setDriverClassName(String driverClassName) {
        this.driverClassName = driverClassName;
    }

    public Mode resolvedMode() {
        String normalized = mode == null ? "" : mode.trim().toLowerCase(Locale.ROOT);
        return switch (normalized) {
            case "jdbc", "mysql" -> Mode.JDBC;
            case "memory-fixture", "memory_fixture", "fixture" -> Mode.MEMORY_FIXTURE;
            case "fail-closed", "fail_closed", "disabled", "" -> Mode.FAIL_CLOSED;
            default -> throw new IllegalStateException(
                    "learning.persistence.mode must be jdbc, memory-fixture or fail-closed");
        };
    }

    public enum Mode {
        JDBC,
        MEMORY_FIXTURE,
        FAIL_CLOSED
    }
}
