package com.englishflow.iam.auth;

import org.springframework.core.convert.converter.Converter;
import org.springframework.security.authentication.AbstractAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;

import java.util.ArrayList;
import java.util.Collection;
import java.util.List;

/** Converts only claims from a locally verified JWT into service authorities. */
public final class JwtPermissionAuthenticationConverter implements Converter<Jwt, AbstractAuthenticationToken> {
    @Override
    public AbstractAuthenticationToken convert(Jwt jwt) {
        JwtAuthenticationConverter delegate = new JwtAuthenticationConverter();
        List<SimpleGrantedAuthority> authorities = new ArrayList<>();
        add(jwt.getClaim("permissions"), authorities, "PERM_");
        add(jwt.getClaim("roles"), authorities, "ROLE_");
        addScope(jwt.getClaimAsString("scope"), authorities);
        JwtAuthenticationConverter standard = new JwtAuthenticationConverter();
        AbstractAuthenticationToken token = standard.convert(jwt);
        return new org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken(
                jwt, authorities, jwt.getSubject());
    }

    private static void addScope(String scope, List<SimpleGrantedAuthority> target) {
        if (scope == null) return;
        for (String value : scope.split("\\s+")) if (!value.isBlank()) target.add(new SimpleGrantedAuthority("SCOPE_" + value));
    }

    private static void add(Object value, List<SimpleGrantedAuthority> target, String prefix) {
        if (value instanceof Collection<?> values) {
            for (Object item : values) if (item instanceof String string && !string.isBlank()) target.add(new SimpleGrantedAuthority(prefix + string));
        } else if (value instanceof String string) {
            for (String item : string.split("[ ,]+")) if (!item.isBlank()) target.add(new SimpleGrantedAuthority(prefix + item));
        }
    }
}
