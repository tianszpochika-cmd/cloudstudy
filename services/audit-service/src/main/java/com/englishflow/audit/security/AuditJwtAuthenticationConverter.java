package com.englishflow.audit.security;

import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.Set;

import org.springframework.core.convert.converter.Converter;
import org.springframework.security.authentication.AbstractAuthenticationToken;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;

public final class AuditJwtAuthenticationConverter implements Converter<Jwt, AbstractAuthenticationToken> {

    @Override
    public AbstractAuthenticationToken convert(Jwt jwt) {
        Set<GrantedAuthority> authorities = new LinkedHashSet<>();
        for (String permission : strings(jwt.getClaim("permissions"))) {
            authorities.add(new SimpleGrantedAuthority(permission));
        }
        for (String role : strings(jwt.getClaim("roles"))) {
            authorities.add(new SimpleGrantedAuthority("ROLE_" + role));
        }
        for (String scope : strings(jwt.getClaim("scope"))) {
            for (String value : scope.split(" ")) {
                if (!value.isBlank()) authorities.add(new SimpleGrantedAuthority("SCOPE_" + value));
            }
        }
        return new JwtAuthenticationToken(jwt, authorities, jwt.getSubject());
    }

    public static Set<String> strings(Object claim) {
        if (claim instanceof String text) {
            return text.isBlank() ? Set.of() : Set.of(text);
        }
        if (claim instanceof Collection<?> collection) {
            Set<String> values = new LinkedHashSet<>();
            for (Object item : collection) {
                if (item instanceof String value && !value.isBlank()) values.add(value);
            }
            return Set.copyOf(values);
        }
        return Set.of();
    }
}
