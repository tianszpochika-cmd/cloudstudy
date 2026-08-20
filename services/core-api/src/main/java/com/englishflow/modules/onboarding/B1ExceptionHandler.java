package com.englishflow.modules.onboarding;

import java.time.Instant;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class B1ExceptionHandler {
    @ExceptionHandler(B1DomainException.class)
    public ResponseEntity<B1ApiError> handleDomain(B1DomainException exception) {
        return ResponseEntity.status(exception.status()).body(new B1ApiError(
                exception.errorCode(), exception.getMessage(), false, Instant.now()
        ));
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<B1ApiError> handleValidation(IllegalArgumentException exception) {
        return ResponseEntity.badRequest().body(new B1ApiError(
                "VALIDATION_ERROR", exception.getMessage(), false, Instant.now()
        ));
    }

    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<B1ApiError> handleState(IllegalStateException exception) {
        return ResponseEntity.status(409).body(new B1ApiError(
                "CONFLICT", exception.getMessage(), false, Instant.now()
        ));
    }
}
