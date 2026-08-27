package com.englishflow.iam.domain;

import java.net.URI;

/** No provider session operation is permitted until the external IdP adapter is configured. */
public final class FailClosedProviderSessionPort implements ProviderSessionPort {

    @Override
    public ProviderRefreshRotation rotate(
            URI issuer,
            ProviderSessionReference providerSessionReference,
            String presentedRefreshToken) {
        throw unavailable();
    }

    @Override
    public void revoke(URI issuer, ProviderSessionReference providerSessionReference) {
        throw unavailable();
    }

    private IamPolicyException unavailable() {
        return new IamPolicyException(
                IamDecisionCode.OIDC_PROVIDER_NOT_CONFIGURED,
                "iam.oidc.provider_not_configured");
    }
}
