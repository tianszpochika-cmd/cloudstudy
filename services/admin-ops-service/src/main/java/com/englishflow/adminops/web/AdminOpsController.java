package com.englishflow.adminops.web;

import com.englishflow.adminops.application.AdminOpsService;
import com.englishflow.adminops.closure.It7ClosureStudio;
import com.englishflow.adminops.domain.AdminPrincipal;
import com.englishflow.adminops.domain.AuditPage;
import com.englishflow.adminops.domain.CommandAction;
import com.englishflow.adminops.domain.CommandRequest;
import com.englishflow.adminops.domain.CommandResult;
import com.englishflow.adminops.domain.ConfirmationChallenge;
import com.englishflow.adminops.domain.Domain;
import com.englishflow.adminops.domain.ProjectionQuery;
import com.englishflow.adminops.domain.ProjectionView;
import com.englishflow.adminops.security.AdminOpsAuthenticationToken;
import jakarta.servlet.http.HttpServletRequest;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/internal/v1/admin-ops")
public final class AdminOpsController {

    private final AdminOpsService service;
    private final AuditCursorCodec auditCursorCodec;
    private It7ClosureStudio closureStudio;

    public AdminOpsController(AdminOpsService service, AuditCursorCodec auditCursorCodec) {
        this.service = service;
        this.auditCursorCodec = auditCursorCodec;
    }

    @Autowired
    void setClosureStudio(It7ClosureStudio closureStudio) {
        this.closureStudio = closureStudio;
    }

    @GetMapping("/projections")
    public Map<String, Object> projections(
            @RequestParam String domain,
            @RequestParam(required = false) String resourceRef,
            @RequestParam(defaultValue = "20") int limit,
            HttpServletRequest request) {
        Domain parsed = parseDomain(domain);
        return AdminOpsHttpSupport.envelope(
                service.query(principal(), new ProjectionQuery(parsed, resourceRef, limit)), request);
    }

    /** B13 browser projection. It is backed by the same owner table as the generic query seam. */
    @GetMapping("/commerce/orders")
    public Map<String, Object> commerceOrders(
            @RequestParam(defaultValue = "50") int limit,
            HttpServletRequest request) {
        List<Map<String, Object>> items = service.query(
                        principal(), new ProjectionQuery(Domain.COMMERCE, null, limit))
                .stream()
                .map(AdminOpsController::orderView)
                .toList();
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("items", items);
        data.put("nextCursor", null);
        return AdminOpsHttpSupport.envelope(data, request);
    }

    @PostMapping("/commands/prepare")
    public Map<String, Object> prepare(
            @RequestBody B13AdminCommandRequest body,
            HttpServletRequest request) {
        CommandRequest command = body.toDomainRequest();
        ConfirmationChallenge challenge = service.prepareCommand(principal(), command);
        return AdminOpsHttpSupport.envelope(Map.of(
                "token", challenge.token(),
                "decisionId", challenge.decisionId(),
                "action", challenge.action(),
                "resourceRef", challenge.resourceRef(),
                "expiresAt", challenge.expiresAt().toString()), request);
    }

    @PostMapping("/commands")
    public ResponseEntity<Map<String, Object>> execute(
            @RequestBody B13AdminCommandRequest body,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey,
            @RequestHeader(value = "X-Confirmation-Token", required = false) String confirmationToken,
            HttpServletRequest request) {
        if (body != null && body.closureCommand() != null && !body.closureCommand().isBlank()) {
            return closure(body, idempotencyKey, request);
        }
        return ResponseEntity.ok(AdminOpsHttpSupport.envelope(
                commandResultView(service.executeCommand(
                        principal(), body.toDomainRequest(), idempotencyKey, confirmationToken,
                        AdminOpsHttpSupport.traceId(request)), body), request));
    }

    private ResponseEntity<Map<String, Object>> closure(
            B13AdminCommandRequest body, String idempotencyKey, HttpServletRequest request) {
        if (closureStudio == null) {
            throw new com.englishflow.adminops.domain.AdminOpsException(
                    "CLOSURE_UNAVAILABLE", "closure desk is not available", 503, false);
        }
        AdminPrincipal current = principal();
        It7ClosureStudio.Actor actor = current == null
                ? It7ClosureStudio.Actor.anonymous()
                : new It7ClosureStudio.Actor(current.subjectId(), true, current.permissions());
        Map<String, Object> input = body.closureInput() == null
                ? new LinkedHashMap<>()
                : new LinkedHashMap<>(body.closureInput());
        if (idempotencyKey != null && !idempotencyKey.isBlank() && !input.containsKey("idempotencyKey")) {
            input.put("idempotencyKey", idempotencyKey);
        }
        It7ClosureStudio.Result result = closureStudio.handle(
                actor, body.closureCommand().trim().toUpperCase(Locale.ROOT), input);
        if (result.status() >= 400) {
            return ResponseEntity.status(result.status()).body(result.errorBody());
        }
        return ResponseEntity.ok(AdminOpsHttpSupport.envelope(result.data(), request));
    }

