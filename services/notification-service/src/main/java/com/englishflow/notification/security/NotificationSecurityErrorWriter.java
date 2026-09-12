package com.englishflow.notification.security;

import java.io.IOException;

import jakarta.servlet.http.HttpServletResponse;

import tools.jackson.databind.ObjectMapper;

/** Canonical JSON error envelope for notification-service 401/403 boundary responses. */
public final class NotificationSecurityErrorWriter {

    private final ObjectMapper objectMapper;

    public NotificationSecurityErrorWriter(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    public void write(HttpServletResponse response, int status, String code, String message) throws IOException {
        response.setStatus(status);
        response.setContentType("application/json");
        objectMapper.writeValue(response.getWriter(), new ErrorEnvelope(code, message));
    }

    private record ErrorEnvelope(String code, String message) {
    }
}
