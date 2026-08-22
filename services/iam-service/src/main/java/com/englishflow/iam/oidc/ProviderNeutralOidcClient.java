package com.englishflow.iam.oidc;

import com.englishflow.iam.domain.IamDecisionCode;
import com.englishflow.iam.domain.IamPolicyException;

import java.net.URI;
import java.time.Clock;
import java.time.Instant;
import java.util.Objects;

/**
 * Provider-neutral authorization-code client. It owns protocol checks but delegates network
 * exchange and ID-token/JWKS verification to an external adapter port.
 */
public final class ProviderNeutralOidcClient implements OidcClientPort {

    private final OidcProviderAdapter provider;
    private final RedirectUriAllowlist redirectUris;
    private final AuthorizationTransactionPort transactions;
    private final Clock clock;

    public ProviderNeutralOidcClient(
            OidcProviderAdapter provider,
            RedirectUriAllowlist redirectUris,
            AuthorizationTransactionPort transactions,
            Clock clock) {
        this.provider = Objects.requireNonNull(provider, "provider");
        this.redirectUris = Objects.requireNonNull(redirectUris, "redirectUris");
        this.transactions = Objects.requireNonNull(transactions, "transactions");
        this.clock = Objects.requireNonNull(clock, "clock");
    }

    @Override
    public OidcAuthorizationRequest begin(AuthorizationStartCommand command) {
        Objects.requireNonNull(command, "command");
        if (!provider.providerId().equals(command.providerId())) {
            throw new IamPolicyException(IamDecisionCode.OIDC_PROVIDER_REJECTED, "iam.oidc.provider_rejected");
        }
        redirectUris.assertAllowed(command.redirectUri());

        OidcProviderMetadata metadata = metadata();
        String state = PkceSupport.randomUrlValue(32);
        String nonce = PkceSupport.randomUrlValue(32);
        String verifier = PkceSupport.randomUrlValue(32);
        String challenge = PkceSupport.s256Challenge(verifier);
        transactions.save(new AuthorizationTransaction(
                provider.providerId(),
                metadata.clientId(),
                command.redirectUri(),
                state,
                nonce,
                verifier,
                challenge,
                Instant.now(clock)));

        return new OidcAuthorizationRequest(
                provider.providerId(),
                metadata.authorizationEndpoint(),
                metadata.clientId(),
                command.redirectUri(),
                state,
                nonce,
                challenge,
                metadata.scopes());
    }

    @Override
    public VerifiedOidcIdentity complete(AuthorizationCallback callback) {
        Objects.requireNonNull(callback, "callback");
        AuthorizationTransaction transaction = transactions.consume(callback.state())
                .orElseThrow(() -> new IamPolicyException(
                        transactions.wasConsumed(callback.state())
                                ? IamDecisionCode.OIDC_CALLBACK_REPLAY
                                : IamDecisionCode.OIDC_STATE_INVALID,
                        transactions.wasConsumed(callback.state())
                                ? "iam.oidc.callback_replay"
                                : "iam.oidc.state_invalid"));

        if (!provider.providerId().equals(callback.providerId())
                || !transaction.providerId().equals(callback.providerId())) {
            throw new IamPolicyException(IamDecisionCode.OIDC_PROVIDER_REJECTED, "iam.oidc.provider_rejected");
        }
        redirectUris.assertAllowed(callback.redirectUri());
        if (!transaction.redirectUri().equals(callback.redirectUri())) {
            throw new IamPolicyException(
                    IamDecisionCode.OIDC_REDIRECT_NOT_ALLOWED,
                    "iam.oidc.redirect_mismatch");
        }

        // The verifier is server-side and is never accepted from the callback. This check proves
        // that the transaction cannot drift before the adapter performs the provider exchange.
        PkceSupport.assertVerifierMatches(transaction.codeVerifier(), transaction.codeChallenge());

        VerifiedOidcIdentity identity;
        try {
            identity = provider.exchangeAndVerify(new AuthorizationCodeExchange(
                    provider.providerId(),
                    callback.authorizationCode(),
                    callback.redirectUri(),
                    transaction.codeVerifier()));
        } catch (IamPolicyException exception) {
            throw exception;
        } catch (RuntimeException exception) {
            throw new IamPolicyException(
                    IamDecisionCode.OIDC_PROVIDER_REJECTED,
                    "iam.oidc.provider_rejected");
        }

        if (identity == null || !metadata().issuer().equals(identity.externalIdentity().issuer())) {
            throw new IamPolicyException(IamDecisionCode.OIDC_ISSUER_INVALID, "iam.oidc.issuer_invalid");
        }
        if (!PkceSupport.constantTimeEquals(transaction.nonce(), identity.nonce())) {
            throw new IamPolicyException(IamDecisionCode.OIDC_NONCE_INVALID, "iam.oidc.nonce_invalid");
        }
        return identity;
    }

    @Override
    public OidcProviderMetadata metadata() {
        OidcProviderMetadata metadata = provider.metadata();
        if (metadata == null) {
            throw new IamPolicyException(IamDecisionCode.OIDC_PROVIDER_REJECTED, "iam.oidc.metadata_unavailable");
        }
        return metadata;
    }

    @Override
    public JwksKeySet currentJwks() {
        JwksKeySet keySet = provider.jwks().current();
        if (keySet == null || !metadata().issuer().toString().equals(keySet.issuer())) {
            throw new IamPolicyException(IamDecisionCode.OIDC_ISSUER_INVALID, "iam.oidc.jwks_issuer_invalid");
        }
        return keySet;
    }
}
