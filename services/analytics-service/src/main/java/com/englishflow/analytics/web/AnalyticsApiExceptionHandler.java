package com.englishflow.analytics.web;

import com.englishflow.analytics.domain.AnalyticsDomainException;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public final class AnalyticsApiExceptionHandler {

    @ExceptionHandler(AnalyticsDomainException.class)
    ResponseEntity<Map<String, Object>> handle(AnalyticsDomainException exception) {
        int status = switch (exception.code()) {
            case UNAUTHENTICATED -> 401;
            case FORBIDDEN -> 403;
            case EVENT_NOT_ALLOWLISTED, SOURCE_NOT_ALLOWLISTED, SCHEMA_VERSION_UNSUPPORTED,
                    ENVELOPE_INVALID, PAYLOAD_FIELD_NOT_ALLOWED, PAYLOAD_REQUIRED_FIELD_MISSING,
                    PAYLOAD_VALUE_INVALID, RAW_PII_REJECTED, TENANT_SCOPE_INVALID, AGGREGATE_MISMATCH,
                    DEDUPE_PAYLOAD_CONFLICT, RECOMPUTE_RANGE_INVALID, METRIC_VERSION_UNSUPPORTED -> 422;
            default -> 503;
        };
        Map<String, Object> error = new LinkedHashMap<>();
        error.put("code", exception.code().name());
        error.put("message", exception.getMessage());
        error.put("retryable", exception.retryable());
        return ResponseEntity.status(HttpStatus.valueOf(status)).body(Map.of(
                "requestId", "analytics-error",
                "error", error));
    }
}
