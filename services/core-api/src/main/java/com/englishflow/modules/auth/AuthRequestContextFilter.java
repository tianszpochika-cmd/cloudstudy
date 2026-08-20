package com.englishflow.modules.auth;

import java.time.Instant;

import com.englishflow.modules.user.UserRequestContext;
import com.englishflow.modules.user.api.RequestAttributeUserContextResolver;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/** Binds only server-validated bearer credentials to downstream user APIs. */
@Component
public final class AuthRequestContextFilter extends OncePerRequestFilter {

    private final B1AuthService authService;

    public AuthRequestContextFilter(B1AuthService authService) {
        this.authService = authService;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getRequestURI();
        return "OPTIONS".equalsIgnoreCase(request.getMethod())
                || path.endsWith("/health")
                || path.contains("/actuator/")
                || path.endsWith("/auth/sms/send-code")
                || path.endsWith("/auth/login/phone")
                || path.endsWith("/auth/register")
                || path.endsWith("/auth/refresh");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, java.io.IOException {
        String authorization = request.getHeader("Authorization");
        if (authorization != null && authorization.startsWith("Bearer ")) {
            String raw = authorization.substring("Bearer ".length()).trim();
            if (raw.isEmpty()) throw AuthException.required();
            B1AuthService.AuthPrincipal principal = authService.resolveAccessToken(raw, Instant.now());
            String requestId = request.getHeader("X-Request-Id");
            String traceId = request.getHeader("X-Trace-Id");
            RequestAttributeUserContextResolver.bind(request, new UserRequestContext(
                    B1AuthService.DEFAULT_TENANT, principal.userId(), principal.deviceId(), requestId, traceId));
        }
        filterChain.doFilter(request, response);
    }
}
