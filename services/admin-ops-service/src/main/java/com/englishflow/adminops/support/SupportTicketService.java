package com.englishflow.adminops.support;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.regex.Pattern;

import com.englishflow.adminops.domain.AdminOpsException;
import com.englishflow.adminops.domain.AdminPep;
import com.englishflow.adminops.domain.AdminPermission;
import com.englishflow.adminops.domain.AdminPrincipal;
import com.englishflow.adminops.domain.AuditEvent;
import com.englishflow.adminops.domain.AuditRecord;
import com.englishflow.adminops.domain.AuditTrail;
import com.englishflow.adminops.domain.CommandAction;
import com.englishflow.adminops.domain.CommandForwardResult;
import com.englishflow.adminops.domain.CommandRequest;
import com.englishflow.adminops.domain.ConfirmationChallenge;
import com.englishflow.adminops.domain.ConfirmationService;
import com.englishflow.adminops.domain.Domain;
import com.englishflow.adminops.domain.DomainCommand;
import com.englishflow.adminops.domain.DomainCommandPort;
import com.englishflow.adminops.domain.IdempotencyLedger;
import com.englishflow.adminops.domain.ReferenceRedactor;
import com.englishflow.adminops.adapter.memory.InMemorySupportTicketStore;

/**
 * Customer-support facts owned by admin-ops. Attachments are references to media-service only;
 * this service never receives a file or persists a free-text body.
 */
public final class SupportTicketService {

    private static final Pattern SAFE_TRACE = Pattern.compile("[A-Za-z0-9._:/-]{1,160}");

    private final Clock clock;
    private final Duration defaultSla;
    private final AdminPep pep;
    private final DomainCommandPort commandPort;
    private final AuditTrail auditTrail;
    private final IdempotencyLedger idempotency;
    private final ConfirmationService confirmations;
    private final MediaObjectAuthorizationPort mediaObjects;
    private final SupportTicketStore ticketStore;

    public SupportTicketService(
            Clock clock,
            Duration defaultSla,
            DomainCommandPort commandPort,
            AuditTrail auditTrail,
            IdempotencyLedger idempotency,
            ConfirmationService confirmations,
            MediaObjectAuthorizationPort mediaObjects) {
        this(clock, defaultSla, commandPort, auditTrail, idempotency, confirmations, mediaObjects,
                new InMemorySupportTicketStore());
    }

    public SupportTicketService(
            Clock clock,
            Duration defaultSla,
            DomainCommandPort commandPort,
            AuditTrail auditTrail,
            IdempotencyLedger idempotency,
            ConfirmationService confirmations,
            MediaObjectAuthorizationPort mediaObjects,
            SupportTicketStore ticketStore) {
        this.clock = clock;
        this.defaultSla = defaultSla;
        this.pep = new AdminPep();
        this.commandPort = commandPort;
        this.auditTrail = auditTrail;
        this.idempotency = idempotency;
        this.confirmations = confirmations;
        this.mediaObjects = mediaObjects;
        this.ticketStore = ticketStore;
    }

    public synchronized SupportTicketResult create(
            AdminPrincipal requester, SupportTicketDraft draft, String idempotencyKey, String traceId) {
        pep.requirePermission(requester, AdminPermission.SUPPORT_TICKET_CREATE);
        requireIdempotencyKey(idempotencyKey);
        String scope = scope(requester, "create");
        String fingerprint = fingerprint(draft);
        IdempotencyLedger.Entry prior = idempotency.find(scope, idempotencyKey).orElse(null);
        if (prior != null) {
            return replay(prior, fingerprint);
        }
        draft.attachments().forEach(mediaObject -> mediaObjects.requireReadable(requester, mediaObject));
        Instant now = clock.instant();
        Ticket ticket = new Ticket(
                // P1-LIVE-006: ticket_id is char(36) and seeds use bare UUIDs;
                // the "ticket_" prefix (43 chars) truncated every insert.
                UUID.randomUUID().toString(),
                requester.tenantId(),
                requester.subjectId(),
                draft,
                now,
                now.plus(defaultSla));
        ticketStore.create(ticket.snapshot());
        String effectiveTrace = safeTrace(traceId);
        AuditRecord audit = auditTrail.append(new AuditEvent(
                ticket.tenantId,
                requester.subjectId(),
                "SUPPORT_TICKET_CREATED",
                ticket.ticketId,
                null,
                effectiveTrace,
                "decision_" + UUID.randomUUID(),
                Map.of("category", ticket.category.name(), "idempotencyKeyHash", ReferenceRedactor.sha256(idempotencyKey)),
                now));
        ticket.lastAuditId = audit.auditId();
        ticketStore.update(ticket.snapshot(), ticket.version);
        SupportTicketResult result = new SupportTicketResult(view(ticket, now), false, audit.auditId());
        idempotency.put(scope, idempotencyKey, fingerprint, result);
        return result;
    }

