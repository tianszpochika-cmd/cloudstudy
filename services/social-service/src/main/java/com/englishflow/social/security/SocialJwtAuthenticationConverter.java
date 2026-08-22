package com.englishflow.social.security;

import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

import org.springframework.core.convert.converter.Converter;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtGrantedAuthoritiesConverter;

/** Converts only a decoder-verified JWT into the social service principal. */
public final class SocialJwtAuthenticationConverter implements Converter<Jwt, SocialAuthenticationToken> {

    private final JwtGrantedAuthoritiesConverter standardAuthorities = new JwtGrantedAuthoritiesConverter();

    @Override
    public SocialAuthenticationToken convert(Jwt jwt) {
        String subject = jwt.getSubject();
        String tenant = firstString(jwt, "tenant_id", "tenant");
        if (tenant == null || tenant.isBlank()) {
            tenant = SocialPrincipal.PLATFORM_TENANT;
        }
        String phase = firstString(jwt, "phase", "phase_code");
        boolean consent = booleanClaim(jwt, "consent_granted") || "GRANTED".equals(jwt.getClaimAsString("consent"));
        boolean active = "ACTIVE".equals(jwt.getClaimAsString("account_status"))
                || Boolean.TRUE.equals(jwt.getClaim("active"));
        boolean revoked = Boolean.TRUE.equals(jwt.getClaim("revoked"))
                || "REVOKED".equals(jwt.getClaimAsString("revocation_status"));

        Set<String> permissions = new LinkedHashSet<>(claimStrings(jwt.getClaim("permissions")));
        permissions.addAll(claimStrings(jwt.getClaim("scp")));
        permissions.addAll(claimStrings(jwt.getClaim("scope")));

        Set<String> roles = new LinkedHashSet<>(claimStrings(jwt.getClaim("roles")));
        SocialPrincipal principal = new SocialPrincipal(
                subject,
                tenant,
                phase == null ? "" : phase,
                consent,
                active,
                revoked,
                permissions,
                roles);

        Collection<GrantedAuthority> authorities = new ArrayList<>();
        Collection<GrantedAuthority> standard = standardAuthorities.convert(jwt);
        if (standard != null) {
            authorities.addAll(standard);
        }
        permissions.forEach(permission -> authorities.add(new SimpleGrantedAuthority("PERM_" + permission)));
        roles.forEach(role -> authorities.add(new SimpleGrantedAuthority("ROLE_" + role)));
        return new SocialAuthenticationToken(principal, jwt, List.copyOf(authorities));
    }

    private static String firstString(Jwt jwt, String... names) {
        for (String name : names) {
            String value = jwt.getClaimAsString(name);
            if (value != null && !value.isBlank()) {
                return value;
            }
        }
        return null;
    }

    private static boolean booleanClaim(Jwt jwt, String name) {
        Object value = jwt.getClaim(name);
        return Boolean.TRUE.equals(value) || "true".equalsIgnoreCase(String.valueOf(value));
    }

    private static Set<String> claimStrings(Object value) {
        if (value instanceof Collection<?> collection) {
            return collection.stream().map(String::valueOf).filter(valueText -> !valueText.isBlank()).collect(java.util.stream.Collectors.toCollection(LinkedHashSet::new));
        }
        if (value instanceof String string && !string.isBlank()) {
            return Set.of(string.split("\\s+"));
        }
        return Set.of();
    }
}
