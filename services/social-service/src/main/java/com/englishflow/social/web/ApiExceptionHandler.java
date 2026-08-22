package com.englishflow.social.web;

import java.util.LinkedHashMap;
import java.util.Map;

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
        return ResponseEntity.status(exception.status()).body(errorEnvelope(exception, request));
    }

    @ExceptionHandler({HttpMessageNotReadableException.class, MethodArgumentTypeMismatchException.class,
            IllegalArgumentException.class})
    public ResponseEntity<Map<String, Object>> invalid(Exception exception, HttpServletRequest request) {
        SocialException error = SocialException.invalid("REQUEST_INVALID", "request is invalid");
        return ResponseEntity.badRequest().body(errorEnvelope(error, request));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, Object>> unexpected(Exception exception, HttpServletRequest request) {
        SocialException error = new SocialException("INTERNAL_ERROR", "request could not be completed", 500, false);
        return ResponseEntity.internalServerError().body(errorEnvelope(error, request));
    }

    private static Map<String, Object> errorEnvelope(SocialException exception, HttpServletRequest request) {
        Map<String, Object> error = new LinkedHashMap<>();
        error.put("code", exception.code());
        error.put("message", exception.getMessage());
        error.put("retryable", exception.retryable());
        return Map.of("requestId", SocialController.requestId(request), "error", error);
    }
}