    public synchronized List<SupportTicketView> list(AdminPrincipal principal, boolean includeAll) {
        if (includeAll) {
            pep.requirePermission(principal, AdminPermission.SUPPORT_TICKET_READ);
        } else {
            pep.requireAuthenticated(principal);
        }
        return ticketStore.list(principal.tenantId(), includeAll, principal.subjectId()).stream()
                .map(Ticket::fromRecord)
                .map(ticket -> view(ticket, clock.instant()))
                .toList();
    }

    public synchronized SupportTicketView get(AdminPrincipal principal, String ticketId) {
        pep.requireAuthenticated(principal);
        Ticket ticket = requireTicket(principal, ticketId);
        pep.requireTenant(principal, ticket.tenantId);
        boolean owner = ticket.requesterSubjectId.equals(principal.subjectId());
        if (!owner) {
            pep.requirePermission(principal, AdminPermission.SUPPORT_TICKET_READ);
        }
        return view(ticket, clock.instant());
    }

    public synchronized ConfirmationChallenge prepareTransition(
            AdminPrincipal operator, String ticketId, SupportAction action) {
        pep.requirePermission(operator, AdminPermission.SUPPORT_TICKET_MANAGE);
        Ticket ticket = requireTicket(operator, ticketId);
        pep.requireTenant(operator, ticket.tenantId);
        if (!action.requiresConfirmation()) {
            throw AdminOpsException.invalid("SUPPORT_CONFIRMATION_NOT_REQUIRED", "transition does not use confirmation flow");
        }
        return confirmations.prepare(operator, action.name(), ticketId);
    }

    public synchronized SupportTicketResult transition(
            AdminPrincipal operator,
            String ticketId,
            SupportAction action,
            String idempotencyKey,
            String confirmationToken,
            String traceId) {
        pep.requirePermission(operator, AdminPermission.SUPPORT_TICKET_MANAGE);
        requireIdempotencyKey(idempotencyKey);
        Ticket ticket = requireTicket(operator, ticketId);
        pep.requireTenant(operator, ticket.tenantId);
        String scope = scope(operator, "transition:" + ticketId);
        String fingerprint = action.name() + "|" + ticketId;
        IdempotencyLedger.Entry prior = idempotency.find(scope, idempotencyKey).orElse(null);
        if (prior != null) {
            return replay(prior, fingerprint);
        }
        String decisionId = action.requiresConfirmation()
                ? confirmations.consume(operator, confirmationToken, action.name(), ticketId)
                : "decision_" + UUID.randomUUID();
        validateTransition(ticket, action);
        Instant now = clock.instant();
        ticket.state = nextState(ticket.state, action);
        ticket.assigneeSubjectId = operator.subjectId();
        ticket.version++;
        String effectiveTrace = safeTrace(traceId);
        DomainCommand notification = new DomainCommand(
                "cmd_" + UUID.randomUUID(),
                Domain.NOTIFICATION,
                CommandAction.SUPPORT_NOTIFY,
                ticket.ticketId,
                ticket.tenantId,
                operator.subjectId(),
                effectiveTrace,
                String.valueOf(ticket.version - 1),
                action.name(),
                Map.of("templateCode", "SUPPORT_TICKET_" + ticket.state.name(), "targetState", ticket.state.name()),
                now);
        CommandForwardResult forwarded = commandPort.forward(notification);
        AuditRecord audit = auditTrail.append(new AuditEvent(
                ticket.tenantId,
                operator.subjectId(),
                "SUPPORT_" + action.name(),
                ticket.ticketId,
                forwarded.commandId(),
                effectiveTrace,
                decisionId,
                Map.of("state", ticket.state.name(), "idempotencyKeyHash", ReferenceRedactor.sha256(idempotencyKey)),
                now));
        ticket.lastAuditId = audit.auditId();
        ticketStore.update(ticket.snapshot(), ticket.version - 1);
        SupportTicketResult result = new SupportTicketResult(view(ticket, now), false, audit.auditId());
        idempotency.put(scope, idempotencyKey, fingerprint, result);
        return result;
    }

