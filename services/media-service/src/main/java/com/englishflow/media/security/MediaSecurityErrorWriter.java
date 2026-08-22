package com.englishflow.media.security;

import java.io.IOException;

import jakarta.servlet.http.HttpServletResponse;

/** Minimal, token-free JSON error writer for the service boundary. */
public final class MediaSecurityErrorWriter {

    public void write(HttpServletResponse response, int status, String code, String message)
            throws IOException {
        response.setStatus(status);
        response.setContentType("application/problem+json");
        response.setCharacterEncoding("UTF-8");
        response.getWriter().write(
                "{\"type\":\"about:blank\",\"code\":\""
                        + code + "\",\"message\":\"" + message + "\"}");
    }
}
