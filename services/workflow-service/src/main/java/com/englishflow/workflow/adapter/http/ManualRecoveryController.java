package com.englishflow.workflow.adapter.http;

import com.englishflow.workflow.application.ManualRecoveryService;
import com.englishflow.workflow.application.WorkflowRequestIdempotency;
import org.springframework.http.ResponseEntity;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;
import java.util.Set;

/**
 * The manual recovery boundary.
 *
 * <p>The caller's identity comes from the verified token and never from the body, because the whole point of
 * this workflow is that the requester and the approver are different people. A request body that could name
 * its own approver would make the rule decorative.
 */
@RestController
@RequestMapping("/internal/v1/workflow/recoveries")
public class ManualRecoveryController {

    private final ManualRecoveryService service;
    private final WorkflowRequestIdempotency idempotency;

    public ManualRecoveryController(ManualRecoveryService service, WorkflowRequestIdempotency idempotency) {
        this.service = service;
        this.idempotency = idempotency;
    }

    /** Asks for a recovery. The requester is taken from the token. */
    @PostMapping
    public ResponseEntity<Map<String, Object>> request(@AuthenticationPrincipal Jwt jwt,
                                                       @RequestBody Map<String, Object> body,
                                                       @RequestHeader(value = "Idempotency-Key", required = false) String key) {
        requirePermission(jwt, "admin.recovery.request");
        String actor = subject(jwt);
        Map<String, Object> response = idempotency.execute(jwt.getClaimAsString("tenant_id"), actor,
                "MANUAL_RECOVERY_REQUEST", key, body,
                () -> {
                    RecoveryRequestBody validated = recoveryRequest(body);
                    return service.request(actor, validated.subjectType(), validated.subjectId(),
                            validated.action(), validated.reason()).toMap();
                });
        return ResponseEntity.status(201).body(response);
    }

    /** Approves a recovery. Refused when the approver is the requester. */
    @PostMapping("/{recoveryId}/approve")
    public ResponseEntity<Map<String, Object>> approve(@AuthenticationPrincipal Jwt jwt,
                                                       @PathVariable String recoveryId,
                                                       @RequestBody(required = false) Map<String, Object> body,
                                                       @RequestHeader(value = "Idempotency-Key", required = false) String key) {
        requirePermission(jwt, "admin.recovery.command");
        String actor = subject(jwt);
        Map<String, Object> input = body == null ? Map.of() : body;
        return ResponseEntity.ok(idempotency.execute(jwt.getClaimAsString("tenant_id"), actor,
                "MANUAL_RECOVERY_APPROVE", key, Map.of("recoveryId", recoveryId, "body", input),
                () -> {
                    requireEmptyBody(input);
                    return service.approve(recoveryId, actor).toMap();
                }));
    }

    /** Rejects a recovery. The same independence rule applies. */
    @PostMapping("/{recoveryId}/reject")
    public ResponseEntity<Map<String, Object>> reject(@AuthenticationPrincipal Jwt jwt,
                                                      @PathVariable String recoveryId,
                                                      @RequestBody(required = false) Map<String, Object> body,
                                                      @RequestHeader(value = "Idempotency-Key", required = false) String key) {
        requirePermission(jwt, "admin.recovery.command");
        String actor = subject(jwt);
        Map<String, Object> input = body == null ? Map.of() : body;
        Object rawReason = input.get("reason");
        String reason = rawReason instanceof String text ? text : null;
        Map<String, Object> request = new java.util.LinkedHashMap<>();
        request.put("recoveryId", recoveryId);
        request.put("body", input);
        return ResponseEntity.ok(idempotency.execute(jwt.getClaimAsString("tenant_id"), actor,
                "MANUAL_RECOVERY_REJECT", key, request,
                () -> {
                    if (input.size() > 1 || !input.isEmpty() && !input.containsKey("reason")
                            || input.containsKey("reason") && !(rawReason instanceof String)) {
                        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "invalid rejection body");
                    }
                    return service.reject(recoveryId, actor, reason).toMap();
                }));
    }

    /** Executes an approved recovery and records the receipt. */
    @PostMapping("/{recoveryId}/execute")
    public ResponseEntity<Map<String, Object>> execute(@AuthenticationPrincipal Jwt jwt,
                                                        @PathVariable String recoveryId,
                                                        @RequestBody(required = false) Map<String, Object> body,
                                                        @RequestHeader(value = "Idempotency-Key", required = false) String key) {
        requirePermission(jwt, "admin.recovery.command");
        String actor = subject(jwt);
        Map<String, Object> input = body == null ? Map.of() : body;
        return ResponseEntity.ok(idempotency.execute(jwt.getClaimAsString("tenant_id"), actor,
                "MANUAL_RECOVERY_EXECUTE", key, Map.of("recoveryId", recoveryId, "body", input),
                () -> {
                    requireEmptyBody(input);
                    return service.execute(recoveryId, actor, jwt.getTokenValue()).toMap();
                }));
    }

    /**
     * The caller's identity.
     *
     * <p>The subject claim rather than a header: a client-supplied identity would defeat the two-person rule
     * entirely, since anyone could then present themselves as two people.
     */
    /**
     * Defence in depth: the security filter chain already enforces these permissions, but the
     * controller re-checks the verified claims so a future matcher change cannot open a write.
     */
    static void requirePermission(Jwt jwt, String permission) {
        if (jwt == null || !"platform".equals(jwt.getClaimAsString("tenant_id"))) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "platform tenant required");
        }
        java.util.List<String> granted = jwt.getClaimAsStringList("permissions");
        if (granted == null || !granted.contains(permission)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "missing permission " + permission);
        }
    }

    private static String subject(Jwt jwt) {
        String subject = jwt.getSubject();
        if (subject == null || subject.isBlank()) {
            throw new com.englishflow.workflow.domain.ManualRecoveryRequest.RecoveryNotAllowed(
                    "the token carries no subject, so the caller cannot be identified");
        }
        return subject;
    }

    /** The body of a recovery request. Deliberately without an approver field. */
    public record RecoveryRequestBody(String subjectType, String subjectId, String action, String reason) {
    }

    private static void requireEmptyBody(Map<String, Object> body) {
        if (!body.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "recovery action body must be empty");
        }
    }

    private static RecoveryRequestBody recoveryRequest(Map<String, Object> body) {
        if (body == null || !Set.of("subjectType", "subjectId", "action", "reason").containsAll(body.keySet())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "invalid recovery request body");
        }
        return new RecoveryRequestBody(
                requiredText(body.get("subjectType"), 60),
                requiredText(body.get("subjectId"), 160),
                requiredText(body.get("action"), 60),
                requiredText(body.get("reason"), 500));
    }

    private static String requiredText(Object value, int maxLength) {
        if (!(value instanceof String text) || text.isBlank() || text.length() > maxLength) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "invalid recovery request body");
        }
        return text.trim();
    }
}
