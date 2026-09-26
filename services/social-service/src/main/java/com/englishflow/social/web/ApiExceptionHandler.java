package com.englishflow.social.web;

import java.util.LinkedHashMap;
import java.util.Map;
import java.time.Instant;

import com.englishflow.social.domain.SocialException;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

/** Keeps domain errors distinct from authentication, authorization and resource failures. */
@RestControllerAdvice
public final class ApiExceptionHandler {

    @ExceptionHandler(SocialException.class)
    public ResponseEntity<Map<String, Object>> social(SocialException exception, HttpServletRequest request) {
        if (isModerationQueue(request)) return moderationError(exception, request);
        return ResponseEntity.status(exception.status()).body(errorEnvelope(exception, request));
    }

    @ExceptionHandler({HttpMessageNotReadableException.class, MethodArgumentTypeMismatchException.class,
            IllegalArgumentException.class})
    public ResponseEntity<Map<String, Object>> invalid(Exception exception, HttpServletRequest request) {
        SocialException error = SocialException.invalid("REQUEST_INVALID", "request is invalid");
        if (isModerationQueue(request)) return moderationError(error, request);
        return ResponseEntity.badRequest().body(errorEnvelope(error, request));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, Object>> unexpected(Exception exception, HttpServletRequest request) {
        SocialException error = new SocialException("INTERNAL_ERROR", "request could not be completed", 500, false);
        if (isModerationQueue(request)) return moderationError(error, request);
        return ResponseEntity.internalServerError().body(errorEnvelope(error, request));
    }

    private static Map<String, Object> errorEnvelope(SocialException exception, HttpServletRequest request) {
        Map<String, Object> error = new LinkedHashMap<>();
        error.put("code", exception.code());
        error.put("message", exception.getMessage());
        error.put("retryable", exception.retryable());
        return Map.of("requestId", SocialController.requestId(request), "error", error);
    }

    private static boolean isModerationQueue(HttpServletRequest request) {
        String path = request.getRequestURI();
        return "/internal/v1/social/admin/moderation/reports".equals(path)
                || "/api/v1/social/admin/moderation/reports".equals(path);
    }

    private static ResponseEntity<Map<String, Object>> moderationError(
            SocialException exception, HttpServletRequest request) {
        String requestId = SocialLocalRealController.safeRequestId(request.getHeader("X-Request-Id"));
        String traceId = SocialLocalRealController.safeTraceId(request.getHeader("X-Trace-Id"));
        Map<String, Object> error = Map.of(
                "errorCode", exception.code(), "message", exception.getMessage(),
                "retryable", exception.retryable());
        Map<String, Object> meta = Map.of(
                "requestId", requestId, "traceId", traceId,
                "apiVersion", "v1", "schemaVersion", "1.0.0",
                "serverTime", Instant.now().toString());
        return ResponseEntity.status(exception.status())
                .header("X-Request-Id", requestId)
                .header("X-Trace-Id", traceId)
                .header("X-API-Version", "v1")
                .body(Map.of("error", error, "meta", meta));
    }
}
