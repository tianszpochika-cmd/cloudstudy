package com.englishflow.iam.oidc;

import com.englishflow.iam.domain.IamDecisionCode;
import com.englishflow.iam.domain.IamPolicyException;

import java.net.URI;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Objects;

/**
 * Provider-neutral authorization-code client. It owns protocol checks but delegates network
 * exchange and ID-token/JWKS verification to an external adapter port.
 */
public final class ProviderNeutralOidcClient implements OidcClientPort {

    private static final Duration DEFAULT_TRANSACTION_TTL = Duration.ofMinutes(5);
    private static final Duration DEFAULT_JWKS_MAX_AGE = Duration.ofMinutes(15);

    private final OidcProviderAdapter provider;
    private final RedirectUriAllowlist redirectUris;
    private final AuthorizationTransactionPort transactions;
    private final Clock clock;
    private final Duration transactionTtl;
    private final Duration jwksMaxAge;

    public ProviderNeutralOidcClient(
            OidcProviderAdapter provider,
            RedirectUriAllowlist redirectUris,
            AuthorizationTransactionPort transactions,
            Clock clock) {
        this(provider, redirectUris, transactions, clock, DEFAULT_TRANSACTION_TTL, DEFAULT_JWKS_MAX_AGE);
    }

    public ProviderNeutralOidcClient(
            OidcProviderAdapter provider,
            RedirectUriAllowlist redirectUris,
            AuthorizationTransactionPort transactions,
            Clock clock,
            Duration transactionTtl,
            Duration jwksMaxAge) {
        this.provider = Objects.requireNonNull(provider, "provider");
        this.redirectUris = Objects.requireNonNull(redirectUris, "redirectUris");
        this.transactions = Objects.requireNonNull(transactions, "transactions");
        this.clock = Objects.requireNonNull(clock, "clock");
        this.transactionTtl = requirePositive(transactionTtl, "transactionTtl");
        this.jwksMaxAge = requirePositive(jwksMaxAge, "jwksMaxAge");
    }

    @Override
    public OidcAuthorizationRequest begin(AuthorizationStartCommand command) {
        Objects.requireNonNull(command, "command");
        if (!provider.providerId().equals(command.providerId())) {
            throw new IamPolicyException(IamDecisionCode.OIDC_PROVIDER_REJECTED, "iam.oidc.provider_rejected");
        }
        redirectUris.assertAllowed(command.redirectUri());

        String clientId = provider.clientIdForRedirect(command.redirectUri());
        OidcProviderMetadata metadata = provider.metadataForClient(clientId);
        String state = PkceSupport.randomUrlValue(32);
        String nonce = PkceSupport.randomUrlValue(32);
        String verifier = PkceSupport.randomUrlValue(32);
        String challenge = PkceSupport.s256Challenge(verifier);
        Instant now = Instant.now(clock);
        transactions.save(new AuthorizationTransaction(
                provider.providerId(),
                clientId,
                command.redirectUri(),
                state,
                nonce,
                verifier,
                challenge,
                now,
                now.plus(transactionTtl)));

        return new OidcAuthorizationRequest(
                provider.providerId(),
                metadata.authorizationEndpoint(),
                clientId,
                command.redirectUri(),
                state,
                nonce,
                challenge,
                metadata.scopes());
    }

    @Override
    public VerifiedOidcIdentity complete(AuthorizationCallback callback) {
        return completeExchange(callback, false).identity();
    }

    /** Completes the callback and retains provider-issued token material for the session seam. */
    public OidcTokenSet completeForSession(AuthorizationCallback callback) {
        return completeExchange(callback, true);
    }

