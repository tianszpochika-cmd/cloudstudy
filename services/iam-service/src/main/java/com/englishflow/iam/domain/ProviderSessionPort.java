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

    default ProviderRefreshRotation rotate(
            URI issuer,
            String providerClientId,
            ProviderSessionReference providerSessionReference,
            String presentedRefreshToken) {
        return rotate(issuer, providerSessionReference, presentedRefreshToken);
    }

    void revoke(URI issuer, ProviderSessionReference providerSessionReference);

    /**
     * Optional RFC 7009 path for an explicit user-initiated logout. The raw provider refresh token
     * is accepted only for the outbound call and must never enter a persistence adapter.
     */
    default void revoke(
            URI issuer,
            ProviderSessionReference providerSessionReference,
            String presentedRefreshToken) {
        revoke(issuer, providerSessionReference);
    }
}
