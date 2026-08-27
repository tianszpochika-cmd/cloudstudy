package com.englishflow.learner.web;

import com.englishflow.learner.domain.LearnerAuthorizationException;
import com.englishflow.learner.domain.LearnerDecisionCode;
import com.englishflow.learner.domain.LearnerDomainException;

import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.dao.DataAccessException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/** Stable error mapping; store failures are never converted into empty success data. */
@RestControllerAdvice
public final class LearnerHttpExceptionHandler {

    private static final Logger LOGGER = LoggerFactory.getLogger(LearnerHttpExceptionHandler.class);

    @ExceptionHandler(LearnerAuthorizationException.class)
    ResponseEntity<Map<String, Object>> authorization(LearnerAuthorizationException exception) {
        return response(HttpStatus.FORBIDDEN, exception.code(), exception.getMessage(), false);
    }

    @ExceptionHandler(LearnerDomainException.class)
    ResponseEntity<Map<String, Object>> domain(LearnerDomainException exception) {
        HttpStatus status = switch (exception.code()) {
            case STORE_FAILURE -> HttpStatus.SERVICE_UNAVAILABLE;
            case CONCURRENT_UPDATE, IDEMPOTENCY_CONFLICT -> HttpStatus.CONFLICT;
            case MISSING_PRINCIPAL -> HttpStatus.UNAUTHORIZED;
            default -> HttpStatus.BAD_REQUEST;
        };
        return response(status, exception.code(), exception.getMessage(), exception.retryable());
    }

    @ExceptionHandler({IllegalArgumentException.class, NullPointerException.class})
    ResponseEntity<Map<String, Object>> invalid(RuntimeException exception) {
        return response(HttpStatus.BAD_REQUEST, LearnerDecisionCode.INVALID_CONTEXT, "invalid learner request", false);
    }

    /**
     * Keep owner-schema failures observable and retryable.  Without this
     * boundary Spring emits an opaque 500, which the learner clients correctly
     * render as an unavailable snapshot but gives local operators no cause.
     */
    @ExceptionHandler(DataAccessException.class)
    ResponseEntity<Map<String, Object>> store(DataAccessException exception) {
        LOGGER.error("learner owner-schema request failed", exception);
        return response(HttpStatus.SERVICE_UNAVAILABLE, LearnerDecisionCode.STORE_FAILURE,
                "learner owner data is temporarily unavailable", true);
    }

    private static ResponseEntity<Map<String, Object>> response(
            HttpStatus status,
            Object code,
            String message,
            boolean retryable) {
        return ResponseEntity.status(status).body(Map.of(
                "error", Map.of("code", String.valueOf(code), "message", message, "retryable", retryable)));
    }
}
