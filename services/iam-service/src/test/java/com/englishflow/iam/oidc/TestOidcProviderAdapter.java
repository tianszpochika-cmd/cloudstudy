package com.englishflow.iam.oidc;

import com.englishflow.iam.domain.IamDecisionCode;
import com.englishflow.iam.domain.IamPolicyException;

import java.net.URI;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Deterministic OIDC test seam. It models authorization-code one-time use, PKCE verification and
 * JWKS replacement without HTTP, client secrets, signing keys or a token server.
 */
public final class TestOidcProviderAdapter implements OidcProviderAdapter {

    private final String providerId;
    private final OidcProviderMetadata metadata;
    private final Map<String, ExchangeFixture> codes = new ConcurrentHashMap<>();
    private final Set<String> usedCodes = ConcurrentHashMap.newKeySet();
    private volatile JwksKeySet keySet;
    private volatile boolean available = true;

    public TestOidcProviderAdapter(String providerId, URI issuer, Instant now) {
        this.providerId = providerId;
        this.metadata = new OidcProviderMetadata(
                issuer,
                URI.create(issuer + "/authorize"),
                URI.create(issuer + "/token"),
                URI.create(issuer + "/.well-known/jwks.json"),
                "englishflow-test-client",
                Set.of("openid", "profile"),
                Set.of("S256"));
        this.keySet = keys("key-1", now);
    }

    public void registerCode(String authorizationCode, String expectedCodeChallenge, VerifiedOidcIdentity identity) {
        codes.put(authorizationCode, new ExchangeFixture(expectedCodeChallenge, identity));
    }

    public void rotateKeys(String keyId, Instant fetchedAt) {
        keySet = keys(keyId, fetchedAt);
    }

    public void setAvailable(boolean available) {
        this.available = available;
    }

    @Override
    public String providerId() {
        return providerId;
    }

    @Override
    public OidcProviderMetadata metadata() {
        return metadata;
    }

    @Override
    public JwksKeySetPort jwks() {
        return new JwksKeySetPort() {
            @Override
            public JwksKeySet current() {
                requireAvailable();
                return keySet;
            }

            @Override
            public JwksKeySet refresh() {
                requireAvailable();
                return keySet;
            }
        };
    }

    @Override
    public VerifiedOidcIdentity exchangeAndVerify(AuthorizationCodeExchange exchange) {
        requireAvailable();
        if (!providerId.equals(exchange.providerId()) || !usedCodes.add(exchange.authorizationCode())) {
            throw new IamPolicyException(IamDecisionCode.OIDC_CALLBACK_REPLAY, "iam.oidc.callback_replay");
        }
        ExchangeFixture fixture = codes.remove(exchange.authorizationCode());
        if (fixture == null) {
            throw new IamPolicyException(IamDecisionCode.OIDC_PROVIDER_REJECTED, "iam.oidc.provider_rejected");
        }
        PkceSupport.assertVerifierMatches(exchange.codeVerifier(), fixture.expectedCodeChallenge());
        return fixture.identity();
    }

    private JwksKeySet keys(String keyId, Instant fetchedAt) {
        return new JwksKeySet(
                metadata.issuer().toString(),
                fetchedAt,
                List.of(new JwksKeyDescriptor(keyId, "RSA", "RS256", "sig")),
                keyId);
    }

    private void requireAvailable() {
        if (!available) {
            throw new IllegalStateException("test IdP unavailable");
        }
    }

    private record ExchangeFixture(String expectedCodeChallenge, VerifiedOidcIdentity identity) {
    }
}
