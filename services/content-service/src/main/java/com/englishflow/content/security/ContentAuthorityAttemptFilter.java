package com.englishflow.content.security;

import java.io.IOException;
import java.util.Locale;
import java.util.Set;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import org.springframework.web.filter.OncePerRequestFilter;

/** Client role/tenant/owner values are rejected rather than treated as authorization facts. */
public final class ContentAuthorityAttemptFilter extends OncePerRequestFilter {

    private static final Set<String> REJECTED_HEADERS = Set.of(
            "x-role", "x-b5-role", "x-permission", "x-authority", "x-tenant-id", "x-owner-id",
            "x-workload-identity", "x-service-name", "x-forwarded-client-cert",
            "x-forwarded-client-cert-info", "x-ssl-client-cert", "x-ssl-client-subject-dn");
    private static final Set<String> REJECTED_PARAMETERS = Set.of(
            "tenantId", "ownerId", "tenant_id", "owner_id", "role", "permission", "authority");

    private final ContentSecurityErrorWriter errorWriter;

    public ContentAuthorityAttemptFilter(ContentSecurityErrorWriter errorWriter) {
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
        java.util.Enumeration<String> headers = request.getHeaderNames();
        while (headers != null && headers.hasMoreElements()) {
            String name = headers.nextElement();
            if (REJECTED_HEADERS.contains(name.toLowerCase(Locale.ROOT)) && request.getHeader(name) != null) {
                return true;
            }
        }
        java.util.Enumeration<String> parameters = request.getParameterNames();
        while (parameters != null && parameters.hasMoreElements()) {
            String name = parameters.nextElement();
            if (REJECTED_PARAMETERS.contains(name.toLowerCase(Locale.ROOT)) && request.getParameter(name) != null) {
                return true;
            }
        }
        return false;
    }
}
