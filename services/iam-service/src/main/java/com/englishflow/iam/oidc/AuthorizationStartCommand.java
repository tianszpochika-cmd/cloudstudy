package com.englishflow.iam.oidc;

import java.net.URI;
import java.util.Objects;

/** Untrusted start input; redirect URI is checked against the server allowlist. */
public record AuthorizationStartCommand(String providerId, URI redirectUri) {

    public AuthorizationStartCommand {
        Objects.requireNonNull(providerId, "providerId");
        Objects.requireNonNull(redirectUri, "redirectUri");
    }
}
