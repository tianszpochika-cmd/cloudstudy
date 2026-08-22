package com.englishflow.iam.oidc;

/**
 * Provider adapter port for issuer metadata and JWKS rotation. Implementations must validate
 * signatures, issuer, audience and nonce before returning a verified identity.
 */
public interface JwksKeySetPort {

    JwksKeySet current();

    JwksKeySet refresh();
}
