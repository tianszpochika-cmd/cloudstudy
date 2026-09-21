package com.englishflow.learner.web;

import com.englishflow.learner.domain.LearnerAuthorizationException;
import com.englishflow.learner.domain.LearnerDecisionCode;
import com.englishflow.learner.security.LearnerJwtAuthenticationConverter;

import java.util.Set;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.server.ResponseStatusException;

/**
 * Tenant-admin JWT boundary. Reads roles/permissions from the already verified
 * JWT only; the target learner subject always comes from the path.
 */
public final class LearnerAdminPrincipals {

    public record AdminPrincipal(String subjectId, Set<String> roles, Set<String> permissions) {
    }

    private LearnerAdminPrincipals() {
    }

    public static AdminPrincipal requireRead(Authentication authentication) {
        return require(authentication, "admin.learner.read");
    }

    public static AdminPrincipal requireWrite(Authentication authentication) {
        return require(authentication, "admin.learner.write");
    }

    private static AdminPrincipal require(Authentication authentication, String permission) {
        if (!(authentication instanceof JwtAuthenticationToken jwt) || !jwt.isAuthenticated()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "verified JWT principal is required");
        }
        Jwt token = jwt.getToken();
        if (!"platform".equals(token.getClaimAsString("tenant_id"))) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "tenant is not allowed");
        }
        Set<String> roles = LearnerJwtAuthenticationConverter.strings(token.getClaim("roles"));
        Set<String> permissions = LearnerJwtAuthenticationConverter.strings(token.getClaim("permissions"));
        boolean admin = roles.contains("platform-admin") || roles.contains("tenant-admin")
                || permissions.contains(permission);
        if (!admin) {
            throw new LearnerAuthorizationException(LearnerDecisionCode.PERMISSION_DENIED);
        }
        String subject = token.getSubject();
        if (subject == null || subject.isBlank()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "verified principal id is missing");
        }
        return new AdminPrincipal(subject, roles, permissions);
    }
}
