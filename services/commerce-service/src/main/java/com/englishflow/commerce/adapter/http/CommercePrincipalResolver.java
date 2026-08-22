package com.englishflow.commerce.adapter.http;

import com.englishflow.commerce.domain.CommerceException;
import com.englishflow.commerce.domain.CommercePrincipal;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Component;

/** Converts only verified JWT claims into the domain principal. */
@Component
public final class CommercePrincipalResolver {
    public CommercePrincipal requireUser(Authentication authentication) {
        JwtAuthenticationToken jwt = requireJwt(authentication);
        String tenant = claim(jwt, "tenant_id");
        if (tenant == null) tenant = claim(jwt, "tenant");
        String subject = jwt.getToken().getSubject();
        if (tenant == null || tenant.isBlank() || subject == null || subject.isBlank()) throw CommerceException.unauthorized();
        return new CommercePrincipal(tenant, subject, authorities(jwt), true, true, false);
    }

    public CommercePrincipal requireWorkload(Authentication authentication) {
        JwtAuthenticationToken jwt = requireJwt(authentication);
        String tenant = claim(jwt, "tenant_id");
        if (tenant == null) tenant = claim(jwt, "tenant");
        String workload = claim(jwt, "client_id");
        if (workload == null) workload = claim(jwt, "azp");
        if (tenant == null || tenant.isBlank() || workload == null || workload.isBlank()) {
            throw CommerceException.unauthorized();
        }
        return new CommercePrincipal(tenant, "workload:" + workload, authorities(jwt), true, true, true);
    }

    private static JwtAuthenticationToken requireJwt(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated() || authentication instanceof AnonymousAuthenticationToken
                || !(authentication instanceof JwtAuthenticationToken jwt)) throw CommerceException.unauthorized();
        return jwt;
    }

    private static String claim(JwtAuthenticationToken jwt, String name) {
        Object value = jwt.getToken().getClaims().get(name);
        return value instanceof String text ? text : null;
    }

    private static Set<String> authorities(JwtAuthenticationToken jwt) {
        return jwt.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                // Spring's default JWT converter prefixes OAuth scopes with
                // SCOPE_. Commerce permissions are expressed without that
                // transport prefix in the domain PEP.
                .map(CommercePrincipalResolver::normalizeAuthority)
                .collect(Collectors.toUnmodifiableSet());
    }

    private static String normalizeAuthority(String authority) {
        if (authority == null) return "";
        if (authority.startsWith("SCOPE_")) return authority.substring("SCOPE_".length());
        if (authority.startsWith("PERM_")) return authority.substring("PERM_".length());
        return authority;
    }
}
