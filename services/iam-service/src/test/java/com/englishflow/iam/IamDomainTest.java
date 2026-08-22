package com.englishflow.iam;

import com.englishflow.iam.domain.AdultGateCommand;
import com.englishflow.iam.domain.AdultGateResult;
import com.englishflow.iam.domain.AdultGateService;
import com.englishflow.iam.domain.AuditDecision;
import com.englishflow.iam.domain.AuditFactPort;
import com.englishflow.iam.domain.ClientAuthorityClaims;
import com.englishflow.iam.domain.ConsentCommand;
import com.englishflow.iam.domain.ConsentService;
import com.englishflow.iam.domain.ConsentType;
import com.englishflow.iam.domain.ConsentVersion;
import com.englishflow.iam.domain.DeviceId;
import com.englishflow.iam.domain.DeviceRegistration;
import com.englishflow.iam.domain.DeviceRegistrationCommand;
import com.englishflow.iam.domain.DeviceService;
import com.englishflow.iam.domain.ExternalIdentity;
import com.englishflow.iam.domain.IamDecisionCode;
import com.englishflow.iam.domain.IamPolicyException;
import com.englishflow.iam.domain.InMemoryConsentStore;
import com.englishflow.iam.domain.InMemoryDeviceRegistry;
import com.englishflow.iam.domain.InMemoryPrincipalMappingStore;
import com.englishflow.iam.domain.InMemorySessionStore;
import com.englishflow.iam.domain.PrincipalId;
import com.englishflow.iam.domain.PrincipalMapping;
import com.englishflow.iam.domain.PrincipalMappingService;
import com.englishflow.iam.domain.ProviderRefreshRotation;
import com.englishflow.iam.domain.ProviderSessionPort;
import com.englishflow.iam.domain.ProviderSessionReference;
import com.englishflow.iam.domain.ServerPrincipalContext;
import com.englishflow.iam.domain.SessionRecord;
import com.englishflow.iam.domain.SessionRotationResult;
import com.englishflow.iam.domain.SessionService;
import com.englishflow.iam.domain.StaticConsentPolicy;
import com.englishflow.iam.domain.TenantScope;
import com.englishflow.iam.domain.TrustedAgeEvidence;
import com.englishflow.iam.oidc.AuthorizationCallback;
import com.englishflow.iam.oidc.AuthorizationCodeExchange;
import com.englishflow.iam.oidc.AuthorizationStartCommand;
import com.englishflow.iam.oidc.InMemoryAuthorizationTransactionStore;
import com.englishflow.iam.oidc.JwksKeyDescriptor;
import com.englishflow.iam.oidc.JwksKeySet;
import com.englishflow.iam.oidc.JwksKeySetPort;
import com.englishflow.iam.oidc.OidcAuthorizationRequest;
import com.englishflow.iam.oidc.OidcProviderAdapter;
import com.englishflow.iam.oidc.OidcProviderMetadata;
import com.englishflow.iam.oidc.PkceSupport;
import com.englishflow.iam.oidc.ProviderNeutralOidcClient;
import com.englishflow.iam.oidc.RedirectUriAllowlist;
import com.englishflow.iam.oidc.TrustedIdpAgeClaim;
import com.englishflow.iam.oidc.VerifiedOidcIdentity;

import org.junit.jupiter.api.Test;

