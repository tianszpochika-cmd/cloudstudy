package com.englishflow.adminops.security;

import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

import com.englishflow.adminops.domain.AdminPrincipal;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.core.convert.converter.Converter;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtGrantedAuthoritiesConverter;

/** Converts only a decoder-verified JWT into the domain principal and authorities. */
public final class AdminOpsJwtAuthenticationConverter implements Converter<Jwt, AdminOpsAuthenticationToken> {

    private final JwtGrantedAuthoritiesConverter standardAuthorities = new JwtGrantedAuthoritiesConverter();

    @Override
    public AdminOpsAuthenticationToken convert(Jwt jwt) {
        String subject = jwt.getSubject();
        String tenant = firstString(jwt, "tenant_id", "tenant");
        if (tenant == null || tenant.isBlank() || !"platform".equals(tenant)) {
            throw new BadCredentialsException("verified IAM principal is missing the platform tenant scope");
        }
        Set<String> permissions = new LinkedHashSet<>(claimStrings(jwt.getClaim("permissions")));
        permissions.addAll(claimStrings(jwt.getClaim("scp")));
        permissions.addAll(claimStrings(jwt.getClaim("scope")));
        Set<String> roles = new LinkedHashSet<>(claimStrings(jwt.getClaim("roles")));
        Collection<GrantedAuthority> authorities = new ArrayList<>();
        Collection<GrantedAuthority> standard = standardAuthorities.convert(jwt);
        if (standard != null) {
            authorities.addAll(standard);
        }
        permissions.forEach(permission -> authorities.add(new SimpleGrantedAuthority("PERM_" + permission)));
        roles.forEach(role -> authorities.add(new SimpleGrantedAuthority("ROLE_" + role)));
        AdminPrincipal principal = new AdminPrincipal(subject, tenant, permissions, roles, null);
        return new AdminOpsAuthenticationToken(principal, jwt, List.copyOf(authorities));
    }

    private static String firstString(Jwt jwt, String... names) {
        for (String name : names) {
            String value = jwt.getClaimAsString(name);
            if (value != null && !value.isBlank()) {
                return value.trim();
            }
        }
        return null;
    }

    private static Set<String> claimStrings(Object value) {
        LinkedHashSet<String> result = new LinkedHashSet<>();
        if (value instanceof Collection<?> collection) {
            collection.forEach(item -> add(result, item));
        } else if (value != null) {
            for (String item : value.toString().split("[\\s,]+")) {
                add(result, item);
            }
        }
        return result;
    }

    private static void add(Set<String> target, Object value) {
        if (value != null && !value.toString().isBlank()) {
            target.add(value.toString().trim());
        }
    }
}
