package com.englishflow.audit.adapter.http;

import java.time.Instant;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;

import com.englishflow.audit.security.AuditJwtAuthenticationConverter;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * M1-017 internal boundary. Export jobs must stay unavailable until approval,
 * redaction, immutable storage, and one-time grant consumption exist.
 */
@RestController
@RequestMapping("/internal/v1/audit/exports")
public final class AuditExportUnavailableController {

    private static final Set<String> EXPORT_CALLERS = Set.of("admin-ops-service", "workflow-service");
    private static final Set<String> WORKFLOW_CALLER = Set.of("workflow-service");
    private static final Pattern EXPORT_ID = Pattern.compile("^audit-export_[A-Za-z0-9._:-]{8,112}$");
    private static final Pattern REQUEST_ID = Pattern.compile("^[A-Za-z][A-Za-z0-9._-]{7,127}$");
    private static final Pattern TRACE_ID = Pattern.compile("^[a-f0-9]{32}$");

    @PostMapping
    public ResponseEntity<Map<String, Object>> create(
            Authentication authentication,
            HttpServletRequest request,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey) {
        ResponseEntity<Map<String, Object>> denied = authorize(authentication, request, "audit.export.create", EXPORT_CALLERS);
        if (denied != null) return denied;
        if (!validIdempotencyKey(idempotencyKey)) return invalidRequest(request);
        return unavailable(request);
    }

    @GetMapping("/{exportId}")
    public ResponseEntity<Map<String, Object>> status(
            Authentication authentication,
            HttpServletRequest request,
            @PathVariable String exportId) {
        ResponseEntity<Map<String, Object>> denied = authorize(authentication, request, "audit.export.read", EXPORT_CALLERS);
        if (denied != null) return denied;
        if (!validExportId(exportId)) return invalidRequest(request);
        return unavailable(request);
    }

    @PostMapping("/{exportId}/download")
    public ResponseEntity<Map<String, Object>> download(
            Authentication authentication,
            HttpServletRequest request,
            @PathVariable String exportId,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey) {
        ResponseEntity<Map<String, Object>> denied = authorize(authentication, request, "audit.export.download", EXPORT_CALLERS);
        if (denied != null) return denied;
        if (!validExportId(exportId) || !validIdempotencyKey(idempotencyKey)) return invalidRequest(request);
        return unavailable(request);
    }

    @PostMapping("/{exportId}/recovery")
    public ResponseEntity<Map<String, Object>> recovery(
            Authentication authentication,
            HttpServletRequest request,
            @PathVariable String exportId,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey) {
        ResponseEntity<Map<String, Object>> denied = authorize(authentication, request, "audit.export.recover", WORKFLOW_CALLER);
        if (denied != null) return denied;
        if (!validExportId(exportId) || !validIdempotencyKey(idempotencyKey)) return invalidRequest(request);
        return unavailable(request);
    }

    private static ResponseEntity<Map<String, Object>> authorize(
            Authentication authentication, HttpServletRequest request,
            String requiredPermission, Set<String> allowedCallers) {
        if (!(authentication instanceof JwtAuthenticationToken jwt) || !jwt.isAuthenticated()) {
            return error(request, HttpStatus.UNAUTHORIZED, "AUTH_REQUIRED", "authentication required");
        }
        String subject = jwt.getToken().getSubject();
        String serviceId = jwt.getToken().getClaimAsString("service_id");
        String clientId = jwt.getToken().getClaimAsString("client_id");
        if (!"service".equals(jwt.getToken().getClaimAsString("token_type"))
                || !"platform".equals(jwt.getToken().getClaimAsString("tenant_id"))
                || subject == null || !allowedCallers.contains(subject)
                || !subject.equals(serviceId) || !subject.equals(clientId)
                || !AuditJwtAuthenticationConverter.strings(jwt.getToken().getClaim("permissions"))
                        .contains(requiredPermission)) {
            return error(request, HttpStatus.FORBIDDEN, "FORBIDDEN", "access denied");
        }
        return null;
    }

    private static boolean validExportId(String exportId) {
        return exportId != null && EXPORT_ID.matcher(exportId).matches();
    }

    private static boolean validIdempotencyKey(String key) {
        return key != null && !key.isBlank() && key.length() >= 8 && key.length() <= 128;
    }

    private static ResponseEntity<Map<String, Object>> invalidRequest(HttpServletRequest request) {
        return error(request, HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "invalid export request");
    }

    private static ResponseEntity<Map<String, Object>> unavailable(HttpServletRequest request) {
        return error(request, HttpStatus.SERVICE_UNAVAILABLE, "SERVICE_UNAVAILABLE", "audit export unavailable");
    }

    private static ResponseEntity<Map<String, Object>> error(
            HttpServletRequest request, HttpStatus status, String code, String message) {
        String requestId = validHeader(request.getHeader("X-Request-Id"), REQUEST_ID)
                ? request.getHeader("X-Request-Id") : "req-" + UUID.randomUUID().toString().replace("-", "");
        String traceId = validHeader(request.getHeader("X-Trace-Id"), TRACE_ID)
                ? request.getHeader("X-Trace-Id") : UUID.randomUUID().toString().replace("-", "");
        return ResponseEntity.status(status)
                .cacheControl(CacheControl.noStore())
                .header("X-Request-Id", requestId)
                .header("X-Trace-Id", traceId)
                .header("X-API-Version", "v1")
                .body(Map.of(
                        "error", Map.of("errorCode", code, "message", message, "retryable", false),
                        "meta", Map.of("requestId", requestId, "traceId", traceId, "apiVersion", "v1",
                                "schemaVersion", "1.0.0", "serverTime", Instant.now().toString())));
    }

    private static boolean validHeader(String header, Pattern pattern) {
        return header != null && pattern.matcher(header).matches();
    }
}
