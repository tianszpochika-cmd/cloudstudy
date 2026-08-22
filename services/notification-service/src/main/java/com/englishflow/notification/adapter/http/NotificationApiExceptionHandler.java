package com.englishflow.notification.adapter.http;

import com.englishflow.notification.domain.NotificationDomainException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public final class NotificationApiExceptionHandler {

    @ExceptionHandler(NotificationDomainException.class)
    ResponseEntity<ApiError> handle(NotificationDomainException exception) {
        return ResponseEntity.status(status(exception.code()))
                .body(new ApiError(exception.code().name(), exception.getMessage()));
    }

    @ExceptionHandler(IllegalArgumentException.class)
    ResponseEntity<ApiError> handle(IllegalArgumentException exception) {
        return ResponseEntity.badRequest().body(new ApiError("INVALID_ARGUMENT", "request is invalid"));
    }

    private static HttpStatus status(NotificationDomainException.Code code) {
        return switch (code) {
            case UNAUTHORIZED -> HttpStatus.UNAUTHORIZED;
            case FORBIDDEN -> HttpStatus.FORBIDDEN;
            case NOT_FOUND -> HttpStatus.NOT_FOUND;
            case IDEMPOTENCY_CONFLICT, VERSION_CONFLICT, SEQUENCE_CONFLICT,
                    RETRY_EXHAUSTED, RECOVERY_NOT_ALLOWED, RETRY_NOT_DUE, TERMINAL_FAILURE -> HttpStatus.CONFLICT;
            case STORAGE_FULL, NETWORK_UNAVAILABLE -> HttpStatus.SERVICE_UNAVAILABLE;
            case PERMISSION_DENIED -> HttpStatus.FORBIDDEN;
            default -> HttpStatus.BAD_REQUEST;
        };
    }

    public record ApiError(String code, String message) {
    }
}
