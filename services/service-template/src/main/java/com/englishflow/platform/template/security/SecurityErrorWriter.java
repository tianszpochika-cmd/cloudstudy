package com.englishflow.platform.template.security;

import java.io.IOException;

import tools.jackson.databind.ObjectMapper;
import com.englishflow.platform.template.observability.RequestContext;

import jakarta.servlet.http.HttpServletResponse;

import org.springframework.http.MediaType;

/** Writes bounded 401/403 envelopes without exposing token, query or resource details. */
public final class SecurityErrorWriter {

    private final ObjectMapper objectMapper;

    public SecurityErrorWriter(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    public void write(HttpServletResponse response, int status, String code, String message) throws IOException {
        response.setStatus(status);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding("UTF-8");
        String requestId = RequestContext.current().map(RequestContext::requestId).orElse(null);
        objectMapper.writeValue(response.getWriter(), new SecurityErrorEnvelope(code, message, requestId));
    }
}