    private OidcTokenSet completeExchange(AuthorizationCallback callback, boolean retainSessionMaterial) {
        Objects.requireNonNull(callback, "callback");
        AuthorizationTransaction candidate = transactions.find(callback.state())
                .orElseThrow(() -> new IamPolicyException(
                        transactions.wasConsumed(callback.state())
                                ? IamDecisionCode.OIDC_CALLBACK_REPLAY
                                : IamDecisionCode.OIDC_STATE_INVALID,
                        transactions.wasConsumed(callback.state())
                                ? "iam.oidc.callback_replay"
                                : "iam.oidc.state_invalid"));

        if (!provider.providerId().equals(callback.providerId())
                || !candidate.providerId().equals(callback.providerId())) {
            throw new IamPolicyException(IamDecisionCode.OIDC_PROVIDER_REJECTED, "iam.oidc.provider_rejected");
        }
        redirectUris.assertAllowed(callback.redirectUri());
        if (!candidate.redirectUri().equals(callback.redirectUri())) {
            throw new IamPolicyException(
                    IamDecisionCode.OIDC_REDIRECT_NOT_ALLOWED,
                    "iam.oidc.redirect_mismatch");
        }

        AuthorizationTransaction transaction = transactions.consume(callback.state())
                .orElseThrow(() -> new IamPolicyException(
                        transactions.wasConsumed(callback.state())
                                ? IamDecisionCode.OIDC_CALLBACK_REPLAY
                                : IamDecisionCode.OIDC_STATE_INVALID,
                        transactions.wasConsumed(callback.state())
                                ? "iam.oidc.callback_replay"
                                : "iam.oidc.state_invalid"));
        if (!candidate.equals(transaction)) {
            throw new IamPolicyException(IamDecisionCode.OIDC_CALLBACK_REPLAY, "iam.oidc.callback_replay");
        }

        // The verifier is server-side and is never accepted from the callback. This check proves
        // that the transaction cannot drift before the adapter performs the provider exchange.
        PkceSupport.assertVerifierMatches(transaction.codeVerifier(), transaction.codeChallenge());
        currentJwks();

        try {
            AuthorizationCodeExchange exchange = new AuthorizationCodeExchange(
                    provider.providerId(),
                    transaction.clientId(),
                    callback.authorizationCode(),
                    callback.redirectUri(),
                    transaction.codeVerifier(),
                    transaction.nonce());
            OidcTokenSet tokenSet = retainSessionMaterial
                    ? provider.exchangeForSession(exchange)
                    : OidcTokenSet.identityOnly(provider.exchangeAndVerify(exchange));
            if (tokenSet == null) {
                throw new IamPolicyException(
                        IamDecisionCode.OIDC_PROVIDER_REJECTED,
                        "iam.oidc.provider_rejected");
            }
            VerifiedOidcIdentity identity = tokenSet.identity();
            if (!metadata().issuer().equals(identity.externalIdentity().issuer())) {
                throw new IamPolicyException(IamDecisionCode.OIDC_ISSUER_INVALID, "iam.oidc.issuer_invalid");
            }
            if (!PkceSupport.constantTimeEquals(transaction.nonce(), identity.nonce())) {
                throw new IamPolicyException(IamDecisionCode.OIDC_NONCE_INVALID, "iam.oidc.nonce_invalid");
            }
            return tokenSet;
        } catch (IamPolicyException exception) {
            throw exception;
        } catch (RuntimeException exception) {
            throw new IamPolicyException(
                    IamDecisionCode.OIDC_PROVIDER_REJECTED,
                    "iam.oidc.provider_rejected");
        }

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
    public String clientIdForRedirect(URI redirectUri) {
        Objects.requireNonNull(redirectUri, "redirectUri");
        redirectUris.assertAllowed(redirectUri);
        return provider.clientIdForRedirect(redirectUri);
    }

    @Override
    public JwksKeySet currentJwks() {
        try {
            JwksKeySetPort jwks = provider.jwks();
            if (jwks == null) {
                throw new IamPolicyException(IamDecisionCode.OIDC_JWKS_INVALID, "iam.oidc.jwks_invalid");
            }
            JwksKeySet keySet = jwks.current();
            JwksKeySetValidator.assertUsable(keySet, metadata().issuer(), clock, jwksMaxAge);
            return keySet;
        } catch (IamPolicyException exception) {
            throw exception;
        } catch (RuntimeException exception) {
            throw new IamPolicyException(IamDecisionCode.OIDC_PROVIDER_REJECTED, "iam.oidc.provider_rejected");
        }
    }

    private static Duration requirePositive(Duration value, String name) {
        Objects.requireNonNull(value, name);
        if (value.isNegative() || value.isZero()) {
            throw new IllegalArgumentException(name + " must be positive");
        }
        return value;
    }
}
