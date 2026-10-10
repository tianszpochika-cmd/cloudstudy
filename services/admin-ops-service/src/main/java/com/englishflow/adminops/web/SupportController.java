package com.englishflow.adminops.web;

import com.englishflow.adminops.closure.It7ClosureStudio;
import com.englishflow.adminops.domain.AdminPrincipal;
import com.englishflow.adminops.domain.AdminOpsException;
import com.englishflow.adminops.security.AdminOpsAuthenticationToken;
import com.englishflow.adminops.support.SupportAction;
import com.englishflow.adminops.support.SupportTicketService;
import com.englishflow.adminops.support.SupportTicketView;
import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.beans.factory.annotation.Autowired;
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
@RequestMapping({"/internal/v1/admin-ops/support", "/internal/v1/admin-ops"})
public final class SupportController {

    private final SupportTicketService service;
    private It7ClosureStudio closureStudio;

    public SupportController(SupportTicketService service) {
        this.service = service;
    }

    @Autowired
    void setClosureStudio(It7ClosureStudio closureStudio) {
        this.closureStudio = closureStudio;
    }

    @PostMapping("/tickets")
    public Map<String, Object> create(
            @RequestBody B13SupportTicketCreateRequest body,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey,
            HttpServletRequest request) {
        // The legacy payload has only a hash of the learner's description. Accepting it would
        // report success while support staff have no issue text to read or answer.
        throw workflowUnavailable();
    }

    @GetMapping("/tickets")
    public Map<String, Object> list(
            @RequestParam(defaultValue = "false") boolean includeAll,
            @RequestParam(required = false) String projection,
            HttpServletRequest request) {
        if ("it7".equals(projection)) {
            return closureBoard(request);
        }
        AdminPrincipal current = principal();
        List<Map<String, Object>> items = service.list(current, includeAll).stream()
                .map(SupportController::ticketView)
                .toList();
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("items", items);
        data.put("nextCursor", null);
        if (closureStudio != null) {
            It7ClosureStudio.Actor actor = current == null
                    ? It7ClosureStudio.Actor.anonymous()
                    : new It7ClosureStudio.Actor(current.subjectId(), true, current.permissions());
            It7ClosureStudio.Result result = closureStudio.handle(actor, "BOARD", Map.of());
            if (result.status() < 400 && result.data() != null) {
                data.put("ticketCopy", result.data().get("ticketCopy"));
                data.put("supportNumber", result.data().get("supportNumber"));
                data.put("privacy", result.data().get("privacy"));
                data.put("auditVisible", false);
                data.put("auditSharedWithLearner", false);
            }
        }
        return AdminOpsHttpSupport.envelope(data, request);
    }

    @GetMapping("/tickets/{ticketId}")
    public Map<String, Object> get(@PathVariable String ticketId, HttpServletRequest request) {
        return AdminOpsHttpSupport.envelope(ticketView(service.get(principal(), ticketId)), request);
    }

    @PostMapping("/tickets/{ticketId}/transitions/prepare")
    public Map<String, Object> prepareTransition(
            @PathVariable String ticketId,
            @RequestBody SupportAction action,
            HttpServletRequest request) {
        throw workflowUnavailable();
    }

    @PostMapping("/tickets/{ticketId}/transitions")
    public Map<String, Object> transition(
            @PathVariable String ticketId,
            @RequestBody SupportAction action,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey,
            @RequestHeader(value = "X-Confirmation-Token", required = false) String confirmationToken,
            HttpServletRequest request) {
        throw workflowUnavailable();
    }

    private Map<String, Object> closureBoard(HttpServletRequest request) {
        if (closureStudio == null) {
            throw new AdminOpsException("CLOSURE_UNAVAILABLE", "closure desk is not available", 503, false);
        }
        AdminPrincipal current = principal();
        It7ClosureStudio.Actor actor = current == null
                ? It7ClosureStudio.Actor.anonymous()
                : new It7ClosureStudio.Actor(current.subjectId(), true, current.permissions());
        It7ClosureStudio.Result result = closureStudio.handle(actor, "BOARD", Map.of());
        if (result.status() >= 400) {
            String code = String.valueOf(result.error().get("code"));
            String message = String.valueOf(result.error().get("message"));
            throw new AdminOpsException(code, message, result.status(), false);
        }
        return AdminOpsHttpSupport.envelope(result.data(), request);
    }

    private static AdminOpsException workflowUnavailable() {
        return new AdminOpsException("SUPPORT_CONTENT_REFERENCE_UNAVAILABLE",
                "verified support content references are not available", 503, false);
    }

    private static AdminPrincipal principal() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication instanceof AdminOpsAuthenticationToken token && token.isAuthenticated()) {
            return token.adminPrincipal();
        }
        return null;
    }

    private static Map<String, Object> ticketView(SupportTicketView ticket) {
        Map<String, Object> view = new LinkedHashMap<>();
        view.put("ticketId", ticket.ticketId());
        view.put("categoryCode", ticket.category().name());
        view.put("state", ticket.state().name());
        view.put("priority", ticket.priority().name());
        view.put("slaDueAt", ticket.slaDueAt());
        view.put("redactionVersion", "legacy.metadata.v1");
        view.put("slaState", ticket.slaStatus().name());
        view.put("workflowVersion", "LEGACY_HASH_ONLY");
        view.put("actionable", false);
        return view;
    }
}
