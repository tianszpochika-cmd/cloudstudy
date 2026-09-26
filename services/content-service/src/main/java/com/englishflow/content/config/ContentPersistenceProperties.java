package com.englishflow.content.config;

import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Pattern;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/** Explicit content storage selection; disabled is safe and never serves an in-memory fallback. */
@Validated
@ConfigurationProperties(prefix = "content.persistence", ignoreUnknownFields = false, ignoreInvalidFields = false)
public class ContentPersistenceProperties {

    @NotBlank
    @Pattern(regexp = "disabled|memory|jdbc")
    private String mode = "disabled";
    private String jdbcUrl;
    private String username;
    private String password;
    private String driverClassName = "com.mysql.cj.jdbc.Driver";
    @Min(0)
    @Max(32)
    private int poolMinIdle = 1;
    @Min(1)
    @Max(32)
    private int poolMaxSize = 8;

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

    public int getPoolMinIdle() {
        return poolMinIdle;
    }

    public void setPoolMinIdle(int poolMinIdle) {
        this.poolMinIdle = poolMinIdle;
    }

    public int getPoolMaxSize() {
        return poolMaxSize;
    }

    public void setPoolMaxSize(int poolMaxSize) {
        this.poolMaxSize = poolMaxSize;
    }

    @AssertTrue(message = "jdbc persistence requires URL, username, password and driver class")
    public boolean isJdbcConfigurationComplete() {
        return !"jdbc".equals(mode)
                || !blank(jdbcUrl) && !blank(username) && password != null && !blank(driverClassName)
                && poolMinIdle <= poolMaxSize;
    }

    private static boolean blank(String value) {
        return value == null || value.isBlank();
    }
}
