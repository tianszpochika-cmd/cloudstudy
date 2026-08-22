package com.englishflow.social.security;

import java.util.Collection;

import org.springframework.security.authentication.AbstractAuthenticationToken;
import org.springframework.security.core.GrantedAuthority;

/** Authentication token created only after a Resource Server JWT has been verified. */
public final class SocialAuthenticationToken extends AbstractAuthenticationToken {

    private final SocialPrincipal principal;
    private final Object credentials;

    public SocialAuthenticationToken(
            SocialPrincipal principal,
            Object credentials,
            Collection<? extends GrantedAuthority> authorities) {
        super(authorities);
        this.principal = principal;
        this.credentials = credentials;
        super.setAuthenticated(true);
    }

    public static SocialAuthenticationToken fromVerifiedPrincipal(SocialPrincipal principal) {
        return new SocialAuthenticationToken(principal, null, principal.permissions().stream()
                .map(permission -> (GrantedAuthority) () -> "PERM_" + permission)
                .toList());
    }

    public SocialPrincipal socialPrincipal() {
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
