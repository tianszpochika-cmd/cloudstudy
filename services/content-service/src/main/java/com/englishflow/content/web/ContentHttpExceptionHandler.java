package com.englishflow.content.web;

import com.englishflow.content.domain.ContentOperationException;

import java.util.Map;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/** Keeps domain availability/rights errors distinguishable from empty content. */
@RestControllerAdvice
public final class ContentHttpExceptionHandler {

    @ExceptionHandler(ContentOperationException.class)
    public ResponseEntity<Map<String, Object>> handle(ContentOperationException exception) {
        return ResponseEntity.status(exception.status()).body(Map.of(
                "error", Map.of(
                        "code", exception.code(),
                        "message", exception.getMessage(),
                        "retryable", exception.retryable())));
    }
}
