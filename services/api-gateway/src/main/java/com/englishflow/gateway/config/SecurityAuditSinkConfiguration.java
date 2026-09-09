package com.englishflow.gateway.config;

import com.englishflow.gateway.support.BoundedSecurityAuditSink;
import com.englishflow.gateway.support.RuntimeEvidenceSecurityAuditSink;
import com.englishflow.gateway.support.SecurityAuditSink;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;

/**
 * Keeps the ordinary bounded, non-durable audit sink as the default and makes
 * the stdout evidence projection an explicit opt-in.  Neither bean is a
 * durable audit-service adapter.
 */
@Configuration(proxyBeanMethods = false)
public class SecurityAuditSinkConfiguration {

    @Bean
    @Profile("!m2-evidence")
    SecurityAuditSink boundedSecurityAuditSink() {
        return new BoundedSecurityAuditSink(512);
    }

    @Bean
    @Profile("m2-evidence")
    SecurityAuditSink runtimeEvidenceSecurityAuditSink() {
        return new RuntimeEvidenceSecurityAuditSink(System.out);
    }
}
