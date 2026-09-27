package com.englishflow.learning.adapter.http;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;

/** Verified caller JWT for service-to-service forwarding (Phase 1 interim). */
public final class BearerTokens {
    private BearerTokens() {
    }

    public static String current() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication instanceof JwtAuthenticationToken jwt && jwt.isAuthenticated()
                && jwt.getToken().getTokenValue() != null && !jwt.getToken().getTokenValue().isBlank()) {
            return jwt.getToken().getTokenValue();
        }
        return null;
    }

    public static String current(Authentication authentication) {
        if (authentication instanceof JwtAuthenticationToken jwt && jwt.isAuthenticated()
                && jwt.getToken().getTokenValue() != null && !jwt.getToken().getTokenValue().isBlank()) {
            return jwt.getToken().getTokenValue();
        }
        return current();
    }
}
