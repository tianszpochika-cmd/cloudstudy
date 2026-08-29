package com.englishflow.content.web;

import com.englishflow.content.domain.ContentActor;
import com.englishflow.content.domain.ContentOperationException;

import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.Set;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;

/** Builds a content actor only from a verified resource-server JWT and its authorities. */
public final class VerifiedContentPrincipalFactory {

    private static final String PLATFORM_TENANT = "platform";

    public ContentActor from(Authentication authentication) {
        if (!(authentication instanceof JwtAuthenticationToken token)
                || !authentication.isAuthenticated()) {
            throw ContentOperationException.forbidden(
                    "CONTENT_PRINCIPAL_REQUIRED", "a verified JWT principal is required");
        }
        String subject = token.getToken().getSubject();
        // The subject is the opaque principal identifier issued by the platform IAM.
        // Both generated identifiers and the historical prn_ form are accepted only
        // after this service's resource-server decoder has verified the JWT.
        if (subject == null || !subject.matches("[A-Za-z0-9][A-Za-z0-9._:-]{1,127}")) {
            throw ContentOperationException.forbidden(
                    "CONTENT_PRINCIPAL_INVALID", "verified principal id is missing or invalid");
        }
        Object tenantClaim = token.getToken().getClaims().get("tenant_id");
        if (tenantClaim != null && !PLATFORM_TENANT.equals(String.valueOf(tenantClaim))) {
            throw ContentOperationException.forbidden("CONTENT_TENANT_DENIED", "tenant is outside Phase 1 scope");
        }
        Set<String> roles = new LinkedHashSet<>();
        Set<String> permissions = new LinkedHashSet<>();
        for (GrantedAuthority authority : token.getAuthorities()) {
            String value = authority.getAuthority();
            if (value == null || value.isBlank()) {
                continue;
            }
            if (value.startsWith("ROLE_")) {
                roles.add(value.substring("ROLE_".length()));
            } else {
                permissions.add(value);
            }
        }
        addClaimValues(token.getToken().getClaims().get("roles"), roles);
        addClaimValues(token.getToken().getClaims().get("permissions"), permissions);
        return new ContentActor(subject, PLATFORM_TENANT, roles, permissions, false);
    }

    private static void addClaimValues(Object value, Set<String> target) {
        if (value instanceof Collection<?> values) {
            values.stream().filter(String.class::isInstance).map(String.class::cast).forEach(target::add);
        } else if (value instanceof String string && !string.isBlank()) {
            for (String item : string.split("[ ,]+")) {
                if (!item.isBlank()) {
                    target.add(item);
                }
            }
        }
    }

}
