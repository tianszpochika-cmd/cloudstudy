package com.englishflow.media.security;

import java.io.IOException;
import java.util.Locale;
import java.util.Set;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import org.springframework.web.filter.OncePerRequestFilter;

/** Client-supplied tenant, owner and role values are rejected, never promoted to security facts. */
public final class MediaAuthorityAttemptFilter extends OncePerRequestFilter {

    private static final Set<String> REJECTED_HEADERS = Set.of(
            "x-role", "x-b5-role", "x-tenant-id", "x-owner-id", "x-permission");
    private static final Set<String> REJECTED_PARAMETERS = Set.of(
            "tenantId", "ownerId", "tenant_id", "owner_id", "role", "permission", "contentRights");

    private final MediaSecurityErrorWriter errorWriter;

    public MediaAuthorityAttemptFilter(MediaSecurityErrorWriter errorWriter) {
        this.errorWriter = errorWriter;
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain) throws ServletException, IOException {
        if (!request.getRequestURI().startsWith("/actuator/") && containsAuthorityAttempt(request)) {
            errorWriter.write(response, HttpServletResponse.SC_FORBIDDEN,
                    "UNTRUSTED_SECURITY_FACT",
                    "client role, tenant and owner values are not authorization facts");
            return;
        }
        filterChain.doFilter(request, response);
    }

    static boolean containsAuthorityAttempt(HttpServletRequest request) {
        for (String header : REJECTED_HEADERS) {
            if (request.getHeader(header) != null) {
                return true;
            }
        }
        for (String parameter : REJECTED_PARAMETERS) {
            if (request.getParameter(parameter) != null) {
                return true;
            }
        }
        return false;
    }
}
