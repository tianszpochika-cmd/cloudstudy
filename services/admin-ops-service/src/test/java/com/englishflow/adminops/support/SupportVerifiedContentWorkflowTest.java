package com.englishflow.adminops.support;

import com.englishflow.adminops.adapter.memory.InMemoryAuditTrail;
import com.englishflow.adminops.adapter.memory.InMemoryDomainCommandPort;
import com.englishflow.adminops.adapter.memory.InMemoryIdempotencyLedger;
import com.englishflow.adminops.adapter.memory.InMemoryMediaObjectAuthorization;
import com.englishflow.adminops.adapter.memory.InMemorySupportTicketStore;
import com.englishflow.adminops.domain.AdminPermission;
import com.englishflow.adminops.domain.AdminPrincipal;
import com.englishflow.adminops.domain.ConfirmationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Verified attachment refs unlock staff transitions. */
class SupportVerifiedContentWorkflowTest {

    private static final Clock CLOCK = Clock.fixed(Instant.parse("2026-10-13T00:00:00Z"), ZoneOffset.UTC);
    private SupportTicketService service;
    private InMemoryMediaObjectAuthorization media;

    @BeforeEach
    void setUp() {
        media = new InMemoryMediaObjectAuthorization();
        service = new SupportTicketService(CLOCK, Duration.ofHours(24), new InMemoryDomainCommandPort(),
                new InMemoryAuditTrail(), new InMemoryIdempotencyLedger(),
                new ConfirmationService(CLOCK, Duration.ofMinutes(5)), media, new InMemorySupportTicketStore());
    }

    private static AdminPrincipal staff() {
        return AdminPrincipal.user("support-1", "platform",
                AdminPermission.SUPPORT_TICKET_CREATE, AdminPermission.SUPPORT_TICKET_READ,
                AdminPermission.SUPPORT_TICKET_MANAGE);
    }

    private static MediaObjectRef attachment() {
        return new MediaObjectRef("obj:support-issue-1", "v1", "SUPPORT_ISSUE", "text/plain", 128);
    }

    @Test
    void verifiedAttachmentCreateThenStartAndResolve() {
        MediaObjectRef ref = attachment();
        media.grant("platform", "support-1", ref);
        SupportTicketDraft draft = new SupportTicketDraft(TicketCategory.TECHNICAL, "lesson-1",
                "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
                TicketPriority.NORMAL, List.of(ref));
        SupportTicketResult created = service.create(staff(), draft, "support-verified-key-0001", "trace-1");
        assertThat(created.ticket().attachments()).hasSize(1);
        assertThat(created.ticket().state()).isEqualTo(TicketState.OPEN);

        SupportTicketResult started = service.transition(staff(), created.ticket().ticketId(),
                SupportAction.START, "support-verified-key-0002", null, "trace-2");
        assertThat(started.ticket().state()).isEqualTo(TicketState.IN_PROGRESS);

        var challenge = service.prepareTransition(staff(), created.ticket().ticketId(), SupportAction.RESOLVE);
        SupportTicketResult resolved = service.transition(staff(), created.ticket().ticketId(),
                SupportAction.RESOLVE, "support-verified-key-0003", challenge.token(), "trace-3");
        assertThat(resolved.ticket().state()).isEqualTo(TicketState.RESOLVED);
    }

    @Test
    void attachmentMustBeReadableInCallerScope() {
        MediaObjectRef ref = attachment();
        SupportTicketDraft draft = new SupportTicketDraft(TicketCategory.TECHNICAL, "lesson-1",
                "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
                TicketPriority.NORMAL, List.of(ref));
        assertThatThrownBy(() -> service.create(staff(), draft, "support-verified-key-0004", "trace-4"))
                .hasMessageContaining("media reference");
    }
}