    /**
     * Reopen requested by an approved workflow manual recovery. The recovery id is the
     * idempotency key and the scope is tenant-wide (not per operator), so a retry by any
     * executor replays the first outcome instead of failing on the already-reopened state.
     * The two-person rule was enforced in workflow-service; this side still requires
     * SUPPORT_TICKET_MANAGE and writes its own audit row.
     */
    public synchronized SupportTicketResult recoveryReopen(
            AdminPrincipal operator, String ticketId, String recoveryId, String traceId) {
        pep.requirePermission(operator, AdminPermission.SUPPORT_TICKET_MANAGE);
        if (recoveryId == null || recoveryId.isBlank() || recoveryId.length() > 64) {
            throw AdminOpsException.invalid("SUPPORT_RECOVERY_ID_REQUIRED", "recovery id is required");
        }
        String key = "recovery-" + recoveryId;
        Ticket ticket = requireTicket(operator, ticketId);
        pep.requireTenant(operator, ticket.tenantId);
        String scope = operator.tenantId() + ":recovery:reopen:" + ticketId;
        String fingerprint = "RECOVERY_REOPEN|" + ticketId;
        IdempotencyLedger.Entry prior = idempotency.find(scope, key).orElse(null);
        if (prior != null) {
            return replay(prior, fingerprint);
        }
        validateTransition(ticket, SupportAction.REOPEN);
        Instant now = clock.instant();
        ticket.state = nextState(ticket.state, SupportAction.REOPEN);
        ticket.assigneeSubjectId = operator.subjectId();
        ticket.version++;
        String effectiveTrace = safeTrace(traceId);
        AuditRecord audit = auditTrail.append(new AuditEvent(
                ticket.tenantId,
                operator.subjectId(),
                "SUPPORT_RECOVERY_REOPEN",
                ticket.ticketId,
                null,
                effectiveTrace,
                "recovery_" + recoveryId,
                Map.of("state", ticket.state.name(), "recoveryId", recoveryId),
                now));
        ticket.lastAuditId = audit.auditId();
        ticketStore.update(ticket.snapshot(), ticket.version - 1);
        SupportTicketResult result = new SupportTicketResult(view(ticket, now), false, audit.auditId());
        idempotency.put(scope, key, fingerprint, result);
        return result;
    }

    public synchronized List<AuditRecord> auditSnapshot(AdminPrincipal principal) {
        pep.requirePermission(principal, AdminPermission.AUDIT_READ);
        String tenantRef = ReferenceRedactor.tenant(principal.tenantId());
        return auditTrail.snapshot().stream()
                .filter(record -> tenantRef.equals(record.tenantRef()))
                .toList();
    }

    private SupportTicketResult replay(IdempotencyLedger.Entry prior, String fingerprint) {
        if (!fingerprint.equals(prior.fingerprint())) {
            throw AdminOpsException.conflict("SUPPORT_IDEMPOTENCY_KEY_REUSED", "Idempotency-Key was reused for another ticket action");
        }
        if (!(prior.result() instanceof SupportTicketResult priorResult)) {
            throw AdminOpsException.conflict("SUPPORT_IDEMPOTENCY_RESULT_INVALID", "stored ticket result is invalid");
        }
        return new SupportTicketResult(priorResult.ticket(), true, priorResult.auditId());
    }

    private Ticket requireTicket(AdminPrincipal principal, String ticketId) {
        if (ticketId == null || ticketId.isBlank()) {
            throw AdminOpsException.invalid("SUPPORT_TICKET_ID_REQUIRED", "ticket id is required");
        }
        Ticket ticket = ticketStore.find(principal.tenantId(), ticketId).map(Ticket::fromRecord).orElse(null);
        if (ticket == null) {
            throw AdminOpsException.notFound("SUPPORT_TICKET_NOT_FOUND", "ticket is not visible");
        }
        return ticket;
    }

    private static void validateTransition(Ticket ticket, SupportAction action) {
        if (action == SupportAction.ASSIGN) {
            return;
        }
        boolean valid = switch (ticket.state) {
            case OPEN -> action == SupportAction.ACKNOWLEDGE || action == SupportAction.START || action == SupportAction.WAIT_CUSTOMER;
            case ACKNOWLEDGED -> action == SupportAction.START || action == SupportAction.WAIT_CUSTOMER;
            case IN_PROGRESS -> action == SupportAction.WAIT_CUSTOMER || action == SupportAction.RESOLVE;
            case WAITING_CUSTOMER -> action == SupportAction.START || action == SupportAction.RESOLVE;
            case RESOLVED -> action == SupportAction.CLOSE || action == SupportAction.REOPEN;
            case CLOSED -> action == SupportAction.REOPEN;
        };
        if (!valid) {
            throw AdminOpsException.conflict("SUPPORT_INVALID_TRANSITION", "ticket state cannot accept this action");
        }
    }

