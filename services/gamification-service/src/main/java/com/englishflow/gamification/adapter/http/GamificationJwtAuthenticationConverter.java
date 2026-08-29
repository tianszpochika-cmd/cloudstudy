package com.englishflow.gamification.adapter.http;

import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

import org.springframework.core.convert.converter.Converter;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.security.oauth2.server.resource.authentication.JwtGrantedAuthoritiesConverter;

/** Maps provider-signed permission claims to authorities used by the service PEP. */
public final class GamificationJwtAuthenticationConverter
        implements Converter<Jwt, JwtAuthenticationToken> {

    private final JwtGrantedAuthoritiesConverter standardAuthorities = new JwtGrantedAuthoritiesConverter();

    @Override
    public JwtAuthenticationToken convert(Jwt jwt) {
        Collection<GrantedAuthority> authorities = new ArrayList<>();
        Collection<GrantedAuthority> standard = standardAuthorities.convert(jwt);
        if (standard != null) {
            authorities.addAll(standard);
        }
        claimValues(jwt.getClaim("permissions")).stream()
                .map(permission -> new SimpleGrantedAuthority("PERM_" + permission))
                .forEach(authorities::add);
        claimValues(jwt.getClaim("roles")).stream()
                .map(role -> new SimpleGrantedAuthority("ROLE_" + role))
                .forEach(authorities::add);
        return new JwtAuthenticationToken(jwt, List.copyOf(authorities));
    }

    private static Set<String> claimValues(Object value) {
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
