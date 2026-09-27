package com.englishflow.adminops.config;

import java.time.Clock;

import com.englishflow.adminops.adapter.jdbc.JdbcAdminOpsAdapters;
import com.englishflow.adminops.adapter.memory.InMemoryAdminProjection;
import com.englishflow.adminops.adapter.memory.InMemoryAuditTrail;
import com.englishflow.adminops.adapter.memory.InMemoryDomainCommandPort;
import com.englishflow.adminops.adapter.memory.InMemoryIdempotencyLedger;
import com.englishflow.adminops.adapter.memory.InMemoryMediaObjectAuthorization;
import com.englishflow.adminops.adapter.memory.InMemoryReviewStateStore;
import com.englishflow.adminops.adapter.memory.InMemoryRiskCaseStore;
import com.englishflow.adminops.adapter.memory.InMemorySupportTicketStore;
import com.englishflow.adminops.application.AdminOpsService;
import com.englishflow.adminops.domain.AdminProjectionPort;
import com.englishflow.adminops.domain.AuditTrail;
import com.englishflow.adminops.domain.ConfirmationService;
import com.englishflow.adminops.domain.DomainCommandPort;
import com.englishflow.adminops.domain.IdempotencyLedger;
import com.englishflow.adminops.domain.ReviewStateStore;
import com.englishflow.adminops.risk.HttpIamLockoutPort;
import com.englishflow.adminops.risk.IamLockoutPort;
import com.englishflow.adminops.risk.RiskCaseService;
import com.englishflow.adminops.risk.RiskCaseStore;
import com.englishflow.adminops.support.SupportTicketService;
import com.englishflow.adminops.support.SupportTicketStore;
import com.englishflow.adminops.support.MediaObjectAuthorizationPort;
import tools.jackson.databind.ObjectMapper;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * The default development profile uses in-memory adapters. local-real uses owner JDBC tables,
 * an outbox-backed command adapter and service-owned audit/idempotency/support stores.
 */
@Configuration(proxyBeanMethods = false)
public class AdminOpsConfiguration {

    @Bean
    Clock adminOpsClock() {
        return Clock.systemUTC();
    }

    @Bean
    @Profile("!local-real")
    AdminProjectionPort adminProjection() {
        return new InMemoryAdminProjection();
    }

    @Bean
    @Profile("local-real")
    AdminProjectionPort localRealAdminProjection(JdbcTemplate jdbc, ObjectMapper mapper) {
        return new JdbcAdminOpsAdapters.Projection(jdbc, mapper);
    }

    @Bean
    @Profile("!local-real")
    DomainCommandPort domainCommandPort() {
        return new InMemoryDomainCommandPort();
    }

    @Bean
    @Profile("local-real")
    DomainCommandPort localRealDomainCommandPort(JdbcTemplate jdbc, ObjectMapper mapper) {
        return new JdbcAdminOpsAdapters.CommandForwarder(jdbc, mapper);
    }

    @Bean
    @Profile("!local-real")
    AuditTrail auditTrail() {
        return new InMemoryAuditTrail();
    }

    @Bean
    @Profile("local-real")
    AuditTrail localRealAuditTrail(JdbcTemplate jdbc, ObjectMapper mapper) {
        return new JdbcAdminOpsAdapters.Audit(jdbc, mapper);
    }

    @Bean
    @Profile("!local-real")
    IdempotencyLedger idempotencyLedger() {
        return new InMemoryIdempotencyLedger();
    }

    @Bean
    @Profile("local-real")
    IdempotencyLedger localRealIdempotencyLedger(JdbcTemplate jdbc, ObjectMapper mapper) {
        return new JdbcAdminOpsAdapters.Idempotency(jdbc, mapper);
    }

    @Bean
    @Profile("!local-real")
    ReviewStateStore reviewStateStore() {
        return new InMemoryReviewStateStore();
    }

    @Bean
    @Profile("local-real")
    ReviewStateStore localRealReviewStateStore(JdbcTemplate jdbc) {
        return new JdbcAdminOpsAdapters.ReviewState(jdbc);
    }

    @Bean
    @Profile("!local-real")
    MediaObjectAuthorizationPort mediaObjectAuthorization() {
        return new InMemoryMediaObjectAuthorization();
    }

    @Bean
    @Profile("local-real")
    MediaObjectAuthorizationPort localRealMediaObjectAuthorization(JdbcTemplate jdbc) {
        return new JdbcAdminOpsAdapters.MediaAuthorization(jdbc);
    }

    @Bean
    @Profile("!local-real")
    SupportTicketStore supportTicketStore() {
        return new InMemorySupportTicketStore();
    }

    @Bean
    @Profile("local-real")
    SupportTicketStore localRealSupportTicketStore(JdbcTemplate jdbc, ObjectMapper mapper) {
        return new JdbcAdminOpsAdapters.SupportTickets(jdbc, mapper);
    }

    @Bean
    @Profile("!local-real")
    RiskCaseStore riskCaseStore() {
        return new InMemoryRiskCaseStore();
    }

    @Bean
    @Profile("local-real")
    RiskCaseStore localRealRiskCaseStore(JdbcTemplate jdbc, ObjectMapper mapper) {
        return new JdbcAdminOpsAdapters.RiskCases(jdbc, mapper);
    }

    @Bean
    IamLockoutPort iamLockoutPort(ObjectMapper mapper,
            @org.springframework.beans.factory.annotation.Value(
                    "${admin-ops.risk.iam-base-url:http://127.0.0.1:18087}") String iamBaseUrl) {
        return new HttpIamLockoutPort(mapper, iamBaseUrl);
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
            ConfirmationService confirmations,
            ReviewStateStore reviewStateStore) {
        return new AdminOpsService(clock, projections, commandPort, auditTrail, idempotency, confirmations,
                reviewStateStore);
    }

    @Bean
    SupportTicketService supportTicketService(
            Clock clock,
            AdminOpsProperties properties,
            DomainCommandPort commandPort,
            AuditTrail auditTrail,
            IdempotencyLedger idempotency,
            ConfirmationService confirmations,
            MediaObjectAuthorizationPort mediaObjects,
            SupportTicketStore ticketStore) {
        return new SupportTicketService(
                clock, properties.supportDefaultSla(), commandPort, auditTrail, idempotency, confirmations,
                mediaObjects, ticketStore);
    }

    @Bean
    RiskCaseService riskCaseService(
            Clock clock,
            AuditTrail auditTrail,
            IdempotencyLedger idempotency,
            RiskCaseStore caseStore,
            IamLockoutPort lockouts) {
        return new RiskCaseService(clock, auditTrail, idempotency, caseStore, lockouts);
    }
}
