package com.englishflow.iam.oidc;

import java.net.URI;
import java.util.Objects;
import java.util.Set;

/** Browser redirect data. The code verifier is deliberately absent from this object. */
public record OidcAuthorizationRequest(
        String providerId,
        URI authorizationEndpoint,
        String clientId,
        URI redirectUri,
        String state,
        String nonce,
        String codeChallenge,
        Set<String> scopes) {

    public OidcAuthorizationRequest {
        Objects.requireNonNull(providerId, "providerId");
        Objects.requireNonNull(authorizationEndpoint, "authorizationEndpoint");
        Objects.requireNonNull(clientId, "clientId");
        Objects.requireNonNull(redirectUri, "redirectUri");
        Objects.requireNonNull(state, "state");
        Objects.requireNonNull(nonce, "nonce");
        Objects.requireNonNull(codeChallenge, "codeChallenge");
        scopes = scopes == null ? Set.of("openid") : Set.copyOf(scopes);
    }
}
