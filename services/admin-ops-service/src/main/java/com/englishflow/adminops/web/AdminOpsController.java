package com.englishflow.adminops.web;

import com.englishflow.adminops.application.AdminOpsService;
import com.englishflow.adminops.domain.AdminPrincipal;
import com.englishflow.adminops.domain.CommandRequest;
import com.englishflow.adminops.domain.ConfirmationChallenge;
import com.englishflow.adminops.domain.Domain;
import com.englishflow.adminops.domain.ProjectionQuery;
import com.englishflow.adminops.security.AdminOpsAuthenticationToken;
import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import java.util.Map;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
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

    @PostMapping("/commands/prepare")
    public Map<String, Object> prepare(
            @RequestBody CommandRequest body,
            HttpServletRequest request) {
        ConfirmationChallenge challenge = service.prepareCommand(principal(), body);
        return AdminOpsHttpSupport.envelope(Map.of(
                "token", challenge.token(),
                "decisionId", challenge.decisionId(),
                "action", challenge.action(),
                "resourceRef", challenge.resourceRef(),
                "expiresAt", challenge.expiresAt().toString()), request);
    }

    @PostMapping("/commands")
    public Map<String, Object> execute(
            @RequestBody CommandRequest body,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey,
            @RequestHeader(value = "X-Confirmation-Token", required = false) String confirmationToken,
            HttpServletRequest request) {
        return AdminOpsHttpSupport.envelope(
                service.executeCommand(
                        principal(), body, idempotencyKey, confirmationToken,
                        AdminOpsHttpSupport.traceId(request)), request);
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
}
