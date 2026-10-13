package com.englishflow.adminops.web;

import com.englishflow.adminops.adapter.memory.InMemoryAuditTrail;
import com.englishflow.adminops.adapter.memory.InMemoryDomainCommandPort;
import com.englishflow.adminops.adapter.memory.InMemoryIdempotencyLedger;
import com.englishflow.adminops.adapter.memory.InMemoryMediaObjectAuthorization;
import com.englishflow.adminops.adapter.memory.InMemorySupportTicketStore;
import com.englishflow.adminops.domain.AdminPermission;
import com.englishflow.adminops.domain.AdminPrincipal;
import com.englishflow.adminops.domain.ConfirmationService;
import com.englishflow.adminops.security.AdminOpsAuthenticationToken;
import com.englishflow.adminops.support.MediaObjectRef;
import com.englishflow.adminops.support.SupportTicketDraft;
import com.englishflow.adminops.support.SupportTicketService;
import com.englishflow.adminops.support.TicketCategory;
import com.englishflow.adminops.support.TicketPriority;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.time.Clock;
import java.time.Duration;
import java.util.List;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * HTTP-level check: the admin-web client sends the action as JSON.stringify("START"),
 * i.e. the body {@code "START"}; it must bind to {@link com.englishflow.adminops.support.SupportAction}.
 */
class SupportTransitionEnumDeserializationTest {

    private MockMvc mvc;
    private String ticketId;

    @BeforeEach
    void setUp() {
        Clock clock = Clock.systemUTC();
        InMemoryMediaObjectAuthorization media = new InMemoryMediaObjectAuthorization();
        SupportTicketService service = new SupportTicketService(clock, Duration.ofHours(24),
                new InMemoryDomainCommandPort(), new InMemoryAuditTrail(), new InMemoryIdempotencyLedger(),
                new ConfirmationService(clock, Duration.ofMinutes(5)), media, new InMemorySupportTicketStore());
        AdminPrincipal ops = AdminPrincipal.user("ops-a", "platform", AdminPermission.SUPPORT_TICKET_CREATE,
                AdminPermission.SUPPORT_TICKET_READ, AdminPermission.SUPPORT_TICKET_MANAGE);
        SecurityContextHolder.getContext().setAuthentication(new AdminOpsAuthenticationToken(ops, "jwt", List.of()));
        MediaObjectRef ref = new MediaObjectRef("obj:e-1", "v1", "SUPPORT_ISSUE", "text/plain", 32);
        media.grant("platform", "ops-a", ref);
        ticketId = service.create(ops, new SupportTicketDraft(TicketCategory.TECHNICAL, "r", "b".repeat(64),
                TicketPriority.NORMAL, List.of(ref)), "enum-test-key-0001", "t").ticket().ticketId();
        mvc = MockMvcBuilders.standaloneSetup(new SupportController(service)).build();
    }

    @AfterEach
    void clear() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void jsonStringActionBindsToEnum() throws Exception {
        mvc.perform(post("/internal/v1/admin-ops/tickets/" + ticketId + "/transitions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("Idempotency-Key", "enum-test-key-0002")
                        .content("\"START\""))
                .andExpect(status().isOk())
                .andExpect(content().string(org.hamcrest.Matchers.containsString("IN_PROGRESS")));
    }

    @Test
    void unknownActionIsRejectedNotSilentlyAccepted() throws Exception {
        mvc.perform(post("/internal/v1/admin-ops/tickets/" + ticketId + "/transitions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("Idempotency-Key", "enum-test-key-0003")
                        .content("\"DELETE_EVERYTHING\""))
                .andExpect(status().is4xxClientError());
    }

    @Test
    void recoveryReopenEndpointRequiresRecoveryKey() {
        // standalone MockMvc has no exception advice; the domain refusal surfaces as the cause
        jakarta.servlet.ServletException error = org.junit.jupiter.api.Assertions.assertThrows(
                jakarta.servlet.ServletException.class,
                () -> mvc.perform(post("/internal/v1/admin-ops/tickets/" + ticketId + "/recovery-reopen")
                        .header("Idempotency-Key", "not-a-recovery-key")));
        org.assertj.core.api.Assertions.assertThat(error.getCause())
                .isInstanceOfSatisfying(com.englishflow.adminops.domain.AdminOpsException.class,
                        e -> org.assertj.core.api.Assertions.assertThat(e.code()).isEqualTo("SUPPORT_RECOVERY_ID_REQUIRED"));
    }
}
