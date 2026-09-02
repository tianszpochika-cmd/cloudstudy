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
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtValidationException;
import org.springframework.security.oauth2.jose.jws.SignatureAlgorithm;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.jwk.JWKSet;
import com.nimbusds.jose.jwk.KeyUse;
import com.nimbusds.jose.jwk.RSAKey;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.Duration;
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
    void idempotentCredentialReplayReconstructsTheSameAccessAndRefreshCredentials() {
        IamServiceProperties properties = properties();
        properties.getIdempotency().setReplaySecret("stable-test-replay-secret");
        RecordingAudit audit = new RecordingAudit();
        var principal = com.englishflow.iam.domain.PrincipalId.random();
        SessionService sessions = new SessionService(new InMemorySessionStore(), audit, CLOCK, properties);
        SessionService.SessionCreation creation = sessions.open(
                ServerPrincipalContext.forPlatform(principal, Set.of("learner")),
                new DeviceId("device-idempotent"), "scope|key|hash");
        var rotated = sessions.rotateByRefreshToken(creation.refreshToken(), "scope|refresh-key|hash");
        SessionRecord rotatedSession = sessions.find(rotated.sessionId());
        assertEquals(rotated.nextRefreshToken(), sessions.replayRefreshToken(rotatedSession,
                "scope|refresh-key|hash"));

        AccountRecord account = new AccountRecord(principal, "deterministic@example.com", "$2a$12$C6UzMDM.H6dfI/f/IKcEeVn2xL1Xg9sN8m5p4wJ7w7j9y9e3dF6",
                Set.of("learner"), Set.of("iam.self.read"), com.englishflow.iam.domain.AccountStatus.ACTIVE,
                0, null, NOW, NOW);
        JwtSigningKeyProvider keyProvider = new JwtSigningKeyProvider(properties);
        JwtTokenService tokenService = new JwtTokenService(
                new org.springframework.security.oauth2.jwt.NimbusJwtEncoder(
                        (selector, context) -> List.of(keyProvider.signingKey())),
                keyProvider, properties, CLOCK);
        var first = tokenService.issue(account, rotatedSession, "scope|refresh-key|hash");
        var replay = tokenService.issue(account, rotatedSession, "scope|refresh-key|hash");
        assertEquals(first.value(), replay.value());
        assertEquals(first.jti(), replay.jti());
        assertEquals(first.expiresAt(), replay.expiresAt());
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

    @Test
    void decoderRequiresCompleteAccessProfileAndJwtTypeHeader() {
        IamServiceProperties properties = properties();
        JwtSigningKeyProvider keyProvider = new JwtSigningKeyProvider(properties);
        var encoder = new org.springframework.security.oauth2.jwt.NimbusJwtEncoder(
                (selector, context) -> List.of(keyProvider.signingKey()));
        JwtDecoder decoder = new com.englishflow.iam.config.IamSecurityConfiguration()
                .iamJwtDecoder(properties, keyProvider);
        Instant now = Instant.now();
        String principal = java.util.UUID.randomUUID().toString();
        String session = java.util.UUID.randomUUID().toString();
        JwtClaimsSet validClaims = JwtClaimsSet.builder()
                .issuer(properties.getJwt().getIssuer()).subject(principal)
                .audience(List.of(properties.getJwt().getAudience()))
                .issuedAt(now).notBefore(now).expiresAt(now.plus(Duration.ofMinutes(5)))
                .id(java.util.UUID.randomUUID().toString()).claim("token_type", "access")
                .claim("scope", "iam.self.read").claim("session_id", session)
                .claim("tenant_id", "platform").claim("owner_id", principal).build();

        assertEquals(principal, decoder.decode(encode(encoder, validClaims, "JWT")).getSubject());
        JwtClaimsSet missingJti = JwtClaimsSet.builder()
                .issuer(properties.getJwt().getIssuer()).subject(principal)
                .audience(List.of(properties.getJwt().getAudience()))
                .issuedAt(now).notBefore(now).expiresAt(now.plus(Duration.ofMinutes(5)))
                .claim("token_type", "access").claim("scope", "iam.self.read")
                .claim("session_id", session).claim("tenant_id", "platform")
                .claim("owner_id", principal).build();
        JwtClaimsSet missingNotBefore = JwtClaimsSet.builder()
                .issuer(properties.getJwt().getIssuer()).subject(principal)
                .audience(List.of(properties.getJwt().getAudience()))
                .issuedAt(now).expiresAt(now.plus(Duration.ofMinutes(5)))
                .id(java.util.UUID.randomUUID().toString()).claim("token_type", "access")
                .claim("scope", "iam.self.read").claim("session_id", session)
                .claim("tenant_id", "platform").claim("owner_id", principal).build();
        assertThrows(JwtValidationException.class, () -> decoder.decode(encode(encoder, missingJti, "JWT")));
        assertThrows(JwtValidationException.class, () -> decoder.decode(encode(encoder, missingNotBefore, "JWT")));
        assertThrows(JwtValidationException.class, () -> decoder.decode(encode(encoder, validClaims, "at+jwt")));
    }

    @Test
    void decoderAcceptsOnlySubjectBoundServiceIdentityProfile() {
        IamServiceProperties properties = properties();
        JwtSigningKeyProvider keyProvider = new JwtSigningKeyProvider(properties);
        var encoder = new org.springframework.security.oauth2.jwt.NimbusJwtEncoder(
                (selector, context) -> List.of(keyProvider.signingKey()));
        JwtDecoder decoder = new com.englishflow.iam.config.IamSecurityConfiguration()
                .iamJwtDecoder(properties, keyProvider);
        Instant now = Instant.now();
        JwtClaimsSet valid = serviceClaims(properties, now, "learning-service", "learning-service");
        assertEquals("learning-service", decoder.decode(encode(encoder, valid, "JWT"))
                .getClaimAsString("service_id"));
        JwtClaimsSet forgedBinding = serviceClaims(properties, now, "learning-service", "assessment-service");
        assertThrows(JwtValidationException.class,
                () -> decoder.decode(encode(encoder, forgedBinding, "JWT")));
    }

    private static JwtClaimsSet serviceClaims(IamServiceProperties properties, Instant now,
                                              String subject, String serviceId) {
        return JwtClaimsSet.builder().issuer(properties.getJwt().getIssuer()).subject(subject)
                .audience(List.of(properties.getJwt().getAudience()))
                .issuedAt(now).notBefore(now).expiresAt(now.plus(Duration.ofMinutes(5)))
                .id(java.util.UUID.randomUUID().toString()).claim("token_type", "service")
                .claim("service_id", serviceId).build();
    }

    private static String encode(org.springframework.security.oauth2.jwt.JwtEncoder encoder,
                                 JwtClaimsSet claims, String type) {
        JwsHeader header = JwsHeader.with(SignatureAlgorithm.RS256).type(type).build();
        return encoder.encode(JwtEncoderParameters.from(header, claims)).getTokenValue();
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
