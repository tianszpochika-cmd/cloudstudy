package com.englishflow.social.security;

import java.io.IOException;
import java.util.Set;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.web.filter.OncePerRequestFilter;

/** Rejects client-supplied identity/authority facts before controller code can see them. */
public final class ClientAuthorityHeaderFilter extends OncePerRequestFilter {

    private static final Set<String> FORBIDDEN_HEADERS = Set.of(
            "x-user-id", "x-subject-id", "x-tenant-id", "x-owner-id", "x-role", "x-b5-role", "x-permission");

    private final SecurityErrorWriter errorWriter;

    public ClientAuthorityHeaderFilter(SecurityErrorWriter errorWriter) {
        this.errorWriter = errorWriter;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        if (request.getRequestURI().startsWith("/actuator/") || "/health".equals(request.getRequestURI())) {
            filterChain.doFilter(request, response);
            return;
        }
        for (String header : FORBIDDEN_HEADERS) {
            String value = request.getHeader(header);
            if (value != null && !value.isBlank()) {
                errorWriter.write(request, response, 403, "UNTRUSTED_CLIENT_FACTS",
                        "identity and authority facts must come from the verified principal");
                return;
            }
        }
        filterChain.doFilter(request, response);
    }
}
