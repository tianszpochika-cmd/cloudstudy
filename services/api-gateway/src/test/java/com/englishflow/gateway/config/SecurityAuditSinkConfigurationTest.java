package com.englishflow.gateway.config;

import com.englishflow.gateway.support.BoundedSecurityAuditSink;
import com.englishflow.gateway.support.RuntimeEvidenceSecurityAuditSink;
import com.englishflow.gateway.support.SecurityAuditRecord;
import com.englishflow.gateway.support.SecurityAuditSink;
import org.junit.jupiter.api.Test;
import org.springframework.context.annotation.AnnotationConfigApplicationContext;

import java.time.Instant;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;

class SecurityAuditSinkConfigurationTest {

    @Test
    void defaultProfileKeepsTheBoundedSink() {
        try (AnnotationConfigApplicationContext context = context()) {
            BoundedSecurityAuditSink sink = assertInstanceOf(
                    BoundedSecurityAuditSink.class, context.getBean(SecurityAuditSink.class));
            var record = new SecurityAuditRecord(
                    Instant.EPOCH, "gateway-health", "GET", 200, "request", "trace",
                    "", "", "NO_BROWSER_PROFILE", "ALLOW", "completed", "LT_50_MS");
            for (int index = 0; index < 513; index++) sink.record(record);
            assertEquals(512, sink.snapshot().size());
        }
    }

    @Test
    void m2EvidenceProfileIsTheOnlyWayToSelectStdoutEvidence() {
        try (AnnotationConfigApplicationContext context = context("m2-evidence", "local-real")) {
            assertInstanceOf(RuntimeEvidenceSecurityAuditSink.class, context.getBean(SecurityAuditSink.class));
        }
    }

    @Test
    void unrelatedProfilesDoNotSelectStdoutEvidence() {
        try (AnnotationConfigApplicationContext context = context("local-real")) {
            assertInstanceOf(BoundedSecurityAuditSink.class, context.getBean(SecurityAuditSink.class));
        }
    }

    private static AnnotationConfigApplicationContext context(String... profiles) {
        AnnotationConfigApplicationContext context = new AnnotationConfigApplicationContext();
        context.getEnvironment().setActiveProfiles(profiles);
        context.register(SecurityAuditSinkConfiguration.class);
        context.refresh();
        return context;
    }
}
