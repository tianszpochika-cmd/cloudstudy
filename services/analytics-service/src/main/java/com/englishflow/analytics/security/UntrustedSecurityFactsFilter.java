package com.englishflow.analytics.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.Enumeration;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import org.springframework.web.filter.OncePerRequestFilter;

/** Client role/tenant/owner/workload values are rejected, never treated as authorization facts. */
public final class UntrustedSecurityFactsFilter extends OncePerRequestFilter {

    private static final Set<String> REJECTED_HEADERS = Set.of(
            "x-role", "x-b5-role", "x-tenant-id", "x-owner-id", "x-user-id", "x-principal-id",
            "x-permission", "x-authority", "x-workload-identity", "x-service-name",
            "x-forwarded-client-cert", "x-forwarded-client-cert-info", "x-ssl-client-cert",
            "x-ssl-client-subject-dn");
    private static final Set<String> REJECTED_PARAMETERS = Set.of(
            "role", "permission", "authority", "tenantid", "ownerid", "tenant_id", "owner_id");

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
            FilterChain filterChain) throws ServletException, IOException {
        if (containsAuthorityAttempt(request)) {
            response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            response.setContentType("application/json");
            response.getWriter().write(
                    "{\"code\":\"UNTRUSTED_SECURITY_HEADER\",\"message\":\"security headers are not accepted\"}");
            return;
        }
        filterChain.doFilter(request, response);
    }

    static boolean containsAuthorityAttempt(HttpServletRequest request) {
        Enumeration<String> headers = request.getHeaderNames();
        if (headers != null) {
            while (headers.hasMoreElements()) {
                String name = headers.nextElement();
                if (REJECTED_HEADERS.contains(name.toLowerCase(Locale.ROOT)) && request.getHeader(name) != null) {
                    return true;
                }
            }
        }
        Enumeration<String> parameters = request.getParameterNames();
        if (parameters != null) {
            while (parameters.hasMoreElements()) {
                String name = parameters.nextElement();
                if (REJECTED_PARAMETERS.contains(name.toLowerCase(Locale.ROOT))
                        && request.getParameter(name) != null) {
                    return true;
                }
            }
        }
        return false;
    }
}
