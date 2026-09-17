package com.englishflow.commerce.config;

import com.englishflow.commerce.adapter.jdbc.JdbcCommerceAuditPort;
import com.englishflow.commerce.adapter.jdbc.JdbcCommerceIdempotencyPort;
import com.englishflow.commerce.adapter.jdbc.JdbcCommerceOutboxPort;
import com.englishflow.commerce.adapter.jdbc.JdbcCommerceStore;
import com.englishflow.commerce.adapter.memory.HmacPaymentSignatureVerifier;
import com.englishflow.commerce.adapter.memory.InMemoryAuditPort;
import com.englishflow.commerce.adapter.memory.InMemoryCommerceStore;
import com.englishflow.commerce.adapter.memory.InMemoryIdempotencyPort;
import com.englishflow.commerce.adapter.memory.InMemoryOutboxPort;
import com.englishflow.commerce.adapter.memory.SandboxPaymentProvider;
import com.englishflow.commerce.adapter.memory.SystemCommerceClock;
import com.englishflow.commerce.application.CommerceApplicationService;
import com.englishflow.commerce.application.ports.AuditPort;
import com.englishflow.commerce.application.ports.CommerceClock;
import com.englishflow.commerce.application.ports.CommerceStore;
import com.englishflow.commerce.application.ports.IdempotencyPort;
import com.englishflow.commerce.application.ports.OutboxPort;
import com.englishflow.commerce.application.ports.PaymentProviderPort;
import com.englishflow.commerce.application.ports.PaymentProviderRegistry;
import com.englishflow.commerce.application.security.CommerceAccessPolicy;
import com.englishflow.commerce.domain.PaymentGate;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Profile;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.JdbcTemplate;
import tools.jackson.databind.ObjectMapper;

@Configuration
@EnableConfigurationProperties(CommerceProperties.class)
public class CommerceServiceConfiguration {
    @Bean
    @Profile("!local-real")
    CommerceStore commerceStore() { return new InMemoryCommerceStore(); }

    @Bean
    @Profile("local-real")
    CommerceStore localRealCommerceStore(JdbcTemplate jdbc) { return new JdbcCommerceStore(jdbc); }

    @Bean
    @Profile("!local-real")
    IdempotencyPort commerceIdempotency() { return new InMemoryIdempotencyPort(); }

    @Bean
    @Profile("local-real")
    IdempotencyPort localRealCommerceIdempotency(JdbcTemplate jdbc, ObjectMapper mapper) { return new JdbcCommerceIdempotencyPort(jdbc, mapper); }

    @Bean
    @Profile("!local-real")
    AuditPort commerceAudit() { return new InMemoryAuditPort(); }

    @Bean
    @Profile("local-real")
    AuditPort localRealCommerceAudit(JdbcTemplate jdbc, ObjectMapper mapper) { return new JdbcCommerceAuditPort(jdbc, mapper); }

    @Bean
    @Profile("!local-real")
    OutboxPort commerceOutbox() { return new InMemoryOutboxPort(); }

    @Bean
    @Profile("local-real")
    OutboxPort localRealCommerceOutbox(JdbcTemplate jdbc, ObjectMapper mapper) { return new JdbcCommerceOutboxPort(jdbc, mapper); }

    @Bean CommerceClock commerceClock() { return new SystemCommerceClock(); }
    @Bean CommerceAccessPolicy commerceAccessPolicy() { return new CommerceAccessPolicy(); }

    // M7-007 live: the sandbox adapter is HMAC-only (no provider SDK or real
    // credential), so it is safe in local-real too. Real providers stay off
    // via PaymentGate; only SANDBOX verifies.
    @Bean
    HmacPaymentSignatureVerifier paymentSignatureVerifier(CommerceProperties properties) {
        return new HmacPaymentSignatureVerifier(properties.payment().sandboxSecret());
    }

    @Bean
    SandboxPaymentProvider sandboxPaymentProvider(HmacPaymentSignatureVerifier verifier) {
        return new SandboxPaymentProvider(verifier);
    }

    @Bean
    PaymentProviderRegistry paymentProviderRegistry(SandboxPaymentProvider sandbox) {
        return new PaymentProviderRegistry(java.util.List.<PaymentProviderPort>of(sandbox));
    }

    @Bean PaymentGate paymentGate(CommerceProperties properties) {
        CommerceProperties.Payment payment = properties.payment();
        boolean sandbox = payment.enabled() && "SANDBOX".equalsIgnoreCase(payment.environment());
        java.util.Set<com.englishflow.commerce.domain.PaymentProvider> providers = sandbox
                ? java.util.Set.of(com.englishflow.commerce.domain.PaymentProvider.SANDBOX) : java.util.Set.of();
        return new PaymentGate(sandbox, payment.environment(), payment.realProvidersEnabled(), providers);
    }

    @Bean CommerceApplicationService commerceApplicationService(CommerceStore store, IdempotencyPort idempotency,
            AuditPort audit, OutboxPort outbox, PaymentProviderRegistry providers, CommerceAccessPolicy access,
            PaymentGate gate, CommerceClock clock) {
        return new CommerceApplicationService(store, idempotency, audit, outbox, providers, access, gate, clock);
    }

}
