package com.englishflow.adminops.web;

import com.englishflow.adminops.domain.AdminPrincipal;
import com.englishflow.adminops.domain.ConfirmationChallenge;
import com.englishflow.adminops.security.AdminOpsAuthenticationToken;
import com.englishflow.adminops.support.SupportAction;
import com.englishflow.adminops.support.SupportTicketDraft;
import com.englishflow.adminops.support.SupportTicketResult;
import com.englishflow.adminops.support.SupportTicketService;
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
@RequestMapping("/internal/v1/admin-ops/support")
public final class SupportController {

    private final SupportTicketService service;

    public SupportController(SupportTicketService service) {
        this.service = service;
    }

    @PostMapping("/tickets")
    public Map<String, Object> create(
            @RequestBody SupportTicketDraft body,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey,
            HttpServletRequest request) {
        SupportTicketResult result = service.create(
                principal(), body, idempotencyKey, AdminOpsHttpSupport.traceId(request));
        return AdminOpsHttpSupport.envelope(Map.of(
                "ticket", result.ticket(), "replayed", result.replayed(), "auditId", result.auditId()), request);
    }

    @GetMapping("/tickets")
    public Map<String, Object> list(
            @RequestParam(defaultValue = "false") boolean includeAll,
            HttpServletRequest request) {
        List<?> items = service.list(principal(), includeAll);
        return AdminOpsHttpSupport.envelope(Map.of("items", items), request);
    }

    @GetMapping("/tickets/{ticketId}")
    public Map<String, Object> get(@PathVariable String ticketId, HttpServletRequest request) {
        return AdminOpsHttpSupport.envelope(service.get(principal(), ticketId), request);
    }

    @PostMapping("/tickets/{ticketId}/transitions/prepare")
    public Map<String, Object> prepareTransition(
            @PathVariable String ticketId,
            @RequestBody SupportAction action,
            HttpServletRequest request) {
        ConfirmationChallenge challenge = service.prepareTransition(principal(), ticketId, action);
        return AdminOpsHttpSupport.envelope(Map.of(
                "token", challenge.token(),
                "decisionId", challenge.decisionId(),
                "action", challenge.action(),
                "resourceRef", challenge.resourceRef(),
                "expiresAt", challenge.expiresAt().toString()), request);
    }

    @PostMapping("/tickets/{ticketId}/transitions")
    public Map<String, Object> transition(
            @PathVariable String ticketId,
            @RequestBody SupportAction action,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey,
            @RequestHeader(value = "X-Confirmation-Token", required = false) String confirmationToken,
            HttpServletRequest request) {
        SupportTicketResult result = service.transition(
                principal(), ticketId, action, idempotencyKey, confirmationToken,
                AdminOpsHttpSupport.traceId(request));
        return AdminOpsHttpSupport.envelope(Map.of(
                "ticket", result.ticket(), "replayed", result.replayed(), "auditId", result.auditId()), request);
    }

    private static AdminPrincipal principal() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication instanceof AdminOpsAuthenticationToken token && token.isAuthenticated()) {
            return token.adminPrincipal();
        }
        return null;
    }
}
