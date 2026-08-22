package com.englishflow.gamification.adapter.http;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.List;
import org.springframework.web.filter.OncePerRequestFilter;

/** Rejects legacy/client security headers before a controller can observe them. */
public final class UntrustedSecurityFactsFilter extends OncePerRequestFilter {

    private static final List<String> REJECTED_HEADERS = List.of(
            "X-Role", "X-B5-Role", "X-Tenant-Id", "X-Owner-Id", "X-User-Id");

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
            FilterChain filterChain) throws ServletException, IOException {
        for (String header : REJECTED_HEADERS) {
            if (request.getHeader(header) != null) {
                response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
                response.setContentType("application/json");
                response.getWriter().write("{\"code\":\"UNTRUSTED_SECURITY_HEADER\",\"message\":\"security headers are not accepted\"}");
                return;
            }
        }
        filterChain.doFilter(request, response);
    }
}
