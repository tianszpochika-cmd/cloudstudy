package com.englishflow.social.security;

import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

import org.springframework.core.convert.converter.Converter;
import org.springframework.security.authentication.BadCredentialsException;
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
        if (tenant == null || tenant.isBlank() || !SocialPrincipal.PLATFORM_TENANT.equals(tenant)) {
            // Phase 1 has a single platform tenant: a missing or foreign claim must never be
            // silently replaced with the platform scope.
            throw new BadCredentialsException("verified IAM principal is missing the platform tenant scope");
        }
        String phase = firstString(jwt, "phase", "phase_code");
        boolean consent = booleanClaim(jwt, "consent_granted")
                || "GRANTED".equalsIgnoreCase(firstString(jwt, "consent_state", "consentState", "consent"));
        boolean active = "ACTIVE".equalsIgnoreCase(firstString(jwt, "account_status", "accountStatus"))
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
