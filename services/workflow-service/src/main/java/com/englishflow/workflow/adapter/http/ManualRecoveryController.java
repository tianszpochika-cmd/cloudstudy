package com.englishflow.workflow.adapter.http;

import com.englishflow.workflow.application.ManualRecoveryService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

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

    public ManualRecoveryController(ManualRecoveryService service) {
        this.service = service;
    }

    /** Asks for a recovery. The requester is taken from the token. */
    @PostMapping
    public ResponseEntity<Map<String, Object>> request(@AuthenticationPrincipal Jwt jwt,
                                                       @RequestBody RecoveryRequestBody body) {
        ManualRecoveryService.RecoveryView view = service.request(subject(jwt), body.subjectType(),
                body.subjectId(), body.action(), body.reason());
        return ResponseEntity.status(201).body(view.toMap());
    }

    /** Approves a recovery. Refused when the approver is the requester. */
    @PostMapping("/{recoveryId}/approve")
    public ResponseEntity<Map<String, Object>> approve(@AuthenticationPrincipal Jwt jwt,
                                                       @PathVariable String recoveryId) {
        return ResponseEntity.ok(service.approve(recoveryId, subject(jwt)).toMap());
    }

    /** Rejects a recovery. The same independence rule applies. */
    @PostMapping("/{recoveryId}/reject")
    public ResponseEntity<Map<String, Object>> reject(@AuthenticationPrincipal Jwt jwt,
                                                      @PathVariable String recoveryId,
                                                      @RequestBody(required = false) RejectionBody body) {
        return ResponseEntity.ok(service.reject(recoveryId, subject(jwt),
                body == null ? null : body.reason()).toMap());
    }

    /** Executes an approved recovery and records the receipt. */
    @PostMapping("/{recoveryId}/execute")
    public ResponseEntity<Map<String, Object>> execute(@AuthenticationPrincipal Jwt jwt,
                                                        @PathVariable String recoveryId) {
        return ResponseEntity.ok(service.execute(recoveryId, subject(jwt)).toMap());
    }

    /**
     * The caller's identity.
     *
     * <p>The subject claim rather than a header: a client-supplied identity would defeat the two-person rule
     * entirely, since anyone could then present themselves as two people.
     */
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

    /** The body of a rejection. */
    public record RejectionBody(String reason) {
    }
}