import java.net.URI;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class IamDomainTest {

    private static final Instant NOW = Instant.parse("2026-08-22T00:00:00Z");
    private static final Clock CLOCK = Clock.fixed(NOW, ZoneOffset.UTC);
    private static final URI ISSUER = URI.create("https://idp.example.test");
    private static final URI REDIRECT = URI.create("http://127.0.0.1:18180/auth/callback");

    @Test
    void authorizationCodePkceStateNonceAndJwksAreProviderNeutral() {
        FakeProvider provider = new FakeProvider();
        ProviderNeutralOidcClient client = new ProviderNeutralOidcClient(
                provider,
                new RedirectUriAllowlist(Set.of(REDIRECT)),
                new InMemoryAuthorizationTransactionStore(java.time.Duration.ofMinutes(5), CLOCK),
                CLOCK);

        OidcAuthorizationRequest request = client.begin(new AuthorizationStartCommand("test-idp", REDIRECT));
        assertTrue(request.codeChallenge().length() >= 43);
        assertFalse(request.toString().contains("codeVerifier"));
        provider.nextIdentity = new VerifiedOidcIdentity(
                new ExternalIdentity(ISSUER, "subject-1"),
                request.nonce(),
                Optional.of(new TrustedIdpAgeClaim(30, "age_over_18", NOW)),
                NOW);

        VerifiedOidcIdentity identity = client.complete(
                new AuthorizationCallback("test-idp", request.state(), "authorization-code", REDIRECT));
        assertEquals("subject-1", identity.externalIdentity().subject());
        assertNotNull(provider.lastExchange);
        assertEquals(request.codeChallenge(), PkceSupport.s256Challenge(provider.lastExchange.codeVerifier()));

        IamPolicyException replay = assertThrows(IamPolicyException.class, () -> client.complete(
                new AuthorizationCallback("test-idp", request.state(), "authorization-code", REDIRECT)));
        assertEquals(IamDecisionCode.OIDC_CALLBACK_REPLAY, replay.code());

        OidcAuthorizationRequest nonceRequest = client.begin(new AuthorizationStartCommand("test-idp", REDIRECT));
        provider.nextIdentity = new VerifiedOidcIdentity(
                new ExternalIdentity(ISSUER, "subject-2"),
                "wrong-nonce",
                Optional.empty(),
                NOW);
        IamPolicyException nonceFailure = assertThrows(IamPolicyException.class, () -> client.complete(
                new AuthorizationCallback("test-idp", nonceRequest.state(), "authorization-code", REDIRECT)));
        assertEquals(IamDecisionCode.OIDC_NONCE_INVALID, nonceFailure.code());

        IamPolicyException redirectFailure = assertThrows(IamPolicyException.class, () -> client.begin(
                new AuthorizationStartCommand("test-idp", URI.create("https://evil.example/callback"))));
        assertEquals(IamDecisionCode.OIDC_REDIRECT_NOT_ALLOWED, redirectFailure.code());
        assertEquals(ISSUER.toString(), client.currentJwks().issuer());
    }

    @Test
    void principalMappingIsImmutableAndTenantIsServerDerived() {
        ExternalIdentity identity = new ExternalIdentity(ISSUER, "subject-immutable");
        PrincipalMappingService mapper = new PrincipalMappingService(
                new InMemoryPrincipalMappingStore(), CLOCK);
        PrincipalMapping first = mapper.mapVerifiedIdentity(identity);
        PrincipalMapping second = mapper.mapVerifiedIdentity(identity);
        assertSame(first, second);

        InMemoryPrincipalMappingStore store = new InMemoryPrincipalMappingStore();
        PrincipalId fixed = PrincipalId.random();
        store.createIfAbsent(new PrincipalMapping(identity, fixed, NOW));
        IamPolicyException remap = assertThrows(IamPolicyException.class, () -> store.createIfAbsent(
                new PrincipalMapping(identity, PrincipalId.random(), NOW)));
        assertEquals(IamDecisionCode.PRINCIPAL_MAPPING_CONFLICT, remap.code());

        TenantScope scope = TenantScope.derive(fixed);
        assertEquals("platform", scope.tenantId());
        assertEquals(fixed, scope.owner());
        IamPolicyException override = assertThrows(IamPolicyException.class, () ->
                scope.rejectClientAuthority(new ClientAuthorityClaims("other", "other-owner", Set.of("admin"))));
        assertEquals(IamDecisionCode.CLIENT_AUTHORITY_OVERRIDE, override.code());
    }

    @Test
    void adultGateRequiresTrustedEvidenceAndLeavesPhaseThreeFactsEmpty() {
        RecordingAudit audit = new RecordingAudit();
        AdultGateService gate = new AdultGateService(audit, CLOCK);
        PrincipalId principal = PrincipalId.random();
        TrustedAgeEvidence adultEvidence = TrustedAgeEvidence.fromVerifiedIdpClaim(
                new TrustedIdpAgeClaim(30, "age_over_18", NOW));

        AdultGateResult accepted = gate.evaluate(new AdultGateCommand(
                principal, true, adultEvidence, null, null, ClientAuthorityClaims.none()));
        assertTrue(accepted.allowed());
        assertEquals(IamDecisionCode.ADULT_GATE_ALLOWED, accepted.code());
        assertTrue(accepted.auditDecision().factsCreated().isEmpty());
        assertTrue(accepted.auditDecision().factsForbidden().contains("child_account"));

        AdultGateResult child = gate.evaluate(new AdultGateCommand(
                principal, true,
                TrustedAgeEvidence.fromVerifiedIdpClaim(new TrustedIdpAgeClaim(17, "age", NOW)),
                null, null, ClientAuthorityClaims.none()));
        assertFalse(child.allowed());
        assertEquals(IamDecisionCode.ADULT_AGE_BELOW_MINIMUM, child.code());

        AdultGateResult forged = gate.evaluate(new AdultGateCommand(
                principal, true, adultEvidence, 99, null, ClientAuthorityClaims.none()));
        assertFalse(forged.allowed());
        assertEquals(IamDecisionCode.CLIENT_TRUSTED_INPUT_REJECTED, forged.code());
        assertEquals(3, audit.decisions.size());
    }

    @Test
    void deviceKickAndSessionRotationFailClosedOnReplay() {
        RecordingAudit audit = new RecordingAudit();
        PrincipalId principal = PrincipalId.random();
        ServerPrincipalContext context = ServerPrincipalContext.forPlatform(principal, Set.of("learner"));
        DeviceId deviceId = new DeviceId("device-1");
        DeviceService devices = new DeviceService(new InMemoryDeviceRegistry(), audit, CLOCK);
        DeviceRegistration registration = devices.register(context,
                new DeviceRegistrationCommand(deviceId, "web", "browser", ClientAuthorityClaims.none()));
        assertTrue(registration.active());

        RotatingProvider provider = new RotatingProvider();
        SessionService sessions = new SessionService(new InMemorySessionStore(), provider, audit, CLOCK);
        SessionRecord opened = sessions.open(
                context,
                deviceId,
                ISSUER,
                new ProviderSessionReference("provider-session-1"),
                "refresh-1");
        SessionRotationResult rotated = sessions.rotate(opened.sessionId(), "refresh-1");
        assertEquals(1, rotated.rotation());
        assertEquals("refresh-2", rotated.nextProviderRefreshToken());

        IamPolicyException replay = assertThrows(IamPolicyException.class, () ->
                sessions.rotate(opened.sessionId(), "refresh-1"));
        assertEquals(IamDecisionCode.SESSION_REPLAY, replay.code());
        IamPolicyException revoked = assertThrows(IamPolicyException.class, () ->
                sessions.rotate(opened.sessionId(), "refresh-2"));
        assertEquals(IamDecisionCode.SESSION_REVOKED, revoked.code());

        DeviceRegistration kicked = devices.kick(context, deviceId);
        assertFalse(kicked.active());
        assertTrue(provider.rotations > 0);
    }

    @Test
    void consentVersionAndAuditSensitiveFieldBoundariesAreExplicit() {
        RecordingAudit audit = new RecordingAudit();
        ConsentVersion version = new ConsentVersion("2026.08");
        ConsentService consents = new ConsentService(
                new InMemoryConsentStore(),
                new StaticConsentPolicy(Map.of(
                        ConsentType.TERMS_OF_SERVICE, version,
                        ConsentType.PRIVACY_NOTICE, version)),
                audit,
                CLOCK);
        ServerPrincipalContext context = ServerPrincipalContext.forPlatform(PrincipalId.random(), Set.of());

        assertTrue(consents.record(context, new ConsentCommand(
                ConsentType.TERMS_OF_SERVICE, version, true, ClientAuthorityClaims.none())).accepted());
        assertFalse(consents.withdraw(context, ConsentType.TERMS_OF_SERVICE).accepted());
        IamPolicyException mismatch = assertThrows(IamPolicyException.class, () -> consents.record(context,
                new ConsentCommand(ConsentType.PRIVACY_NOTICE, new ConsentVersion("old"), true,
                        ClientAuthorityClaims.none())));
        assertEquals(IamDecisionCode.CONSENT_VERSION_MISMATCH, mismatch.code());

        assertThrows(IllegalArgumentException.class, () -> new AuditDecision(
                java.util.UUID.randomUUID(), "audit", IamDecisionCode.SESSION_OPENED, true,
                context.principalId(), "platform", NOW, Set.of(), Set.of(),
                Map.of("refresh-token", "must-not-be-recorded")));
    }

    private static final class RecordingAudit implements AuditFactPort {
        private final List<AuditDecision> decisions = new ArrayList<>();

        @Override
        public void append(AuditDecision decision) {
            decisions.add(decision);
        }
    }

    private static final class FakeProvider implements OidcProviderAdapter {
        private final OidcProviderMetadata metadata = new OidcProviderMetadata(
                ISSUER,
                URI.create("https://idp.example.test/authorize"),
                URI.create("https://idp.example.test/token"),
                URI.create("https://idp.example.test/.well-known/jwks.json"),
                "englishflow-test-client",
                Set.of("openid", "profile"));
        private VerifiedOidcIdentity nextIdentity;
        private AuthorizationCodeExchange lastExchange;

        @Override
        public String providerId() {
            return "test-idp";
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
                    return new JwksKeySet(ISSUER.toString(), NOW,
                            List.of(new JwksKeyDescriptor("key-1", "RSA", "RS256", "sig")), "etag-1");
                }

                @Override
                public JwksKeySet refresh() {
                    return current();
                }
            };
        }

        @Override
        public VerifiedOidcIdentity exchangeAndVerify(AuthorizationCodeExchange exchange) {
            lastExchange = exchange;
            return nextIdentity;
        }
    }

    private static final class RotatingProvider implements ProviderSessionPort {
        private int rotations;

        @Override
        public ProviderRefreshRotation rotate(
                URI issuer,
                ProviderSessionReference providerSessionReference,
                String presentedRefreshToken) {
            rotations++;
            assertEquals("refresh-1", presentedRefreshToken);
            return new ProviderRefreshRotation(
                    new ProviderSessionReference("provider-session-2"),
                    "refresh-2",
                    NOW.plusSeconds(300));
        }

        @Override
        public void revoke(URI issuer, ProviderSessionReference providerSessionReference) {
            // The test checks local fail-closed revocation; no provider network is involved.
        }
    }
}
