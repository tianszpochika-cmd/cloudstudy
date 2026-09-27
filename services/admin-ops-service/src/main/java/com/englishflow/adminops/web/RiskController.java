package com.englishflow.adminops.web;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import jakarta.servlet.http.HttpServletRequest;
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

import com.englishflow.adminops.domain.AdminPrincipal;
import com.englishflow.adminops.risk.RiskCaseService;
import com.englishflow.adminops.risk.RiskCaseView;
import com.englishflow.adminops.risk.RiskCategory;
import com.englishflow.adminops.risk.RiskCommand;
import com.englishflow.adminops.risk.RiskDecisionResult;
import com.englishflow.adminops.risk.RiskFileDraft;
import com.englishflow.adminops.risk.RiskSeverity;
import com.englishflow.adminops.security.AdminOpsAuthenticationToken;

/**
 * Risk cases merged into the governance surface (no standalone /risk page).
 * All authority comes from the verified staff principal; bearer forwarding to
 * IAM carries the caller's own token for rule evaluation.
 */
@RestController
@RequestMapping("/internal/v1/admin-ops/risk")
public final class RiskController {

    private final RiskCaseService risks;

    public RiskController(RiskCaseService risks) {
        this.risks = risks;
    }

    @GetMapping("/cases")
    public Map<String, Object> list(HttpServletRequest request) {
        List<Map<String, Object>> items = risks.list(principal()).stream()
                .map(RiskController::caseView)
                .toList();
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("items", items);
        data.put("nextCursor", null);
        return AdminOpsHttpSupport.envelope(data, request);
    }

    @PostMapping("/cases")
    public Map<String, Object> file(
            @RequestBody Map<String, Object> body,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey,
            HttpServletRequest request) {
        RiskFileDraft draft = new RiskFileDraft(
                category(body.get("category")),
                severity(body.get("severity")),
                string(body.get("title")),
                stringOrNull(body.get("subjectRef")),
                strings(body.get("evidenceRefs")),
                stringOrNull(body.get("note")));
        RiskDecisionResult result = risks.file(principal(), draft, idempotencyKey, traceId(request));
        return AdminOpsHttpSupport.envelope(decisionEnvelope(result), request);
    }

    @PostMapping("/cases/{caseId}/commands")
    public Map<String, Object> decide(
            @PathVariable String caseId,
            @RequestBody Map<String, Object> body,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey,
            HttpServletRequest request) {
        RiskCommand command;
        try {
            command = RiskCommand.valueOf(String.valueOf(body.get("command")).trim().toUpperCase());
        } catch (IllegalArgumentException | NullPointerException invalid) {
            throw new com.englishflow.adminops.domain.AdminOpsException("RISK_COMMAND_INVALID",
                    "risk command is invalid", 400, false);
        }
        RiskCaseService.RiskDecisionInput input = new RiskCaseService.RiskDecisionInput(
                command,
                stringOrNull(body.get("reason")),
                stringOrNull(body.get("assigneeNote")),
                stringOrNull(body.get("containmentRef")),
                stringOrNull(body.get("escalationTarget")),
                stringOrNull(body.get("escalationRef")));
        RiskDecisionResult result = risks.decide(principal(), caseId, command, input,
                idempotencyKey, traceId(request));
        return AdminOpsHttpSupport.envelope(decisionEnvelope(result), request);
    }

    @PostMapping("/rules:evaluate")
    public Map<String, Object> evaluate(
            @RequestBody(required = false) Map<String, Object> body,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey,
            HttpServletRequest request) {
        List<String> rules = null;
        if (body != null && body.get("rules") instanceof List<?> raw) {
            List<String> parsed = new ArrayList<>();
            for (Object item : raw) {
                if (item != null) {
                    parsed.add(String.valueOf(item));
                }
            }
            rules = parsed;
        }
        RiskCaseService.RiskEvaluateResult result = risks.evaluateRules(
                principal(), rules, bearer(), idempotencyKey, traceId(request));
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("evaluatedAt", result.evaluatedAt().toString());
        data.put("rulesChecked", result.rulesChecked());
        data.put("casesFiled", result.casesFiled());
        data.put("caseIds", List.copyOf(result.caseIds()));
        data.put("replayed", result.replayed());
        return AdminOpsHttpSupport.envelope(data, request);
    }

