package com.englishflow.commerce.config;

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
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
@EnableConfigurationProperties(CommerceProperties.class)
public class CommerceServiceConfiguration {
    @Bean CommerceStore commerceStore() { return new InMemoryCommerceStore(); }
    @Bean IdempotencyPort commerceIdempotency() { return new InMemoryIdempotencyPort(); }
    @Bean AuditPort commerceAudit() { return new InMemoryAuditPort(); }
    @Bean OutboxPort commerceOutbox() { return new InMemoryOutboxPort(); }
    @Bean CommerceClock commerceClock() { return new SystemCommerceClock(); }
    @Bean CommerceAccessPolicy commerceAccessPolicy() { return new CommerceAccessPolicy(); }

    @Bean HmacPaymentSignatureVerifier paymentSignatureVerifier(CommerceProperties properties) {
        return new HmacPaymentSignatureVerifier(properties.payment().sandboxSecret());
    }

    @Bean SandboxPaymentProvider sandboxPaymentProvider(HmacPaymentSignatureVerifier verifier) {
        return new SandboxPaymentProvider(verifier);
    }

    @Bean PaymentProviderRegistry paymentProviderRegistry(SandboxPaymentProvider sandbox) {
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
