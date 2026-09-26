package com.englishflow.adminops.application;

import com.englishflow.adminops.adapter.memory.InMemoryAdminProjection;
import com.englishflow.adminops.adapter.memory.InMemoryAuditTrail;
import com.englishflow.adminops.adapter.memory.InMemoryDomainCommandPort;
import com.englishflow.adminops.adapter.memory.InMemoryIdempotencyLedger;
import com.englishflow.adminops.domain.AdminOpsException;
import com.englishflow.adminops.domain.AdminPermission;
import com.englishflow.adminops.domain.AdminPrincipal;
import com.englishflow.adminops.domain.CommandAction;
import com.englishflow.adminops.domain.CommandRequest;
import com.englishflow.adminops.domain.ConfirmationService;
import com.englishflow.adminops.domain.Domain;
import com.englishflow.adminops.domain.ProjectionRecord;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Map;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class AdminAuditExportFailClosedTest {

    @Test
    void commandDoesNotAcknowledgeAnExportWhenAuditOwnerIsNotConnected() {
        Clock clock = Clock.fixed(Instant.parse("2026-09-23T00:00:00Z"), ZoneOffset.UTC);
        InMemoryAdminProjection projections = new InMemoryAdminProjection().seed(new ProjectionRecord(
                Domain.SUPPORT, "audit-export", "platform", "system", null,
                "v1", "READY", Map.of("exportState", "READY")));
        InMemoryDomainCommandPort forwarded = new InMemoryDomainCommandPort();
        InMemoryAuditTrail audit = new InMemoryAuditTrail();
        AdminOpsService service = new AdminOpsService(clock, projections, forwarded, audit,
                new InMemoryIdempotencyLedger(), new ConfirmationService(clock, Duration.ofMinutes(5)));
        AdminPrincipal auditor = AdminPrincipal.user("auditor-1", "platform", AdminPermission.AUDIT_EXPORT);
        AdminPrincipal reader = AdminPrincipal.user("auditor-read-1", "platform", AdminPermission.AUDIT_READ);
        CommandRequest request = new CommandRequest(Domain.SUPPORT, CommandAction.AUDIT_EXPORT,
                "audit-export", null, "ADMIN_AUDIT_EXPORT", Map.of());

        assertThat(service.audit(reader)).isEmpty();
        assertThatThrownBy(() -> service.audit(auditor)).isInstanceOfSatisfying(
                AdminOpsException.class, error -> assertThat(error.status()).isEqualTo(403));
        assertThatThrownBy(() -> service.prepareCommand(reader, request)).isInstanceOfSatisfying(
                AdminOpsException.class, error -> assertThat(error.status()).isEqualTo(403));
        assertUnavailable(() -> service.prepareCommand(auditor, request));
        assertUnavailable(() -> service.executeCommand(auditor, request,
                "audit-export-key-1", null, "trace-audit-export-1"));
        assertThat(forwarded.forwarded()).isEmpty();
        assertThat(audit.snapshot()).isEmpty();
    }

    private static void assertUnavailable(Runnable action) {
        assertThatThrownBy(action::run).isInstanceOfSatisfying(AdminOpsException.class, error -> {
            assertThat(error.code()).isEqualTo("ADMIN_AUDIT_EXPORT_UNAVAILABLE");
            assertThat(error.status()).isEqualTo(503);
            assertThat(error.retryable()).isFalse();
        });
    }
}
