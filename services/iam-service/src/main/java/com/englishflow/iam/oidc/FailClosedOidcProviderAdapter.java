package com.englishflow.iam.oidc;

import com.englishflow.iam.domain.IamDecisionCode;
import com.englishflow.iam.domain.IamPolicyException;

/** Runtime provider used when an external IdP is not explicitly configured. */
public final class FailClosedOidcProviderAdapter implements OidcProviderAdapter {

    private final String providerId;

    public FailClosedOidcProviderAdapter(String providerId) {
        this.providerId = providerId == null || providerId.isBlank() ? "unconfigured" : providerId;
    }

    @Override
    public String providerId() {
        return providerId;
    }

    @Override
    public OidcProviderMetadata metadata() {
        throw unavailable();
    }

    @Override
    public JwksKeySetPort jwks() {
        throw unavailable();
    }

    @Override
    public VerifiedOidcIdentity exchangeAndVerify(AuthorizationCodeExchange exchange) {
        throw unavailable();
    }

    private IamPolicyException unavailable() {
        return new IamPolicyException(
                IamDecisionCode.OIDC_PROVIDER_NOT_CONFIGURED,
                "iam.oidc.provider_not_configured");
    }
}
