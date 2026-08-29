package com.englishflow.iam;

import com.englishflow.iam.auth.JwtSigningKeyProvider;
import com.englishflow.iam.auth.JwtTokenService;
import com.englishflow.iam.config.IamServiceProperties;
import com.englishflow.iam.domain.AccountRecord;
import com.englishflow.iam.domain.AuditDecision;
import com.englishflow.iam.domain.AuditFactPort;
import com.englishflow.iam.domain.ClientAuthorityClaims;
import com.englishflow.iam.domain.DeviceId;
import com.englishflow.iam.domain.IamDecisionCode;
import com.englishflow.iam.domain.IamPolicyException;
import com.englishflow.iam.domain.InMemoryAccountStore;
import com.englishflow.iam.domain.InMemorySessionStore;
import com.englishflow.iam.domain.PasswordAccountService;
import com.englishflow.iam.domain.ServerPrincipalContext;
import com.englishflow.iam.domain.SessionRecord;
import com.englishflow.iam.domain.SessionService;
import com.englishflow.iam.domain.SessionStatus;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.jwk.JWKSet;
import com.nimbusds.jose.jwk.KeyUse;
import com.nimbusds.jose.jwk.RSAKey;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.security.KeyPairGenerator;
import java.security.interfaces.RSAPublicKey;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class IamJwtAuthenticationTest {
    private static final Instant NOW = Instant.parse("2026-08-28T00:00:00Z");
    private static final Clock CLOCK = Clock.fixed(NOW, ZoneOffset.UTC);

    @Test
    void accountPasswordIssuesClaimsAndIndependentPublicKeyCanVerify() {
        IamServiceProperties properties = properties();
        RecordingAudit audit = new RecordingAudit();
        PasswordAccountService accounts = new PasswordAccountService(new InMemoryAccountStore(),
                new BCryptPasswordEncoder(12), audit, CLOCK, properties);
        AccountRecord account = accounts.register("learner@example.com", "correct horse battery staple!", ClientAuthorityClaims.none());
        AccountRecord authenticated = accounts.authenticate("LEARNER@EXAMPLE.COM", "correct horse battery staple!");
        assertEquals(account.principalId(), authenticated.principalId());

        SessionService sessions = new SessionService(new InMemorySessionStore(), audit, CLOCK, properties);
        SessionService.SessionCreation creation = sessions.open(
                ServerPrincipalContext.forPlatform(account.principalId(), account.roles()), new DeviceId("device-test"));
        JwtSigningKeyProvider keyProvider = new JwtSigningKeyProvider(properties);
        JwtTokenService tokenService = new JwtTokenService(
                new org.springframework.security.oauth2.jwt.NimbusJwtEncoder(
                        (selector, context) -> List.of(keyProvider.signingKey())),
                keyProvider, properties, CLOCK);
        JwtTokenService.IssuedAccessToken issued = tokenService.issue(account, creation.session());
        NimbusJwtDecoder decoder = NimbusJwtDecoder.withPublicKey(keyProvider.publicKey()).build();
        decoder.setJwtValidator(token -> org.springframework.security.oauth2.core.OAuth2TokenValidatorResult.success());
        Jwt jwt = decoder.decode(issued.value());

        assertEquals(properties.getJwt().getIssuer(), jwt.getIssuer().toString());
        assertEquals(List.of(properties.getJwt().getAudience()), jwt.getAudience());
        assertEquals(account.principalId().toString(), jwt.getSubject());
        assertEquals("access", jwt.getClaimAsString("token_type"));
        assertEquals(creation.session().sessionId().toString(), jwt.getClaimAsString("session_id"));
        assertTrue(jwt.getClaimAsString("scope").contains("learner.profile.read"));
        assertTrue(jwt.getId() != null && !jwt.getId().isBlank());
    }

    @Test
    void refreshRotationRejectsReplayAndRevokesTheFamily() {
        IamServiceProperties properties = properties();
        RecordingAudit audit = new RecordingAudit();
        SessionService sessions = new SessionService(new InMemorySessionStore(), audit, CLOCK, properties);
        var principal = com.englishflow.iam.domain.PrincipalId.random();
        SessionService.SessionCreation creation = sessions.open(
                ServerPrincipalContext.forPlatform(principal, Set.of("learner")), new DeviceId("device-rotate"));
        SessionRecord first = creation.session();
        var rotated = sessions.rotate(first.sessionId(), creation.refreshToken());
        assertEquals(1, rotated.rotation());
        assertEquals(SessionStatus.ACTIVE, sessions.find(first.sessionId()).status());

        IamPolicyException replay = assertThrows(IamPolicyException.class,
                () -> sessions.rotate(first.sessionId(), creation.refreshToken()));
        assertEquals(IamDecisionCode.SESSION_REPLAY, replay.code());
        assertEquals(SessionStatus.REVOKED, sessions.find(first.sessionId()).status());
        IamPolicyException revoked = assertThrows(IamPolicyException.class,
                () -> sessions.rotate(first.sessionId(), rotated.nextRefreshToken()));
        assertEquals(IamDecisionCode.SESSION_REVOKED, revoked.code());
    }

    @Test
    void repeatedWrongPasswordsLockAccountAndClientAuthorityDoesNotOverride() {
        IamServiceProperties properties = properties();
        properties.getAccount().setMaxFailedAttempts(2);
        RecordingAudit audit = new RecordingAudit();
        PasswordAccountService accounts = new PasswordAccountService(new InMemoryAccountStore(),
                new BCryptPasswordEncoder(12), audit, CLOCK, properties);
        accounts.register("lock@example.com", "correct horse battery staple!", ClientAuthorityClaims.none());
        assertThrows(IamPolicyException.class, () -> accounts.authenticate("lock@example.com", "wrong password"));
        IamPolicyException locked = assertThrows(IamPolicyException.class,
                () -> accounts.authenticate("lock@example.com", "wrong password"));
        assertEquals(IamDecisionCode.ACCOUNT_LOCKED, locked.code());
        assertThrows(IamPolicyException.class, () -> accounts.register("admin@example.com",
                "correct horse battery staple!", new ClientAuthorityClaims("attacker", "owner", Set.of("admin"))));
    }

    @Test
    void publishesPreviousPublicKeyDuringRotationOverlap() throws Exception {
        IamServiceProperties properties = properties();
        KeyPairGenerator generator = KeyPairGenerator.getInstance("RSA");
        generator.initialize(2048);
        var previousPair = generator.generateKeyPair();
        RSAKey previous = new RSAKey.Builder((RSAPublicKey) previousPair.getPublic())
                .keyUse(KeyUse.SIGNATURE).algorithm(JWSAlgorithm.RS256).keyID("iam-previous-2026-07").build();
        properties.getJwt().setPreviousPublicKeysJson(new JWKSet(previous).toString());

        JwtSigningKeyProvider provider = new JwtSigningKeyProvider(properties);

        assertEquals(2, provider.publicJwks().size());
        assertTrue(provider.publicJwks().stream().anyMatch(key -> "iam-previous-2026-07".equals(key.get("kid"))));
        assertTrue(provider.publicJwks().stream().allMatch(key -> !key.containsKey("d")));
    }

    private static IamServiceProperties properties() {
        IamServiceProperties properties = new IamServiceProperties();
        properties.getJwt().setIssuer("https://iam.example.test");
        properties.getJwt().setAudience("yuxuexing-api");
        properties.getJwt().setEphemeralKeysAllowed(true);
        return properties;
    }

    private static final class RecordingAudit implements AuditFactPort {
        private final List<AuditDecision> decisions = new ArrayList<>();
        @Override public void append(AuditDecision decision) { decisions.add(decision); }
    }
}
