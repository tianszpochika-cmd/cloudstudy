package com.englishflow.adminops.application;

import java.time.Clock;
import java.time.Instant;
import java.util.HashMap;
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
import com.englishflow.adminops.domain.CommandResult;
import com.englishflow.adminops.domain.ConfirmationChallenge;
import com.englishflow.adminops.domain.ConfirmationService;
import com.englishflow.adminops.domain.DomainCommand;
import com.englishflow.adminops.domain.DomainCommandPort;
import com.englishflow.adminops.domain.IdempotencyLedger;
import com.englishflow.adminops.domain.ProjectionQuery;
import com.englishflow.adminops.domain.ProjectionRecord;
import com.englishflow.adminops.domain.ProjectionView;
import com.englishflow.adminops.domain.ReferenceRedactor;

/**
 * B13-ADM-003 application boundary. It reads admin projections and forwards commands, but it
 * cannot mutate commerce/content/learner facts because no such port exists here.
 */
public final class AdminOpsService {

    private static final Pattern SAFE_TRACE = Pattern.compile("[A-Za-z0-9._:/-]{1,160}");

    private final Clock clock;
    private final AdminProjectionPortAdapter projections;
    private final DomainCommandPort commandPort;
    private final AuditTrail auditTrail;
    private final IdempotencyLedger idempotency;
    private final ConfirmationService confirmations;
    private final AdminPep pep = new AdminPep();
    /**
     * Admin-owned workflow state only. It is deliberately not a copy of content-service facts;
     * the production adapter must persist this as an approval/workflow projection or event
     * stream, while the local wiring keeps it in memory for the code-layer smoke.
     */
    private final Map<String, ReviewState> reviewStates = new HashMap<>();

    public AdminOpsService(
            Clock clock,
            com.englishflow.adminops.domain.AdminProjectionPort projections,
            DomainCommandPort commandPort,
            AuditTrail auditTrail,
            IdempotencyLedger idempotency,
            ConfirmationService confirmations) {
        this.clock = clock;
        this.projections = new AdminProjectionPortAdapter(projections);
        this.commandPort = commandPort;
        this.auditTrail = auditTrail;
        this.idempotency = idempotency;
        this.confirmations = confirmations;
    }

    public List<ProjectionView> query(AdminPrincipal principal, ProjectionQuery query) {
        pep.requirePermission(principal, AdminPermission.PROJECTION_READ);
        return projections.query(principal, query).stream()
                .map(record -> new ProjectionView(
                        record.domain(),
                        record.resourceRef(),
                        ReferenceRedactor.subject(record.ownerSubjectId()),
                        record.version(),
                        record.status(),
                        record.safeFields()))
                .toList();
    }

    public synchronized ConfirmationChallenge prepareCommand(AdminPrincipal principal, CommandRequest request) {
        pep.requirePermission(principal, request.action().permission());
        if (!request.action().requiresConfirmation()) {
            throw AdminOpsException.invalid(
                    "ADMIN_CONFIRMATION_NOT_REQUIRED", "this command does not use second confirmation");
        }
        ProjectionRecord projection = authorize(principal, request);
        checkReviewPreconditions(principal, request, projection);
        return confirmations.prepare(principal, request.action().name(), request.resourceRef());
    }

