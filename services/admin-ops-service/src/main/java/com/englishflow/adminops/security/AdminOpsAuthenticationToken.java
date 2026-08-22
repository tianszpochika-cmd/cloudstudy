package com.englishflow.adminops.security;

import java.util.Collection;

import com.englishflow.adminops.domain.AdminPrincipal;
import org.springframework.security.authentication.AbstractAuthenticationToken;
import org.springframework.security.core.GrantedAuthority;

/** Authentication token created only after Resource Server JWT verification. */
public final class AdminOpsAuthenticationToken extends AbstractAuthenticationToken {

    private final AdminPrincipal principal;
    private final Object credentials;

    public AdminOpsAuthenticationToken(
            AdminPrincipal principal,
            Object credentials,
            Collection<? extends GrantedAuthority> authorities) {
        super(authorities);
        this.principal = principal;
        this.credentials = credentials;
        super.setAuthenticated(true);
    }

    public AdminPrincipal adminPrincipal() {
        return principal;
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
