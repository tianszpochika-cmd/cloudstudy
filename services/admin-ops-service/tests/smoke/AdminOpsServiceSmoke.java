package com.englishflow.adminops.smoke;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;
import java.util.Set;

import com.englishflow.adminops.adapter.memory.InMemoryAdminProjection;
import com.englishflow.adminops.adapter.memory.InMemoryAuditTrail;
import com.englishflow.adminops.adapter.memory.InMemoryDomainCommandPort;
import com.englishflow.adminops.adapter.memory.InMemoryIdempotencyLedger;
import com.englishflow.adminops.adapter.memory.InMemoryMediaObjectAuthorization;
import com.englishflow.adminops.application.AdminOpsService;
import com.englishflow.adminops.domain.AdminOpsException;
import com.englishflow.adminops.domain.AuditEvent;
import com.englishflow.adminops.domain.AdminPermission;
import com.englishflow.adminops.domain.AdminPrincipal;
import com.englishflow.adminops.domain.CommandAction;
import com.englishflow.adminops.domain.CommandRequest;
import com.englishflow.adminops.domain.ConfirmationService;
import com.englishflow.adminops.domain.Domain;
import com.englishflow.adminops.domain.ProjectionQuery;
import com.englishflow.adminops.domain.ProjectionRecord;
import com.englishflow.adminops.domain.ReferenceRedactor;
import com.englishflow.adminops.support.MediaObjectRef;
import com.englishflow.adminops.support.SlaStatus;
import com.englishflow.adminops.support.SupportAction;
import com.englishflow.adminops.support.SupportTicketDraft;
import com.englishflow.adminops.support.SupportTicketResult;
import com.englishflow.adminops.support.SupportTicketService;
import com.englishflow.adminops.support.SupportTicketView;
import com.englishflow.adminops.support.TicketCategory;
import com.englishflow.adminops.support.TicketPriority;

/** Pure Java smoke for B13-ADM-003 and B13-SUP-005. No Spring, database or network required. */
public final class AdminOpsServiceSmoke {

    private static final String TENANT_A = "tenant-a";
    private static final String TENANT_B = "tenant-b";
    private static final String FINGERPRINT = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

