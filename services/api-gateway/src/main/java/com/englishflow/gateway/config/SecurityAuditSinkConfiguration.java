package com.englishflow.gateway.config;

import com.englishflow.gateway.support.BoundedSecurityAuditSink;
import com.englishflow.gateway.support.HttpSecurityAuditSink;
import com.englishflow.gateway.support.RuntimeEvidenceSecurityAuditSink;
import com.englishflow.gateway.support.SecurityAuditSink;
import com.englishflow.gateway.support.ServiceTokenClient;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;

import java.net.URI;
import java.time.Duration;

/**
 * Chooses the audit sink.
 *
 * <p>One method decides rather than two beans of the same type with a condition between them, so there is never a second
 * candidate and no declaration order to depend on.
 *
 * <p>The durable settings live in {@link GatewayAuditProperties} rather than on {@code GatewayProperties.Security}. Adding
 * them there was tried and reverted twice: it breaks the test sources that build that record by hand, and a record with a
 * component that has no value does not bind here at all — and no value is exactly what these settings have by default.
 * The properties are optional here for a related reason: a context that wires only this configuration, as the sink tests
 * do, has none.
 */
@Configuration(proxyBeanMethods = false)
public class SecurityAuditSinkConfiguration {

    /** The sink to use: durable when configured, bounded otherwise, stdout under the evidence profile. */
    @Bean
    @Profile("!m2-evidence")
    SecurityAuditSink securityAuditSink(ObjectProvider<GatewayAuditProperties> provider) {
        GatewayAuditProperties properties = provider.getIfAvailable();
        if (properties == null || !properties.hasDurableSink()) {
            return new BoundedSecurityAuditSink(512);
        }
        // The token is obtained from IAM and renewed when it is refused, rather than held as a string: it is
        // short-lived by design, so a held string is a held expired credential.
        ServiceTokenClient tokens = new ServiceTokenClient(URI.create(properties.getServiceTokenUri()),
                properties.getServiceClientId(), properties.getServiceClientSecret(),
                Duration.ofSeconds(5), Duration.ofSeconds(30));
        return new HttpSecurityAuditSink(URI.create(properties.getIngestUri()), tokens::token, Duration.ofSeconds(5));
    }

    @Bean
    @Profile("m2-evidence")
    SecurityAuditSink runtimeEvidenceSecurityAuditSink() {
        return new RuntimeEvidenceSecurityAuditSink(System.out);
    }
}
