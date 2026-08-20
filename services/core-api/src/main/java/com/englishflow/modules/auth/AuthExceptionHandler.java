package com.englishflow.modules.auth;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.UUID;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public final class AuthExceptionHandler {

    @ExceptionHandler(AuthException.class)
    public ResponseEntity<AuthApiErrorResponse> handle(AuthException exception, HttpServletRequest request) {
        String requestId = request.getHeader("X-Request-Id");
        if (requestId == null || !requestId.matches("[A-Za-z][A-Za-z0-9._-]{7,127}")) {
            requestId = "req_" + UUID.randomUUID().toString().replace("-", "").substring(0, 16);
        }
        String traceId = request.getHeader("X-Trace-Id");
        if (traceId == null || !traceId.matches("[a-f0-9]{32}")) traceId = "00000000000000000000000000000000";
        return ResponseEntity.status(exception.httpStatus()).body(new AuthApiErrorResponse(
                requestId, traceId, new AuthApiErrorResponse.AuthError(
                        exception.errorCode().name(), exception.getMessage(), exception.retryable(), java.util.Map.of())));
    }
}
