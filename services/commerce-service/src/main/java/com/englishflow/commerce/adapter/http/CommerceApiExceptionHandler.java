package com.englishflow.commerce.adapter.http;

import com.englishflow.commerce.domain.CommerceException;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public final class CommerceApiExceptionHandler {
    @ExceptionHandler(CommerceException.class)
    public ResponseEntity<Map<String, Object>> handle(CommerceException exception) {
        Map<String, Object> error = new LinkedHashMap<>();
        error.put("code", exception.code());
        error.put("message", exception.getMessage());
        error.put("retryable", exception.retryable());
        return ResponseEntity.status(exception.status()).body(Map.of("error", error));
    }
}
