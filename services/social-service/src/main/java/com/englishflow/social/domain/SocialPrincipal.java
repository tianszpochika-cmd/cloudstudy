package com.englishflow.social.domain;

import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.Locale;
import java.util.Set;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;

/**
 * Identity assembled from a decoder-verified JWT or a server-side test fixture.
 * Tenant is deliberately derived as {@code platform} for Phase 1; request fields
 * and untrusted tenant claims never populate this record.
 */
public record SocialPrincipal(
        String subjectId,
        String tenantId,
        Set<String> permissions,
        String workloadId) {

    public SocialPrincipal {
        if (subjectId == null || subjectId.isBlank()) {
            throw SocialDomainException.unauthenticated();
        }
        if (tenantId == null || tenantId.isBlank()) {
            throw SocialDomainException.forbidden("SOC_TENANT_MISSING", "server tenant scope is missing");
        }
        permissions = normalize(permissions);
        if (workloadId != null && workloadId.isBlank()) {
            workloadId = null;
        }
    }

    public boolean hasPermission(String permission) {
        return permissions.contains(permission);
    }

    public boolean isWorkload() {
        return workloadId != null;
    }

    public static SocialPrincipal fromAuthentication(Authentication authentication) {
        if (!(authentication instanceof JwtAuthenticationToken jwtAuthentication)
                || !authentication.isAuthenticated()) {
            throw SocialDomainException.unauthenticated();
        }
        return fromJwt(jwtAuthentication.getToken(), authentication.getAuthorities());
    }

    public static SocialPrincipal fromJwt(Jwt jwt, Collection<? extends GrantedAuthority> authorities) {
        String subject = jwt.getSubject();
        if (subject == null || subject.isBlank()) {
            throw SocialDomainException.unauthenticated();
        }
        LinkedHashSet<String> permissions = new LinkedHashSet<>();
        addClaimValues(permissions, jwt.getClaims().get("permissions"));
        addClaimValues(permissions, jwt.getClaims().get("scope"));
        if (authorities != null) {
            for (GrantedAuthority authority : authorities) {
                String value = authority == null ? null : authority.getAuthority();
                if (value == null || value.isBlank()) {
                    continue;
                }
                if (value.startsWith("SCOPE_")) {
                    permissions.add(value.substring("SCOPE_".length()));
                } else if (value.startsWith("PERM_")) {
                    permissions.add(value.substring("PERM_".length()));
                }
            }
        }
        String workload = claimString(jwt, "azp");
        // Phase 1 tenant is a service-derived platform scope. A tenant_id claim is not trusted here.
        return new SocialPrincipal(subject, "platform", permissions, workload);
    }

    /** Server-side fixture factory used by pure domain smoke tests, never by HTTP adapters. */
    public static SocialPrincipal testUser(String subjectId, String tenantId, String... permissions) {
        return new SocialPrincipal(subjectId, tenantId, Set.of(permissions), null);
    }

    /** Server-side workload fixture for trusted-event consumer tests. */
    public static SocialPrincipal trustedWorkload(String sourceService, String tenantId, String... permissions) {
        return new SocialPrincipal("workload:" + sourceService, tenantId, Set.of(permissions), sourceService);
    }

    private static Set<String> normalize(Set<String> values) {
        LinkedHashSet<String> result = new LinkedHashSet<>();
        if (values != null) {
            for (String value : values) {
                if (value != null && !value.isBlank()) {
                    result.add(value.trim());
                }
            }
        }
        return Set.copyOf(result);
    }

    private static void addClaimValues(Set<String> target, Object value) {
        if (value instanceof Collection<?> values) {
            for (Object item : values) {
                if (item != null && !item.toString().isBlank()) {
                    target.add(item.toString().trim());
                }
            }
            return;
        }
        if (value != null) {
            for (String item : value.toString().split("[ ,]+")) {
                if (!item.isBlank()) {
                    target.add(item.trim());
                }
            }
        }
    }

    private static String claimString(Jwt jwt, String name) {
        Object value = jwt.getClaims().get(name);
        return value == null ? null : value.toString().trim().toLowerCase(Locale.ROOT);
    }
}
