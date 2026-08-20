package com.englishflow.modules.user.controller;

import java.util.Map;
import java.util.UUID;

import com.englishflow.modules.user.UserModuleException;
import com.englishflow.modules.user.api.UserErrorResponse;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public final class UserExceptionHandler {
    @ExceptionHandler(UserModuleException.class)
    public ResponseEntity<UserErrorResponse> handle(UserModuleException exception, HttpServletRequest request) {
        String requestId = request.getHeader("X-Request-Id");
        if (requestId == null || !requestId.matches("[A-Za-z][A-Za-z0-9._-]{7,127}")) requestId = "req_" + UUID.randomUUID().toString().replace("-", "").substring(0, 16);
        return ResponseEntity.status(exception.httpStatus()).body(new UserErrorResponse(requestId,
                new UserErrorResponse.ErrorBody(exception.code(), exception.getMessage(), Map.of(), exception.retryable())));
    }
}
