package com.englishflow.platform.template.security;

import java.util.Collection;

import org.springframework.security.authentication.AbstractAuthenticationToken;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;

/** Authentication token created only by the converter after Resource Server JWT validation. */
public final class VerifiedPrincipalAuthenticationToken extends AbstractAuthenticationToken {

    private final VerifiedPrincipal principal;
    private final Jwt credentials;

    VerifiedPrincipalAuthenticationToken(
            VerifiedPrincipal principal,
            Jwt credentials,
            Collection<? extends GrantedAuthority> authorities) {
        super(authorities);
        this.principal = principal;
        this.credentials = credentials;
        super.setAuthenticated(true);
    }

    @Override
    public Object getCredentials() {
        return credentials;
    }

    @Override
    public Object getPrincipal() {
        return principal;
    }

    @Override
    public String getName() {
        return principal.subjectId();
    }
}
