package com.englishflow.iam.domain;

import java.net.URI;

/**
 * Port to an approved external IdP session client. It delegates provider token rotation and
 * revocation; it never mints tokens and has no implementation in this pre-G-IDP module.
 */
public interface ProviderSessionPort {

    ProviderRefreshRotation rotate(
            URI issuer,
            ProviderSessionReference providerSessionReference,
            String presentedRefreshToken);

    void revoke(URI issuer, ProviderSessionReference providerSessionReference);
}