    private static TicketState nextState(TicketState current, SupportAction action) {
        return switch (action) {
            case ASSIGN -> current;
            case ACKNOWLEDGE -> TicketState.ACKNOWLEDGED;
            case START -> TicketState.IN_PROGRESS;
            case WAIT_CUSTOMER -> TicketState.WAITING_CUSTOMER;
            case RESOLVE -> TicketState.RESOLVED;
            case CLOSE -> TicketState.CLOSED;
            case REOPEN -> TicketState.IN_PROGRESS;
        };
    }

    private static SupportTicketView view(Ticket ticket, Instant now) {
        List<MediaObjectView> attachments = ticket.attachments.stream()
                .map(media -> new MediaObjectView(
                        ReferenceRedactor.media(media.objectRef()),
                        media.objectVersion(),
                        media.purposeCode(),
                        media.contentType(),
                        media.sizeBytes()))
                .toList();
        return new SupportTicketView(
                ticket.ticketId,
                ReferenceRedactor.subject(ticket.requesterSubjectId),
                ticket.category,
                ticket.resourceRef,
                ticket.state,
                ticket.priority,
                SlaStatus.calculate(ticket.state, ticket.slaDueAt, now),
                ticket.slaDueAt,
                ticket.assigneeSubjectId == null ? null : ReferenceRedactor.subject(ticket.assigneeSubjectId),
                ticket.descriptionFingerprint,
                attachments,
                ticket.lastAuditId,
                ticket.version);
    }

    private static String fingerprint(SupportTicketDraft draft) {
        return draft.category() + "|" + draft.resourceRef() + "|" + draft.descriptionFingerprint() + "|"
                + draft.priority() + "|" + draft.attachments();
    }

    private static String scope(AdminPrincipal principal, String operation) {
        return principal.tenantId() + ":" + principal.subjectId() + ":" + operation;
    }

    private static String safeTrace(String traceId) {
        String normalized = traceId == null || traceId.isBlank()
                ? "trace_support_" + UUID.randomUUID() : traceId.trim();
        if (!SAFE_TRACE.matcher(normalized).matches()) {
            throw AdminOpsException.invalid("SUPPORT_TRACE_INVALID", "trace id must be a bounded safe token");
        }
        return normalized;
    }

    private static void requireIdempotencyKey(String value) {
        if (value == null || value.trim().length() < 8 || value.trim().length() > 160) {
            throw AdminOpsException.invalid("SUPPORT_IDEMPOTENCY_KEY_REQUIRED", "Idempotency-Key is required");
        }
    }

    private static final class Ticket {
        final String ticketId;
        final String tenantId;
        final String requesterSubjectId;
        final TicketCategory category;
        final String resourceRef;
        final String descriptionFingerprint;
        final TicketPriority priority;
        final List<MediaObjectRef> attachments;
        final Instant createdAt;
        final Instant slaDueAt;
        TicketState state = TicketState.OPEN;
        String assigneeSubjectId;
        String lastAuditId;
        long version = 1;

        Ticket(String ticketId, String tenantId, String requesterSubjectId, SupportTicketDraft draft,
                Instant createdAt, Instant slaDueAt) {
            this.ticketId = ticketId;
            this.tenantId = tenantId;
            this.requesterSubjectId = requesterSubjectId;
            this.category = draft.category();
            this.resourceRef = draft.resourceRef();
            this.descriptionFingerprint = draft.descriptionFingerprint();
            this.priority = draft.priority();
            this.attachments = List.copyOf(draft.attachments());
            this.createdAt = createdAt;
            this.slaDueAt = slaDueAt;
        }

        SupportTicketRecord snapshot() {
            return new SupportTicketRecord(ticketId, tenantId, requesterSubjectId, category, resourceRef,
                    descriptionFingerprint, priority, attachments, createdAt, slaDueAt, state,
                    assigneeSubjectId, lastAuditId, version);
        }

        static Ticket fromRecord(SupportTicketRecord record) {
            Ticket ticket = new Ticket(record.ticketId(), record.tenantId(), record.requesterSubjectId(),
                    new SupportTicketDraft(record.category(), record.resourceRef(), record.descriptionFingerprint(),
                            record.priority(), record.attachments()), record.createdAt(), record.slaDueAt());
            ticket.state = record.state();
            ticket.assigneeSubjectId = record.assigneeSubjectId();
            ticket.lastAuditId = record.lastAuditId();
            ticket.version = record.version();
            return ticket;
        }
    }
}
