package com.englishflow.gamification.adapter.http;

import com.englishflow.gamification.domain.GamificationDomainException;
import com.englishflow.gamification.domain.GamificationPersistenceException;
import jakarta.servlet.http.HttpServletRequest;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public final class GamificationApiExceptionHandler {

    @ExceptionHandler(GamificationDomainException.class)
    ResponseEntity<?> handle(GamificationDomainException exception, HttpServletRequest request) {
        if (exception.code() == GamificationDomainException.Code.ENTITLEMENT_UNAVAILABLE) {
            return serviceUnavailable(exception.getMessage(), exception.code().name(), request);
        }
        return ResponseEntity.status(status(exception.code()))
                .body(new ApiError(exception.code().name(), exception.getMessage()));
    }

    @ExceptionHandler(GamificationPersistenceException.class)
    ResponseEntity<?> handle(GamificationPersistenceException exception, HttpServletRequest request) {
        return serviceUnavailable("所需服务暂不可用", "PERSISTENCE_UNAVAILABLE", request);
    }

    @ExceptionHandler(IllegalArgumentException.class)
    ResponseEntity<ApiError> handle(IllegalArgumentException exception) {
        return ResponseEntity.badRequest().body(new ApiError("INVALID_ARGUMENT", "request is invalid"));
    }

    private static HttpStatus status(GamificationDomainException.Code code) {
        return switch (code) {
            case UNAUTHORIZED -> HttpStatus.UNAUTHORIZED;
            case FORBIDDEN -> HttpStatus.FORBIDDEN;
            case NOT_FOUND -> HttpStatus.NOT_FOUND;
            case ENTITLEMENT_UNAVAILABLE -> HttpStatus.SERVICE_UNAVAILABLE;
            case IDEMPOTENCY_CONFLICT, EVENT_CONFLICT, LEDGER_INVARIANT -> HttpStatus.CONFLICT;
            case INVALID_ARGUMENT, INVALID_EVENT, UNTRUSTED_FIELD -> HttpStatus.BAD_REQUEST;
        };
    }

    private static ResponseEntity<Map<String, Object>> serviceUnavailable(
            String message, String reasonCode, HttpServletRequest request) {
        String requestId = request == null ? null : request.getHeader("X-Request-Id");
        if (requestId == null || !requestId.matches("^[A-Za-z][A-Za-z0-9._-]{7,127}$")) {
            requestId = "r" + UUID.randomUUID().toString().replace("-", "");
        }
        String traceId = request == null ? null : request.getHeader("X-Trace-Id");
        if (traceId == null || !traceId.matches("^[a-f0-9]{32}$")) {
            traceId = UUID.randomUUID().toString().replace("-", "");
        }
        HttpHeaders headers = new HttpHeaders();
        headers.set("X-Request-Id", requestId);
        headers.set("X-Trace-Id", traceId);
        headers.set("X-API-Version", "v1");
        Map<String, Object> body = Map.of(
                "error", Map.of("errorCode", "SERVICE_UNAVAILABLE", "message", message,
                        "retryable", false, "details", Map.of("reasonCode", reasonCode)),
                "meta", Map.of("requestId", requestId, "traceId", traceId, "apiVersion", "v1",
                        "schemaVersion", "1.0.0", "serverTime", Instant.now().toString()));
        return new ResponseEntity<>(body, headers, HttpStatus.SERVICE_UNAVAILABLE);
    }

    public record ApiError(String code, String message) {
    }
}
