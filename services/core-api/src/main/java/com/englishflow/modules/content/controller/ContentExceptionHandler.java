package com.englishflow.modules.content.controller;

import java.util.Map;
import java.util.UUID;

import com.englishflow.modules.content.ContentModuleException;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public final class ContentExceptionHandler {
    @ExceptionHandler(ContentModuleException.class)
    public ResponseEntity<Map<String, Object>> handle(ContentModuleException exception, HttpServletRequest request) {
        return ResponseEntity.status(exception.status()).body(Map.of("requestId", request.getHeader("X-Request-Id") == null ? "req_" + UUID.randomUUID().toString().replace("-", "").substring(0, 16) : request.getHeader("X-Request-Id"), "error", Map.of("code", exception.code(), "message", exception.getMessage(), "retryable", exception.retryable())));
    }
}
