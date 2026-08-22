package com.englishflow.adminops.web;

import java.util.LinkedHashMap;
import java.util.Map;

import com.englishflow.adminops.domain.AdminOpsException;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/** Stable error envelope; authorization failures are not converted into empty results. */
@RestControllerAdvice
public final class AdminOpsApiExceptionHandler {

    @ExceptionHandler(AdminOpsException.class)
    public ResponseEntity<Map<String, Object>> handle(AdminOpsException exception, HttpServletRequest request) {
        Map<String, Object> error = new LinkedHashMap<>();
        error.put("code", exception.code());
        error.put("message", exception.getMessage());
        error.put("retryable", exception.retryable());
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("requestId", request.getHeader("X-Request-Id"));
        body.put("error", error);
        return ResponseEntity.status(exception.status()).body(body);
    }
}
