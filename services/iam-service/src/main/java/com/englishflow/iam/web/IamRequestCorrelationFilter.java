package com.englishflow.iam.web;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.UUID;

/**
 * Keeps the IAM audit record correlated with the request that caused it.
 * Invalid client-supplied values are replaced instead of being trusted.
 */
@Component
public final class IamRequestCorrelationFilter extends OncePerRequestFilter {

    static final String REQUEST_ID = "X-Request-Id";
    static final String TRACE_ID = "X-Trace-Id";

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain) throws ServletException, IOException {
        String requestId = bounded(request.getHeader(REQUEST_ID), 128);
        String traceId = bounded(request.getHeader(TRACE_ID), 128);
        IamRequestCorrelationContext.set(requestId, traceId);
        response.setHeader(REQUEST_ID, requestId);
        response.setHeader(TRACE_ID, traceId);
        response.setHeader("X-API-Version", "v1");
        try {
            filterChain.doFilter(request, response);
        } finally {
            IamRequestCorrelationContext.clear();
        }
    }

    private static String bounded(String value, int maxLength) {
        if (value == null || value.isBlank() || value.length() > maxLength
                || value.chars().anyMatch(Character::isISOControl)) {
            return UUID.randomUUID().toString();
        }
        return value;
    }
}
