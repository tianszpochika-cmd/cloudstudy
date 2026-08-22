package com.englishflow.content.security;

import java.io.IOException;

import jakarta.servlet.http.HttpServletResponse;

import org.springframework.http.MediaType;

/** Bounded 401/403 envelope without logging tokens or request bodies. */
public final class ContentSecurityErrorWriter {

    public void write(HttpServletResponse response, int status, String code, String message)
            throws IOException {
        response.setStatus(status);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.getWriter().write("{\"error\":{\"code\":\"" + code
                + "\",\"message\":\"" + message + "\"}}");
    }
}
