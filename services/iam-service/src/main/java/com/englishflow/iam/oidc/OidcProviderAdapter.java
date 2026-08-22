package com.englishflow.iam.oidc;

/**
 * Provider-neutral OIDC adapter port.
 *
 * <p>A future implementation may use an approved external IdP SDK or Spring Security client. It
 * must exchange authorization codes at that provider and verify the returned ID token using the
 * issuer metadata and rotated JWKS. This repository intentionally contains no real adapter and
 * no token server.</p>
 */
public interface OidcProviderAdapter {

    String providerId();

    OidcProviderMetadata metadata();

    JwksKeySetPort jwks();

    VerifiedOidcIdentity exchangeAndVerify(AuthorizationCodeExchange exchange);
}
