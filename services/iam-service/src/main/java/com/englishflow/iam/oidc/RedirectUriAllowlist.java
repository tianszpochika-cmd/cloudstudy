package com.englishflow.iam.oidc;

import com.englishflow.iam.domain.IamDecisionCode;
import com.englishflow.iam.domain.IamPolicyException;

import java.net.URI;
import java.util.Set;
import java.util.stream.Collectors;

/** Exact redirect allowlist. Wildcards, fragments and implicit origin matching are not allowed. */
public final class RedirectUriAllowlist {

    private final Set<String> allowed;

    public RedirectUriAllowlist(Set<URI> allowedRedirectUris) {
        if (allowedRedirectUris == null || allowedRedirectUris.isEmpty()) {
            throw new IllegalArgumentException("at least one redirect URI is required");
        }
        this.allowed = allowedRedirectUris.stream()
                .map(RedirectUriAllowlist::canonical)
                .collect(Collectors.toUnmodifiableSet());
    }

    public void assertAllowed(URI redirectUri) {
        if (redirectUri == null || !allowed.contains(canonical(redirectUri))) {
            throw new IamPolicyException(
                    IamDecisionCode.OIDC_REDIRECT_NOT_ALLOWED,
                    "iam.oidc.redirect_not_allowed");
        }
    }

    private static String canonical(URI value) {
        if (value == null || !value.isAbsolute() || value.getFragment() != null
                || value.getUserInfo() != null || value.toString().contains("*")) {
            throw new IllegalArgumentException("redirect URI must be an exact absolute URI");
        }
        return value.normalize().toString();
    }
}
