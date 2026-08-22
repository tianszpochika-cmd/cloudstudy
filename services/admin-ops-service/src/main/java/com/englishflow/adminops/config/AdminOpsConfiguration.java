package com.englishflow.adminops.config;

import java.time.Clock;

import com.englishflow.adminops.adapter.memory.InMemoryAdminProjection;
import com.englishflow.adminops.adapter.memory.InMemoryAuditTrail;
import com.englishflow.adminops.adapter.memory.InMemoryDomainCommandPort;
import com.englishflow.adminops.adapter.memory.InMemoryIdempotencyLedger;
import com.englishflow.adminops.adapter.memory.InMemoryMediaObjectAuthorization;
import com.englishflow.adminops.application.AdminOpsService;
import com.englishflow.adminops.domain.AdminProjectionPort;
import com.englishflow.adminops.domain.AuditTrail;
import com.englishflow.adminops.domain.ConfirmationService;
import com.englishflow.adminops.domain.DomainCommandPort;
import com.englishflow.adminops.domain.IdempotencyLedger;
import com.englishflow.adminops.support.SupportTicketService;
import com.englishflow.adminops.support.MediaObjectAuthorizationPort;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Local wiring uses replaceable in-memory adapters. Production wiring must replace these ports
 * with read projections, an outbox-backed command adapter and service-owned audit/idempotency stores.
 */
@Configuration(proxyBeanMethods = false)
public class AdminOpsConfiguration {

    @Bean
    Clock adminOpsClock() {
        return Clock.systemUTC();
    }

    @Bean
    AdminProjectionPort adminProjection() {
        return new InMemoryAdminProjection();
    }

    @Bean
    DomainCommandPort domainCommandPort() {
        return new InMemoryDomainCommandPort();
    }

    @Bean
    AuditTrail auditTrail() {
        return new InMemoryAuditTrail();
    }

    @Bean
    IdempotencyLedger idempotencyLedger() {
        return new InMemoryIdempotencyLedger();
    }

    @Bean
    MediaObjectAuthorizationPort mediaObjectAuthorization() {
        return new InMemoryMediaObjectAuthorization();
    }

    @Bean
    ConfirmationService confirmationService(Clock clock, AdminOpsProperties properties) {
        return new ConfirmationService(clock, properties.commandConfirmationTtl());
    }

    @Bean
    AdminOpsService adminOpsService(
            Clock clock,
            AdminProjectionPort projections,
            DomainCommandPort commandPort,
            AuditTrail auditTrail,
            IdempotencyLedger idempotency,
            ConfirmationService confirmations) {
        return new AdminOpsService(clock, projections, commandPort, auditTrail, idempotency, confirmations);
    }

    @Bean
    SupportTicketService supportTicketService(
            Clock clock,
            AdminOpsProperties properties,
            DomainCommandPort commandPort,
            AuditTrail auditTrail,
            IdempotencyLedger idempotency,
            ConfirmationService confirmations,
            MediaObjectAuthorizationPort mediaObjects) {
        return new SupportTicketService(
                clock, properties.supportDefaultSla(), commandPort, auditTrail, idempotency, confirmations, mediaObjects);
    }
}
