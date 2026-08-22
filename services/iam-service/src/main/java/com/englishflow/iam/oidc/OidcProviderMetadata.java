package com.englishflow.iam.oidc;

import java.net.URI;
import java.util.LinkedHashSet;
import java.util.Objects;
import java.util.Set;

/** Provider discovery metadata consumed through an adapter; no secret or token is stored here. */
public record OidcProviderMetadata(
        URI issuer,
        URI authorizationEndpoint,
        URI tokenEndpoint,
        URI jwksUri,
        String clientId,
        Set<String> scopes) {

    public OidcProviderMetadata {
        requireEndpoint(issuer, "issuer");
        requireEndpoint(authorizationEndpoint, "authorizationEndpoint");
        requireEndpoint(tokenEndpoint, "tokenEndpoint");
        requireEndpoint(jwksUri, "jwksUri");
        Objects.requireNonNull(clientId, "clientId");
        if (clientId.isBlank() || clientId.length() > 128) {
            throw new IllegalArgumentException("clientId is invalid");
        }
        scopes = scopes == null ? Set.of("openid") : Set.copyOf(new LinkedHashSet<>(scopes));
        if (!scopes.contains("openid")) {
            throw new IllegalArgumentException("OIDC authorization requires the openid scope");
        }
    }

    private static void requireEndpoint(URI endpoint, String name) {
        Objects.requireNonNull(endpoint, name);
        if (!endpoint.isAbsolute() || endpoint.getFragment() != null || endpoint.getUserInfo() != null) {
            throw new IllegalArgumentException(name + " must be an absolute URI without fragment or userinfo");
        }
    }
}
