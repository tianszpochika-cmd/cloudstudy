package com.englishflow.iam.oidc;

import java.net.URI;

/** Standard OIDC authorization-code + PKCE client boundary. */
public interface OidcClientPort {

    OidcAuthorizationRequest begin(AuthorizationStartCommand command);

    VerifiedOidcIdentity complete(AuthorizationCallback callback);

    /**
     * Completes a callback while retaining provider-issued session material in the in-process
     * exchange boundary. Implementations never mint a platform token.
     */
    default OidcTokenSet completeForSession(AuthorizationCallback callback) {
        return OidcTokenSet.identityOnly(complete(callback));
    }

    OidcProviderMetadata metadata();

    default String clientIdForRedirect(URI redirectUri) {
        return metadata().clientId();
    }

    JwksKeySet currentJwks();
}
