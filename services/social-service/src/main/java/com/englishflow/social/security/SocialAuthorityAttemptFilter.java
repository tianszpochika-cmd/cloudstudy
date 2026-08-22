package com.englishflow.social.security;

import java.io.IOException;
import java.util.Locale;
import java.util.Set;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import org.springframework.web.filter.OncePerRequestFilter;

/** Rejects client-supplied identity, tenant, owner and role facts before controller dispatch. */
public final class SocialAuthorityAttemptFilter extends OncePerRequestFilter {

    private static final Set<String> REJECTED_HEADERS = Set.of(
            "x-user-id", "x-subject-id", "x-tenant-id", "x-owner-id", "x-role", "x-b5-role");
    private static final Set<String> REJECTED_PARAMETERS = Set.of(
            "userId", "subjectId", "tenantId", "ownerId", "role");

    private final SocialSecurityErrorWriter errorWriter;

    public SocialAuthorityAttemptFilter(SocialSecurityErrorWriter errorWriter) {
        this.errorWriter = errorWriter;
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain) throws ServletException, IOException {
        if (!request.getRequestURI().startsWith("/actuator/") && containsAuthorityAttempt(request)) {
            errorWriter.write(request, response, HttpServletResponse.SC_FORBIDDEN,
                    "SOC_UNTRUSTED_SECURITY_FACT", "client identity and authority fields are not authorization facts");
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