    private static Map<String, Object> decisionEnvelope(RiskDecisionResult result) {
        Map<String, Object> data = caseView(result.kase());
        data.put("replayed", result.replayed());
        data.put("auditId", result.auditId());
        return data;
    }

    private static Map<String, Object> caseView(RiskCaseView kase) {
        Map<String, Object> view = new LinkedHashMap<>();
        view.put("caseId", kase.caseId());
        view.put("category", kase.category().name());
        view.put("severity", kase.severity().name());
        view.put("status", kase.status().name());
        view.put("source", kase.source().name());
        view.put("ruleId", kase.ruleId());
        view.put("ruleVersion", kase.ruleVersion());
        view.put("title", kase.title());
        view.put("subjectRef", kase.subjectRef());
        view.put("evidenceRefs", List.copyOf(kase.evidenceRefs()));
        view.put("assigneeNote", kase.assigneeNote());
        view.put("containmentRef", kase.containmentRef());
        view.put("escalationTarget", kase.escalationTarget());
        view.put("escalationRef", kase.escalationRef());
        view.put("closedReason", kase.closedReason());
        view.put("decisions", kase.decisions().stream().map(decision -> {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("decisionId", decision.decisionId());
            row.put("command", decision.command().name());
            row.put("reason", decision.reason());
            row.put("decidedBy", decision.decidedBy());
            row.put("decidedAt", decision.decidedAt().toString());
            return row;
        }).toList());
        view.put("lastAuditId", kase.lastAuditId());
        view.put("stateVersion", kase.version());
        view.put("createdAt", kase.createdAt().toString());
        view.put("updatedAt", kase.updatedAt().toString());
        return view;
    }

    private static AdminPrincipal principal() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication instanceof AdminOpsAuthenticationToken token && token.isAuthenticated()) {
            return token.adminPrincipal();
        }
        return null;
    }

    private static String bearer() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication instanceof AdminOpsAuthenticationToken token && token.isAuthenticated()) {
            // Credentials carry the decoder-verified Jwt (see the converter);
            // forwarding reuses its compact value, never a client-supplied string.
            if (token.getCredentials() instanceof org.springframework.security.oauth2.jwt.Jwt jwt
                    && jwt.getTokenValue() != null && !jwt.getTokenValue().isBlank()) {
                return jwt.getTokenValue();
            }
        }
        return null;
    }

    private static RiskCategory category(Object value) {
        try {
            return RiskCategory.valueOf(String.valueOf(value).trim().toUpperCase());
        } catch (IllegalArgumentException | NullPointerException invalid) {
            throw new com.englishflow.adminops.domain.AdminOpsException("RISK_CATEGORY_INVALID",
                    "risk category is invalid", 400, false);
        }
    }

    private static RiskSeverity severity(Object value) {
        try {
            return RiskSeverity.valueOf(String.valueOf(value).trim().toUpperCase());
        } catch (IllegalArgumentException | NullPointerException invalid) {
            throw new com.englishflow.adminops.domain.AdminOpsException("RISK_SEVERITY_INVALID",
                    "risk severity is invalid", 400, false);
        }
    }

    private static String string(Object value) {
        return value == null ? "" : String.valueOf(value);
    }

    private static String stringOrNull(Object value) {
        return value == null || String.valueOf(value).isBlank() ? null : String.valueOf(value).trim();
    }

    private static List<String> strings(Object value) {
        if (!(value instanceof List<?> list)) {
            return List.of();
        }
        List<String> result = new ArrayList<>();
        for (Object item : list) {
            if (item != null && !String.valueOf(item).isBlank()) {
                result.add(String.valueOf(item).trim());
            }
        }
        return result;
    }

    private static String traceId(HttpServletRequest request) {
        String trace = request == null ? null : request.getHeader("X-Trace-Id");
        return trace == null || trace.isBlank() ? null : trace.trim();
    }
}
