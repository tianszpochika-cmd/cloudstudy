package com.englishflow.adminops.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.Set;
import org.springframework.web.filter.OncePerRequestFilter;

/** Rejects legacy/client authority headers instead of silently ignoring them. */
public final class ClientAuthorityHeaderFilter extends OncePerRequestFilter {

    private final AdminOpsSecurityErrorWriter errorWriter;

    public ClientAuthorityHeaderFilter(AdminOpsSecurityErrorWriter errorWriter) {
        this.errorWriter = errorWriter;
    }

    private static final Set<String> FORBIDDEN_HEADERS = Set.of(
            "x-role", "x-b5-role", "x-tenant-id", "x-owner-id", "x-user-id");

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain) throws ServletException, IOException {
        for (String header : FORBIDDEN_HEADERS) {
            String value = request.getHeader(header);
            if (value != null && !value.isBlank()) {
                errorWriter.write(
                        request, response, HttpServletResponse.SC_BAD_REQUEST,
                        "CLIENT_AUTHORITY_HEADER_REJECTED", "client authority headers are not accepted");
                return;
            }
        }
        filterChain.doFilter(request, response);
    }
}