    @GetMapping("/audit")
    public ResponseEntity<Map<String, Object>> audit(
            @RequestParam(required = false) String cursor,
            @RequestParam(defaultValue = "20") int pageSize,
            HttpServletRequest request) {
        AdminPrincipal principal = principal();
        service.requireAuditRead(principal);
        auditCursorCodec.requireConfigured();
        if (pageSize < 1) {
            throw com.englishflow.adminops.domain.AdminOpsException.invalid(
                    "ADMIN_AUDIT_PAGE_SIZE_INVALID", "pageSize must be positive");
        }
        int boundedSize = Math.min(pageSize, 100);
        String tenantRef = com.englishflow.adminops.domain.ReferenceRedactor.tenant(principal.tenantId());
        Long beforeSequence = cursor == null ? null : auditCursorCodec.decode(cursor, tenantRef);
        AuditPage page = service.auditPage(principal, beforeSequence, boundedSize);
        List<Map<String, Object>> items = page.items().stream()
                .map(record -> Map.<String, Object>of(
                        "auditId", record.auditId(),
                        "operation", record.operation(),
                        "resourceRef", record.resourceRef(),
                        "commandId", record.commandId() == null ? "" : record.commandId(),
                        "traceId", record.traceId(),
                        "decisionId", record.decisionId(),
                        "occurredAt", record.occurredAt().toString(),
                        "redacted", true))
                .toList();
        String requestId = AdminOpsHttpSupport.requestId(request);
        String traceId = AdminOpsHttpSupport.traceId(request);
        Map<String, Object> meta = new LinkedHashMap<>();
        meta.put("requestId", requestId);
        meta.put("traceId", traceId);
        meta.put("apiVersion", "v1");
        meta.put("schemaVersion", "1.0.0");
        meta.put("serverTime", Instant.now().toString());
        meta.put("hasMore", page.hasMore());
        meta.put("pageSize", boundedSize);
        meta.put("nextCursor", page.hasMore() ? auditCursorCodec.encode(tenantRef, page.nextSequence()) : null);
        Map<String, Object> body = Map.of("data", Map.of("items", items, "redacted", true), "meta", meta);
        return ResponseEntity.ok()
                .header("X-Request-Id", requestId)
                .header("X-Trace-Id", traceId)
                .header("X-API-Version", "v1")
                .body(body);
    }

    static AdminPrincipal principal() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication instanceof AdminOpsAuthenticationToken token && token.isAuthenticated()) {
            return token.adminPrincipal();
        }
        return null;
    }

    private static Domain parseDomain(String value) {
        try {
            return Domain.valueOf(value == null ? "" : value.trim().toUpperCase());
        } catch (IllegalArgumentException exception) {
            throw com.englishflow.adminops.domain.AdminOpsException.invalid(
                    "ADMIN_QUERY_SCHEMA_INVALID", "domain is not allowlisted");
        }
    }

    private static Map<String, Object> commandResultView(CommandResult result, B13AdminCommandRequest request) {
        Map<String, Object> view = new LinkedHashMap<>();
        view.put("commandId", result.commandId());
        view.put("state", "ACCEPTED".equals(result.state()) ? "FORWARDED" : result.state());
        view.put("approvalRequired", parseAction(request.actionCode()).requiresConfirmation());
        view.put("auditRef", result.auditId());
        view.put("domainFactsUntouched", true);
        return view;
    }

    private static Map<String, Object> orderView(ProjectionView projection) {
        Map<String, String> fields = projection.safeFields();
        Map<String, Object> view = new LinkedHashMap<>();
        view.put("orderRef", projection.resourceRef());
        view.put("state", text(fields, "orderState", projection.status()));
        view.put("amountMinor", longValue(fields, "amountMinor", 0L));
        view.put("currency", text(fields, "currency", "CNY"));
        view.put("createdAt", text(fields, "createdAt", Instant.EPOCH.toString()));
        view.put("redactionVersion", text(fields, "redactionVersion", "admin-ops.redacted.v1"));
        return view;
    }

    private static CommandAction parseAction(String value) {
        try {
            return CommandAction.valueOf(value == null ? "" : value.trim().toUpperCase(java.util.Locale.ROOT));
        } catch (IllegalArgumentException exception) {
            throw com.englishflow.adminops.domain.AdminOpsException.invalid(
                    "ADMIN_COMMAND_ENUM_INVALID", "actionCode is not allowlisted");
        }
    }

    private static String text(Map<String, String> fields, String key, String fallback) {
        String value = fields.get(key);
        return value == null || value.isBlank() ? fallback : value;
    }

    private static long longValue(Map<String, String> fields, String key, long fallback) {
        try {
            return Long.parseLong(fields.getOrDefault(key, String.valueOf(fallback)));
        } catch (NumberFormatException exception) {
            return fallback;
        }
    }
}