    public synchronized CommandResult executeCommand(
            AdminPrincipal principal,
            CommandRequest request,
            String idempotencyKey,
            String confirmationToken,
            String traceId) {
        pep.requirePermission(principal, request.action().permission());
        requireIdempotencyKey(idempotencyKey);
        String scope = scope(principal, request);
        String fingerprint = request.fingerprint();
        IdempotencyLedger.Entry prior = idempotency.find(scope, idempotencyKey).orElse(null);
        if (prior != null) {
            return replay(prior, fingerprint);
        }
        ProjectionRecord projection = authorize(principal, request);
        checkReviewPreconditions(principal, request, projection);
        if (request.expectedVersion() != null && !request.expectedVersion().equals(projection.version())) {
            throw AdminOpsException.conflict("ADMIN_PROJECTION_VERSION_CONFLICT", "projection version is stale");
        }
        String effectiveTrace = safeTrace(traceId);
        String decisionId = request.action().requiresConfirmation()
                ? confirmations.consume(principal, confirmationToken, request.action().name(), request.resourceRef())
                : "decision_" + UUID.randomUUID();
        Instant now = clock.instant();
        DomainCommand command = new DomainCommand(
                "cmd_" + UUID.randomUUID(),
                request.domain(),
                request.action(),
                request.resourceRef(),
                principal.tenantId(),
                principal.subjectId(),
                effectiveTrace,
                request.expectedVersion(),
                request.reasonCode(),
                request.attributes(),
                now);
        CommandForwardResult forwarded = commandPort.forward(command);
        AuditRecord audit = auditTrail.append(new AuditEvent(
                principal.tenantId(),
                principal.subjectId(),
                "DOMAIN_COMMAND_FORWARDED",
                request.resourceRef(),
                forwarded.commandId(),
                effectiveTrace,
                decisionId,
                Map.of(
                        "domain", request.domain().name(),
                        "action", request.action().name(),
                        "idempotencyKeyHash", ReferenceRedactor.sha256(idempotencyKey)),
                now));
        CommandResult result = new CommandResult(
                forwarded.commandId(),
                forwarded.dispatchState(),
                false,
                forwarded.targetService(),
                audit.auditId(),
                decisionId,
                request.resourceRef(),
                forwarded.acceptedAt());
        updateReviewState(principal, request, projection);
        idempotency.put(scope, idempotencyKey, fingerprint, result);
        return result;
    }

    public List<AuditRecord> audit(AdminPrincipal principal) {
        pep.requirePermission(principal, AdminPermission.AUDIT_EXPORT);
        String tenantRef = ReferenceRedactor.tenant(principal.tenantId());
        return auditTrail.snapshot().stream()
                .filter(record -> tenantRef.equals(record.tenantRef()))
                .toList();
    }

    private ProjectionRecord authorize(AdminPrincipal principal, CommandRequest request) {
        List<ProjectionRecord> records = projections.query(
                principal, new ProjectionQuery(request.domain(), request.resourceRef(), 1));
        if (records.isEmpty()) {
            throw AdminOpsException.notFound("ADMIN_RESOURCE_NOT_FOUND", "resource projection is not visible");
        }
        ProjectionRecord projection = records.get(0);
        pep.requireTenant(principal, projection.tenantId());
        return projection;
    }

    private void checkReviewPreconditions(
            AdminPrincipal principal, CommandRequest request, ProjectionRecord projection) {
        CommandAction action = request.action();
        if (requiresIndependentOperator(action)) {
            pep.requireOperatorNotAuthor(principal, projection.authorSubjectId());
        }
        ReviewState state = reviewStates.get(reviewKey(principal, request, projection));
        switch (action) {
            case CONTENT_REVIEW_FIRST -> {
                if (state != null && state.firstReviewerSubjectId != null) {
                    throw AdminOpsException.conflict(
                            "ADMIN_APPROVAL_ALREADY_RECORDED", "first review has already been recorded");
                }
            }
            case CONTENT_REVIEW_FINAL -> {
                if (state == null || state.firstReviewerSubjectId == null) {
                    throw AdminOpsException.conflict(
                            "ADMIN_APPROVAL_SEQUENCE_INVALID", "first review is required before final review");
                }
                if (principal.subjectId().equals(state.firstReviewerSubjectId)) {
                    throw AdminOpsException.forbidden(
                            "ADMIN_REVIEWER_SEPARATION_REQUIRED", "first and final reviewers must be different principals");
                }
                if (state.finalReviewerSubjectId != null) {
                    throw AdminOpsException.conflict(
                            "ADMIN_APPROVAL_ALREADY_RECORDED", "final review has already been recorded");
                }
            }
            case CONTENT_PUBLISH -> {
                if (state == null || state.finalReviewerSubjectId == null) {
                    throw AdminOpsException.conflict(
                            "ADMIN_APPROVAL_SEQUENCE_INVALID", "final review is required before publish");
                }
            }
            default -> {
                // Other domains use their own command-side policy; no content review state is inferred here.
            }
        }
    }

