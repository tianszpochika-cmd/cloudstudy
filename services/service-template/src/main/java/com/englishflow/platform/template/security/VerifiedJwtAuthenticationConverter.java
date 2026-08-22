package com.englishflow.platform.template.security;

import java.util.ArrayList;
import java.util.Collection;
import java.util.List;

import org.springframework.core.convert.converter.Converter;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtGrantedAuthoritiesConverter;

/**
 * Converts a decoder-verified JWT into the immutable principal used by the PEP.
 *
 * <p>There is intentionally no converter from request headers, query parameters or arbitrary
 * maps. If the Resource Server is disabled, this converter is never on an authentication path.</p>
 */
public final class VerifiedJwtAuthenticationConverter
        implements Converter<Jwt, VerifiedPrincipalAuthenticationToken> {

    private final JwtGrantedAuthoritiesConverter standardAuthorities = new JwtGrantedAuthoritiesConverter();

    @Override
    public VerifiedPrincipalAuthenticationToken convert(Jwt jwt) {
        VerifiedPrincipal principal = VerifiedPrincipal.fromVerifiedJwt(jwt);
        Collection<GrantedAuthority> authorities = new ArrayList<>(standardAuthorities.convert(jwt));
        principal.claims().roles().stream()
                .map(role -> new SimpleGrantedAuthority("ROLE_" + role))
                .forEach(authorities::add);
        principal.claims().permissions().stream()
                .map(permission -> new SimpleGrantedAuthority("PERM_" + permission))
                .forEach(authorities::add);
        return new VerifiedPrincipalAuthenticationToken(principal, jwt, List.copyOf(authorities));
    }
}
