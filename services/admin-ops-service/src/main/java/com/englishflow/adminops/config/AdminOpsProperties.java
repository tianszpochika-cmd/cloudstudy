package com.englishflow.adminops.config;

import java.time.Duration;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "admin-ops")
public record AdminOpsProperties(
        String phase,
        Duration commandConfirmationTtl,
        Duration supportDefaultSla) {

    public AdminOpsProperties {
        phase = phase == null || phase.isBlank() ? "PHASE_1_ADULT" : phase.trim();
        commandConfirmationTtl = commandConfirmationTtl == null ? Duration.ofMinutes(5) : commandConfirmationTtl;
        supportDefaultSla = supportDefaultSla == null ? Duration.ofHours(48) : supportDefaultSla;
        if (commandConfirmationTtl.isNegative() || commandConfirmationTtl.isZero()) {
            throw new IllegalArgumentException("command-confirmation-ttl must be positive");
        }
        if (supportDefaultSla.isNegative() || supportDefaultSla.isZero()) {
            throw new IllegalArgumentException("support-default-sla must be positive");
        }
    }
}
