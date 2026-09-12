package com.englishflow.audit.adapter.http;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import com.englishflow.audit.application.AuditIngestService;
import com.englishflow.audit.domain.AuditDomainException;
import com.englishflow.audit.domain.AuditEvent;
import com.englishflow.audit.domain.AuditFactStore;
import com.englishflow.audit.security.AuditJwtAuthenticationConverter;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/internal/v1/audit")
public final class AuditIngestController {

    private static final Set<String> ALLOWED_FIELDS = Set.of(
            "eventId", "sourceService", "schemaVersion", "tenantId", "actorSubjectHash", "action", "decision",
            "reasonCode", "occurredAt", "requestId", "traceId", "redactedPayload");

    private final AuditIngestService service;

    public AuditIngestController(AuditIngestService service) {
        this.service = service;
    }

    @PostMapping("/events")
    public ResponseEntity<Map<String, Object>> ingest(Authentication authentication,
                                                      @RequestBody Map<String, Object> body) {
        requireIngestCaller(authentication);
        AuditEvent event = toEvent(body);
        AuditFactStore.IngestResult result = service.ingest(event);
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("status", result.status().name());
        response.put("auditId", result.auditId() == null ? null : result.auditId().toString());
        return ResponseEntity.status(result.status() == AuditFactStore.IngestStatus.ACCEPTED ? 202 : 200)
                .body(response);
    }

    @ExceptionHandler(AuditDomainException.class)
    public ResponseEntity<Map<String, Object>> handleDomainFailure(AuditDomainException failure) {
        return ResponseEntity.status(failure.status()).body(Map.of(
                "code", failure.code(),
                "message", failure.getMessage() == null ? "audit request rejected" : failure.getMessage()));
    }

    private static void requireIngestCaller(Authentication authentication) {
        if (!(authentication instanceof JwtAuthenticationToken jwt) || !jwt.isAuthenticated()) {
            throw AuditDomainException.forbidden("verified JWT principal is required");
        }
        String tenant = jwt.getToken().getClaimAsString("tenant_id");
        if (!"platform".equals(tenant)) {
            throw AuditDomainException.forbidden("tenant is not allowed");
        }
        boolean permitted = jwt.getAuthorities().stream()
                .map(authority -> authority.getAuthority())
                .anyMatch(value -> "audit.ingest".equals(value)
                        || "PERM_audit.ingest".equals(value)
                        || "SCOPE_audit.ingest".equals(value));
        if (!permitted && !AuditJwtAuthenticationConverter.strings(jwt.getToken().getClaim("permissions"))
                .contains("audit.ingest")) {
            throw AuditDomainException.forbidden("audit.ingest permission is required");
        }
    }

    private static AuditEvent toEvent(Map<String, Object> body) {
        if (body == null) {
            throw AuditDomainException.invalid("audit event body is required");
        }
        for (Object key : body.keySet()) {
            if (!(key instanceof String field) || !ALLOWED_FIELDS.contains(field)) {
                throw AuditDomainException.invalid("audit event contains an unsupported field");
            }
        }
        try {
            return new AuditEvent(
                    UUID.fromString(required(body, "eventId")),
                    required(body, "sourceService"),
                    required(body, "schemaVersion"),
                    required(body, "tenantId"),
                    required(body, "actorSubjectHash"),
                    required(body, "action"),
                    required(body, "decision"),
                    optional(body, "reasonCode"),
                    Instant.parse(required(body, "occurredAt")),
                    optional(body, "requestId"),
                    optional(body, "traceId"),
                    payload(body));
        } catch (AuditDomainException failure) {
            throw failure;
        } catch (RuntimeException failure) {
            throw AuditDomainException.invalid("audit event fields are invalid");
        }
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> payload(Map<String, Object> body) {
        Object value = body.get("redactedPayload");
        if (value == null) {
            return Map.of();
        }
        if (!(value instanceof Map<?, ?> map)) {
            throw AuditDomainException.invalid("redactedPayload must be an object");
        }
        Map<String, Object> result = new LinkedHashMap<>();
        map.forEach((key, item) -> result.put(String.valueOf(key), item));
        return result;
    }

    private static String required(Map<String, Object> body, String field) {
        Object value = body.get(field);
        if (!(value instanceof String text) || text.isBlank()) {
            throw AuditDomainException.invalid(field + " is required");
        }
        return text;
    }

    private static String optional(Map<String, Object> body, String field) {
        Object value = body.get(field);
        return value instanceof String text && !text.isBlank() ? text : null;
    }
}
