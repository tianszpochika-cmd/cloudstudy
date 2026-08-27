package com.englishflow.platform.template.security;

import java.io.IOException;
import java.util.Enumeration;
import java.util.Locale;
import java.util.Set;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import org.springframework.web.filter.OncePerRequestFilter;

/** Rejects client-supplied role/tenant/owner authority attempts at the service boundary. */
public final class ClientAuthorityHeaderFilter extends OncePerRequestFilter {

    private static final Set<String> REJECTED_HEADERS = Set.of(
            "x-role",
            "x-b5-role",
            "x-permission",
            "x-authority",
            "x-tenant-id",
            "x-owner-id",
            "x-authenticated-user",
            "x-authenticated-tenant",
            "tenantid",
            "ownerid");
    private static final Set<String> REJECTED_PARAMETERS = Set.of(
            "tenantid", "ownerid", "role", "permission", "authority", "tenant_id", "owner_id");

    private final SecurityErrorWriter errorWriter;

    public ClientAuthorityHeaderFilter(SecurityErrorWriter errorWriter) {
        this.errorWriter = errorWriter;
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain) throws ServletException, IOException {
        if (!request.getRequestURI().startsWith("/actuator/") && containsAuthorityAttempt(request)) {
            errorWriter.write(
                    response,
                    HttpServletResponse.SC_FORBIDDEN,
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
        Enumeration<String> parameters = request.getParameterNames();
        if (parameters != null) {
            while (parameters.hasMoreElements()) {
                String parameter = parameters.nextElement();
                if (REJECTED_PARAMETERS.contains(parameter.toLowerCase(Locale.ROOT))
                        && request.getParameter(parameter) != null) {
                    return true;
                }
            }
        }
        return false;
    }
}