    public static void main(String[] args) {
        MutableClock clock = new MutableClock(Instant.parse("2026-01-01T00:00:00Z"));
        InMemoryAdminProjection projections = new InMemoryAdminProjection()
                .seed(new ProjectionRecord(
                        Domain.CONTENT, "content-v2-001", TENANT_A, "learner-author", "learner-author",
                        "v2", "IN_REVIEW", Map.of("contentType", "QUESTION", "rightsState", "CLEARED")))
                .seed(new ProjectionRecord(
                        Domain.COMMERCE, "order-v2-001", TENANT_A, "learner-42", null,
                        "v1", "PAID", Map.of("entitlementState", "ACTIVE")))
                .seed(new ProjectionRecord(
                        Domain.SUPPORT, "audit-export-001", TENANT_A, "system", null,
                        "v1", "READY", Map.of("exportState", "READY")));
        InMemoryDomainCommandPort commandPort = new InMemoryDomainCommandPort();
        InMemoryAuditTrail auditTrail = new InMemoryAuditTrail();
        InMemoryIdempotencyLedger idempotency = new InMemoryIdempotencyLedger();
        MediaObjectRef screenshot = new MediaObjectRef("media-object-001", "v1", "SCREENSHOT", "image/png", 1024);
        InMemoryMediaObjectAuthorization mediaAuthorization = new InMemoryMediaObjectAuthorization()
                .grant(TENANT_A, "learner-42", screenshot);
        ConfirmationService confirmations = new ConfirmationService(clock, Duration.ofMinutes(5));
        AdminOpsService admin = new AdminOpsService(
                clock, projections, commandPort, auditTrail, idempotency, confirmations);
        SupportTicketService support = new SupportTicketService(
                clock, Duration.ofHours(48), commandPort, auditTrail, idempotency, confirmations, mediaAuthorization);

        AdminPrincipal firstReviewer = AdminPrincipal.user(
                "reviewer-l1", TENANT_A,
                AdminPermission.PROJECTION_READ, AdminPermission.CONTENT_REVIEW_L1);
        AdminPrincipal finalReviewer = AdminPrincipal.user(
                "reviewer-l2", TENANT_A,
                AdminPermission.PROJECTION_READ, AdminPermission.CONTENT_REVIEW_L2, AdminPermission.CONTENT_PUBLISH);
        AdminPrincipal author = AdminPrincipal.user(
                "learner-author", TENANT_A,
                AdminPermission.PROJECTION_READ, AdminPermission.CONTENT_REVIEW_L1);
        AdminPrincipal otherTenant = AdminPrincipal.user(
                "reviewer-other-tenant", TENANT_B,
                AdminPermission.PROJECTION_READ, AdminPermission.CONTENT_REVIEW_L1);

        expectCode(
                () -> admin.query(null, new ProjectionQuery(Domain.CONTENT, null, 10)),
                "ADMIN_UNAUTHENTICATED");
        require(admin.query(firstReviewer, new ProjectionQuery(Domain.CONTENT, null, 10)).size() == 1,
                "tenant-scoped read projection should be visible");
        require(admin.query(otherTenant, new ProjectionQuery(Domain.CONTENT, null, 10)).isEmpty(),
                "cross-tenant projection must not be returned");
        expectCode(
                () -> admin.prepareCommand(otherTenant, contentCommand(CommandAction.CONTENT_REVIEW_FIRST)),
                "ADMIN_RESOURCE_NOT_FOUND");
        expectCode(
                () -> admin.prepareCommand(author, contentCommand(CommandAction.CONTENT_REVIEW_FIRST)),
                "ADMIN_AUTHOR_OPERATOR_CONFLICT");
        CommandRequest finalReview = contentCommand(CommandAction.CONTENT_REVIEW_FINAL);
        expectCode(
                () -> admin.prepareCommand(finalReviewer, finalReview),
                "ADMIN_APPROVAL_SEQUENCE_INVALID");

        CommandRequest firstReview = contentCommand(CommandAction.CONTENT_REVIEW_FIRST);
        String firstToken = admin.prepareCommand(firstReviewer, firstReview).token();
        var firstResult = admin.executeCommand(firstReviewer, firstReview, "adm-first-001", firstToken, "trace-001");
        var firstReplay = admin.executeCommand(firstReviewer, firstReview, "adm-first-001", "already-used", "trace-001");
        require(firstReplay.replayed(), "same command key should replay without a second forward");
        require(commandPort.forwarded().size() == 1, "idempotent command must forward once");

        expectCode(
                () -> admin.prepareCommand(firstReviewer, contentCommand(CommandAction.CONTENT_REVIEW_FINAL)),
                "ADMIN_PERMISSION_DENIED");
        String finalToken = admin.prepareCommand(finalReviewer, finalReview).token();
        var finalResult = admin.executeCommand(finalReviewer, finalReview, "adm-final-001", finalToken, "trace-002");
        require(!finalResult.replayed(), "final review should execute once");
        CommandRequest publish = contentCommand(CommandAction.CONTENT_PUBLISH);
        String publishToken = admin.prepareCommand(finalReviewer, publish).token();
        admin.executeCommand(finalReviewer, publish, "adm-publish-001", publishToken, "trace-003");
        expectCode(
                () -> admin.executeCommand(
                        finalReviewer,
                        contentCommand(CommandAction.CONTENT_PUBLISH),
                        "adm-publish-001-different",
                        null,
                        "trace-004"),
                "ADMIN_CONFIRMATION_INVALID");
        require(commandPort.forwarded().size() == 3, "review/publish commands should remain outbound seams");
        require(firstResult.auditId() != null && finalResult.auditId() != null, "commands must link immutable audit IDs");

        AdminPrincipal requester = AdminPrincipal.user(
                "learner-42", TENANT_A, AdminPermission.SUPPORT_TICKET_CREATE);
        SupportTicketDraft draft = new SupportTicketDraft(
                TicketCategory.CONTENT_CORRECTION,
                "content-v2-001",
                FINGERPRINT,
                TicketPriority.HIGH,
                List.of(screenshot));
        SupportTicketResult created = support.create(requester, draft, "sup-create-001", "trace-sup-001");
        SupportTicketView createdView = created.ticket();
        require(!createdView.requesterRef().contains("learner-42"), "support view must redact requester identity");
        require(!createdView.descriptionFingerprint().equals("raw free text"), "support view must not contain raw text");
        require(!createdView.attachments().get(0).mediaObjectRef().equals("media-object-001"),
                "media object refs should be opaque in support views");
        require(createdView.attachments().get(0).sizeBytes() == 1024, "media metadata may retain bounded size");
        var ticketReplay = support.create(requester, draft, "sup-create-001", "trace-sup-001");
        require(ticketReplay.replayed(), "ticket create must be idempotent");
        SupportTicketDraft unauthorizedAttachment = new SupportTicketDraft(
                TicketCategory.CONTENT_CORRECTION,
                "content-v2-001",
                FINGERPRINT,
                TicketPriority.HIGH,
                List.of(new MediaObjectRef("media-object-not-granted", "v1", "SCREENSHOT", "image/png", 256)));
        expectCode(
                () -> support.create(requester, unauthorizedAttachment, "sup-attachment-denied-001", "trace-sup-denied"),
                "SUPPORT_ATTACHMENT_FORBIDDEN");

        expectCode(
                () -> SupportTicketDraft.fromUntrusted(Map.of(
                        "category", "CONTENT_CORRECTION",
                        "resourceRef", "content-v2-001",
                        "description", "please change this raw customer text",
                        "priority", "HIGH")),
                "SUPPORT_RAW_TEXT_REJECTED");
        expectCode(
                () -> support.get(
                        AdminPrincipal.user("learner-other", TENANT_A),
                        createdView.ticketId()),
                "ADMIN_PERMISSION_DENIED");

        AdminPrincipal supportOperator = AdminPrincipal.user(
                "support-agent", TENANT_A,
                AdminPermission.SUPPORT_TICKET_READ, AdminPermission.SUPPORT_TICKET_MANAGE);
        support.transition(supportOperator, createdView.ticketId(), SupportAction.START,
                "sup-start-001", null, "trace-sup-002");
        var resolveChallenge = support.prepareTransition(
                supportOperator, createdView.ticketId(), SupportAction.RESOLVE);
        var resolved = support.transition(
                supportOperator,
                createdView.ticketId(),
                SupportAction.RESOLVE,
                "sup-resolve-001",
                resolveChallenge.token(),
                "trace-sup-003");
        require(resolved.ticket().state().name().equals("RESOLVED"), "support resolve should update owned ticket state");
        require(resolved.ticket().slaStatus() == SlaStatus.RESOLVED, "resolved ticket should close its SLA state");
        var resolvedReplay = support.transition(
                supportOperator,
                createdView.ticketId(),
                SupportAction.RESOLVE,
                "sup-resolve-001",
                "already-used",
                "trace-sup-003");
        require(resolvedReplay.replayed(), "support transition must replay idempotently");
        require(commandPort.forwarded().stream().anyMatch(command -> command.domain() == Domain.NOTIFICATION),
                "support transitions must use a notification command seam");

        auditTrail.append(new AuditEvent(
                TENANT_B, "other-operator", "OTHER_TENANT_OPERATION", "other-resource", null,
                "trace-other", "decision-other", Map.of(), clock.instant()));
        AdminPrincipal auditReader = AdminPrincipal.user(
                "auditor", TENANT_A, AdminPermission.AUDIT_EXPORT);
        require(admin.audit(auditReader).stream()
                        .allMatch(record -> ReferenceRedactor.tenant(TENANT_A).equals(record.tenantRef())),
                "audit export must remain tenant-scoped");
        require(auditTrail.snapshot().stream().allMatch(record -> record.integrityMatches()),
                "audit chain records must remain integrity-valid");
        try {
            auditTrail.snapshot().clear();
            throw new AssertionError("audit snapshot must be immutable");
        } catch (UnsupportedOperationException expected) {
            // expected
        }
        clock.advance(Duration.ofHours(49));
        SupportTicketView resolvedView = support.get(supportOperator, createdView.ticketId());
        require(resolvedView.slaStatus() == SlaStatus.RESOLVED, "terminal tickets remain resolved after clock advance");

        System.out.println("admin-ops-service B13 ADM-003/SUP-005 pure Java smoke: PASS");
    }

    private static CommandRequest contentCommand(CommandAction action) {
        return new CommandRequest(
                Domain.CONTENT,
                action,
                "content-v2-001",
                "v2",
                "CONTENT_REVIEW_FLOW",
                Map.of("decisionCode", "APPROVE"));
    }

    private static void expectCode(Runnable operation, String expectedCode) {
        try {
            operation.run();
            throw new AssertionError("expected " + expectedCode);
        } catch (AdminOpsException exception) {
            require(expectedCode.equals(exception.code()),
                    "expected " + expectedCode + " but got " + exception.code());
        }
    }

    private static void require(boolean condition, String message) {
        if (!condition) {
            throw new AssertionError(message);
        }
    }

    private static final class MutableClock extends Clock {
        private Instant now;

        MutableClock(Instant now) {
            this.now = now;
        }

        void advance(Duration duration) {
            now = now.plus(duration);
        }

        @Override
        public ZoneId getZone() {
            return ZoneId.of("UTC");
        }

        @Override
        public Clock withZone(ZoneId zone) {
            return this;
        }

        @Override
        public Instant instant() {
            return now;
        }
    }
}
