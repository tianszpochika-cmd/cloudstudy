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

class AdminSupportCommandOwnerTest {

    @Test
    void genericSupportCommandsCannotClaimTicketResolutionOrClosure() {
        Clock clock = Clock.fixed(Instant.parse("2026-09-23T00:00:00Z"), ZoneOffset.UTC);
        InMemoryAdminProjection projections = new InMemoryAdminProjection().seed(new ProjectionRecord(
                Domain.SUPPORT, "ticket-1", "platform", "learner-1", null,
                "v1", "OPEN", Map.of("ticketState", "OPEN")));
        InMemoryDomainCommandPort forwarded = new InMemoryDomainCommandPort();
        InMemoryAuditTrail audit = new InMemoryAuditTrail();
        AdminOpsService service = new AdminOpsService(clock, projections, forwarded, audit,
                new InMemoryIdempotencyLedger(), new ConfirmationService(clock, Duration.ofMinutes(5)));
        AdminPrincipal operator = AdminPrincipal.user("support-1", "platform",
                AdminPermission.SUPPORT_TICKET_MANAGE);

        for (CommandAction action : new CommandAction[] {
                CommandAction.SUPPORT_RESOLVE, CommandAction.SUPPORT_CLOSE }) {
            CommandRequest request = new CommandRequest(Domain.SUPPORT, action,
                    "ticket-1", "v1", "ADMIN_SUPPORT", Map.of());
            assertUnavailable(() -> service.prepareCommand(operator, request));
            assertUnavailable(() -> service.executeCommand(operator, request,
                    "support-command-key-1", null, "trace-support-1"));
        }
        assertThat(forwarded.forwarded()).isEmpty();
        assertThat(audit.snapshot()).isEmpty();
    }

    private static void assertUnavailable(Runnable action) {
        assertThatThrownBy(action::run).isInstanceOfSatisfying(AdminOpsException.class, error -> {
            assertThat(error.code()).isEqualTo("ADMIN_SUPPORT_COMMAND_UNAVAILABLE");
            assertThat(error.status()).isEqualTo(503);
            assertThat(error.retryable()).isFalse();
        });
    }
}
