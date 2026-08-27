package com.englishflow.iam;

import com.englishflow.iam.domain.ExternalIdentity;
import com.englishflow.iam.domain.IamDecisionCode;
import com.englishflow.iam.domain.IamPolicyException;
import com.englishflow.iam.oidc.AuthorizationCallback;
import com.englishflow.iam.oidc.AuthorizationStartCommand;
import com.englishflow.iam.oidc.InMemoryAuthorizationTransactionStore;
import com.englishflow.iam.oidc.OidcAuthorizationRequest;
import com.englishflow.iam.oidc.ProviderNeutralOidcClient;
import com.englishflow.iam.oidc.RedirectUriAllowlist;
import com.englishflow.iam.oidc.TestOidcProviderAdapter;
import com.englishflow.iam.oidc.VerifiedOidcIdentity;

import org.junit.jupiter.api.Test;

import java.net.URI;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Optional;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class IamOidcBoundaryTest {

    private static final Instant NOW = Instant.parse("2026-08-23T00:00:00Z");
    private static final Clock CLOCK = Clock.fixed(NOW, ZoneOffset.UTC);
    private static final URI ISSUER = URI.create("https://test-idp.example.test");
    private static final URI REDIRECT = URI.create("http://127.0.0.1:18180/auth/callback");

    @Test
    void testIdpSeamCoversPkceOneTimeCodeJwksRotationAndUnavailableFailClosed() {
        TestOidcProviderAdapter provider = new TestOidcProviderAdapter("test-idp", ISSUER, NOW);
        ProviderNeutralOidcClient client = new ProviderNeutralOidcClient(
                provider,
                new RedirectUriAllowlist(Set.of(REDIRECT)),
                new InMemoryAuthorizationTransactionStore(Duration.ofMinutes(5), CLOCK),
                CLOCK,
                Duration.ofMinutes(5),
                Duration.ofMinutes(15));

        OidcAuthorizationRequest request = client.begin(new AuthorizationStartCommand("test-idp", REDIRECT));
        provider.registerCode(
                "code-1",
                request.codeChallenge(),
                new VerifiedOidcIdentity(
                        new ExternalIdentity(ISSUER, "subject-1"),
                        request.nonce(),
                        Optional.empty(),
                        NOW));

        // The provider seam is deterministic; the client still owns state/nonce/redirect checks.
        assertEquals("subject-1", client.complete(new AuthorizationCallback(
                "test-idp", request.state(), "code-1", REDIRECT)).externalIdentity().subject());
        String replayVerifier = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-._~";
        assertThrows(IamPolicyException.class, () -> provider.exchangeAndVerify(
                new com.englishflow.iam.oidc.AuthorizationCodeExchange(
                        "test-idp", "code-1", REDIRECT, replayVerifier)));

        provider.rotateKeys("key-2", NOW);
        assertEquals("key-2", client.currentJwks().keys().getFirst().keyId());

        provider.setAvailable(false);
        IamPolicyException unavailable = assertThrows(IamPolicyException.class, client::currentJwks);
        assertEquals(IamDecisionCode.OIDC_PROVIDER_REJECTED, unavailable.code());
    }

    @Test
    void staleJwksIsRejectedWithoutNetworkRefresh() {
        TestOidcProviderAdapter provider = new TestOidcProviderAdapter("test-idp", ISSUER, NOW);
        provider.rotateKeys("key-old", NOW.minus(Duration.ofMinutes(16)));
        ProviderNeutralOidcClient client = new ProviderNeutralOidcClient(
                provider,
                new RedirectUriAllowlist(Set.of(REDIRECT)),
                new InMemoryAuthorizationTransactionStore(Duration.ofMinutes(5), CLOCK),
                CLOCK);

        IamPolicyException stale = assertThrows(IamPolicyException.class, client::currentJwks);
        assertEquals(IamDecisionCode.OIDC_JWKS_INVALID, stale.code());
    }
}
