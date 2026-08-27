package com.englishflow.learner.config;

import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/**
 * Explicit persistence selection for the learner service.
 *
 * <p>The default is {@code disabled}; a missing MySQL configuration can therefore never be
 * mistaken for a durable learner store. {@code memory} is reserved for local/domain tests and
 * {@code jdbc} is the only mode that claims durable data.</p>
 */
@Validated
@ConfigurationProperties(prefix = "learner.persistence", ignoreUnknownFields = false, ignoreInvalidFields = false)
public class LearnerPersistenceProperties {

    @NotBlank
    @Pattern(regexp = "disabled|memory|jdbc")
    private String mode = "disabled";

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

    public boolean isJdbc() {
        return "jdbc".equals(mode);
    }

    public boolean isMemory() {
        return "memory".equals(mode);
    }

    @AssertTrue(message = "jdbc persistence requires a URL, username, password and driver class")
    public boolean isJdbcConfigurationComplete() {
        return !isJdbc()
                || !blank(jdbcUrl)
                && !blank(username)
                && password != null
                && !blank(driverClassName);
    }

    private static boolean blank(String value) {
        return value == null || value.isBlank();
    }
}
