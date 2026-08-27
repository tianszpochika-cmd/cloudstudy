package com.englishflow.gamification.adapter.http;

import com.englishflow.gamification.domain.GamificationDomainException;
import com.englishflow.gamification.domain.GamificationPersistenceException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public final class GamificationApiExceptionHandler {

    @ExceptionHandler(GamificationDomainException.class)
    ResponseEntity<ApiError> handle(GamificationDomainException exception) {
        return ResponseEntity.status(status(exception.code()))
                .body(new ApiError(exception.code().name(), exception.getMessage()));
    }

    @ExceptionHandler(GamificationPersistenceException.class)
    ResponseEntity<ApiError> handle(GamificationPersistenceException exception) {
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                .body(new ApiError("PERSISTENCE_UNAVAILABLE", exception.getMessage()));
    }

    @ExceptionHandler(IllegalArgumentException.class)
    ResponseEntity<ApiError> handle(IllegalArgumentException exception) {
        return ResponseEntity.badRequest().body(new ApiError("INVALID_ARGUMENT", "request is invalid"));
    }

    private static HttpStatus status(GamificationDomainException.Code code) {
        return switch (code) {
            case UNAUTHORIZED -> HttpStatus.UNAUTHORIZED;
            case FORBIDDEN -> HttpStatus.FORBIDDEN;
            case NOT_FOUND -> HttpStatus.NOT_FOUND;
            case IDEMPOTENCY_CONFLICT, EVENT_CONFLICT, LEDGER_INVARIANT -> HttpStatus.CONFLICT;
            case INVALID_ARGUMENT, INVALID_EVENT, UNTRUSTED_FIELD -> HttpStatus.BAD_REQUEST;
        };
    }

    public record ApiError(String code, String message) {
    }
}
