package com.englishflow.iam.oidc;

import java.net.URI;

/**
 * Provider-neutral OIDC adapter port.
 *
 * <p>Implementations exchange authorization codes at an external provider and verify the returned
 * ID token using issuer metadata and rotated JWKS. The adapter is never an OAuth/OIDC token
 * server.</p>
 */
public interface OidcProviderAdapter {

    String providerId();

    OidcProviderMetadata metadata();

    /** Selects the registered public client for a server-allowlisted callback URI. */
    default String clientIdForRedirect(URI redirectUri) {
        return metadata().clientId();
    }

    default OidcProviderMetadata metadataForClient(String clientId) {
        OidcProviderMetadata current = metadata();
        return new OidcProviderMetadata(current.issuer(), current.authorizationEndpoint(),
                current.tokenEndpoint(), current.jwksUri(), clientId,
                current.scopes(), current.codeChallengeMethods());
    }

    JwksKeySetPort jwks();

    VerifiedOidcIdentity exchangeAndVerify(AuthorizationCodeExchange exchange);

    /**
     * Exchange variant used by the IAM session boundary. The default keeps test doubles and
     * provider-neutral implementations identity-only until they deliberately opt into session
     * material handling.
     */
    default OidcTokenSet exchangeForSession(AuthorizationCodeExchange exchange) {
        return OidcTokenSet.identityOnly(exchangeAndVerify(exchange));
    }
}
