package com.englishflow.adminops.web;

import com.englishflow.adminops.application.AdminOpsService;
import com.englishflow.adminops.domain.AdminPrincipal;
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
import java.util.Map;
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

    public AdminOpsController(AdminOpsService service) {
        this.service = service;
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
    public Map<String, Object> execute(
            @RequestBody B13AdminCommandRequest body,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey,
            @RequestHeader(value = "X-Confirmation-Token", required = false) String confirmationToken,
            HttpServletRequest request) {
        return AdminOpsHttpSupport.envelope(
                commandResultView(service.executeCommand(
                        principal(), body.toDomainRequest(), idempotencyKey, confirmationToken,
                        AdminOpsHttpSupport.traceId(request)), body), request);
    }

    @GetMapping("/audit")
    public Map<String, Object> audit(HttpServletRequest request) {
        List<Map<String, Object>> items = service.audit(principal()).stream()
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
        return AdminOpsHttpSupport.envelope(Map.of("items", items, "redacted", true), request);
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
