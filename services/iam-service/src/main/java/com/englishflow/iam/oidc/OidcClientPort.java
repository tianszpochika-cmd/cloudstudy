package com.englishflow.iam.oidc;

/** Standard OIDC authorization-code + PKCE client boundary. */
public interface OidcClientPort {

    OidcAuthorizationRequest begin(AuthorizationStartCommand command);

    VerifiedOidcIdentity complete(AuthorizationCallback callback);

    OidcProviderMetadata metadata();

    JwksKeySet currentJwks();
}