    private void updateReviewState(
            AdminPrincipal principal, CommandRequest request, ProjectionRecord projection) {
        switch (request.action()) {
            case CONTENT_REVIEW_FIRST -> reviewState(principal, request, projection).firstReviewerSubjectId = principal.subjectId();
            case CONTENT_REVIEW_FINAL -> reviewState(principal, request, projection).finalReviewerSubjectId = principal.subjectId();
            default -> {
                // No local approval transition for unrelated domain commands.
            }
        }
    }

    private ReviewState reviewState(
            AdminPrincipal principal, CommandRequest request, ProjectionRecord projection) {
        return reviewStates.computeIfAbsent(
                reviewKey(principal, request, projection), ignored -> new ReviewState());
    }

    private static String reviewKey(
            AdminPrincipal principal, CommandRequest request, ProjectionRecord projection) {
        return principal.tenantId() + ":" + request.domain().name() + ":"
                + request.resourceRef() + ":" + projection.version();
    }

    private static boolean requiresIndependentOperator(CommandAction action) {
        return action == CommandAction.CONTENT_REVIEW_FIRST
                || action == CommandAction.CONTENT_REVIEW_FINAL
                || action == CommandAction.CONTENT_PUBLISH;
    }

    private static CommandResult replay(IdempotencyLedger.Entry prior, String fingerprint) {
        if (!fingerprint.equals(prior.fingerprint())) {
            throw AdminOpsException.conflict(
                    "ADMIN_IDEMPOTENCY_KEY_REUSED", "Idempotency-Key was reused for another command");
        }
        if (!(prior.result() instanceof CommandResult result)) {
            throw AdminOpsException.conflict("ADMIN_IDEMPOTENCY_RESULT_INVALID", "stored command result is invalid");
        }
        return new CommandResult(
                result.commandId(), result.state(), true, result.targetService(), result.auditId(),
                result.decisionId(), result.resourceRef(), result.acceptedAt());
    }

    private static String scope(AdminPrincipal principal, CommandRequest request) {
        return principal.tenantId() + ":" + principal.subjectId() + ":"
                + request.domain().name() + ":" + request.action().name() + ":" + request.resourceRef();
    }

    private static String safeTrace(String traceId) {
        String normalized = traceId == null || traceId.isBlank()
                ? "trace_admin_" + UUID.randomUUID() : traceId.trim();
        if (!SAFE_TRACE.matcher(normalized).matches()) {
            throw AdminOpsException.invalid("ADMIN_TRACE_INVALID", "trace id must be a bounded safe token");
        }
        return normalized;
    }

    private static void requireIdempotencyKey(String value) {
        if (value == null || value.trim().length() < 8 || value.trim().length() > 160) {
            throw AdminOpsException.invalid("ADMIN_IDEMPOTENCY_KEY_REQUIRED", "Idempotency-Key is required");
        }
    }

    private static final class ReviewState {
        private String firstReviewerSubjectId;
        private String finalReviewerSubjectId;
    }

    /** Small wrapper keeps the domain port explicit while allowing a future HTTP projection adapter. */
    private record AdminProjectionPortAdapter(com.englishflow.adminops.domain.AdminProjectionPort delegate) {
        private List<ProjectionRecord> query(AdminPrincipal principal, ProjectionQuery query) {
            if (delegate == null) {
                throw AdminOpsException.notFound("ADMIN_PROJECTION_UNAVAILABLE", "projection adapter is unavailable");
            }
            return delegate.query(principal, query);
        }
    }
}
