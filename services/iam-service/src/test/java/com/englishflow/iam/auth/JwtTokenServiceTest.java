package com.englishflow.iam.auth;

import com.englishflow.iam.config.IamServiceProperties;
import com.englishflow.iam.domain.AccountRecord;
import com.englishflow.iam.domain.AccountStatus;
import com.englishflow.iam.domain.DeviceId;
import com.englishflow.iam.domain.PrincipalId;
import com.englishflow.iam.domain.SessionId;
import com.englishflow.iam.domain.SessionRecord;
import com.englishflow.iam.domain.SessionStatus;
import com.englishflow.iam.domain.TenantScope;
import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

/**
 * P1-LIVE-001: the access token must carry the server-evaluated eligibility facts that the
 * domain PEPs already require, and must never mint an over-privileged token by default.
 */
class JwtTokenServiceTest {

    private static final Instant NOW = Instant.parse("2026-09-16T00:00:00Z");
    private static final Clock CLOCK = Clock.fixed(NOW, ZoneOffset.UTC);

    /** Captures the claims it is asked to sign, so the test is about the rules rather than signing. */
    private static final class RecordingEncoder implements JwtEncoder {
        private org.springframework.security.oauth2.jwt.JwtClaimsSet claims;

        @Override
        public Jwt encode(JwtEncoderParameters parameters) {
            this.claims = parameters.getClaims();
            return new Jwt("signed-value", parameters.getClaims().getIssuedAt(),
                    parameters.getClaims().getExpiresAt(), parameters.getJwsHeader().getHeaders(),
                    parameters.getClaims().getClaims());
        }
    }

    private record Fixture(JwtTokenService service, RecordingEncoder encoder, AccountRecord account,
                           SessionRecord session) {
    }

    private static Fixture fixture() {
        RecordingEncoder encoder = new RecordingEncoder();
        IamServiceProperties properties = new IamServiceProperties();
        properties.getJwt().setIssuer("http://127.0.0.1:18087");
        properties.getJwt().setAudience("yuxuexing-api");
        properties.getJwt().setAccessTokenTtl(Duration.ofMinutes(15));
        properties.getJwt().setEphemeralKeysAllowed(true);
        JwtTokenService service = new JwtTokenService(encoder,
                new JwtSigningKeyProvider(properties), properties, CLOCK);
        PrincipalId principal = PrincipalId.random();
        AccountRecord account = new AccountRecord(principal, "claims@example.com", "$2a$12$claimsTestHashValue0123456789",
                Set.of("learner"), Set.of("learner.profile.read"), AccountStatus.ACTIVE,
                0, null, NOW, NOW);
        SessionRecord session = new SessionRecord(SessionId.random(), principal,
                TenantScope.derive(principal), new DeviceId("device-claims-test"), "family-1",
                "0".repeat(64), 0, SessionStatus.ACTIVE, NOW, NOW, NOW.plus(Duration.ofDays(30)), null, null);
        return new Fixture(service, encoder, account, session);
    }

    @Test
    void evaluatedEligibilityIsCarriedAsExplicitClaims() {
        Fixture fixture = fixture();
        fixture.service().issue(fixture.account(), fixture.session(), null,
                new JwtTokenService.EligibilityClaims("PASSED", "GRANTED", "phase-1", "ACTIVE", "granted",
                        java.util.List.of("LOCAL_FIXTURE")));
        assertEquals("PASSED", fixture.encoder().claims.getClaim("adult_gate"));
        assertEquals("GRANTED", fixture.encoder().claims.getClaim("consent_state"));
        assertEquals("phase-1", fixture.encoder().claims.getClaim("phase"));
        assertEquals("ACTIVE", fixture.encoder().claims.getClaim("account_status"));
        assertEquals("device-claims-test", fixture.encoder().claims.getClaim("device_id"));
        // P1-LIVE-012 (decision A): media consent mirrors consent; rights ride along.
        assertEquals("granted", fixture.encoder().claims.getClaim("media_consent"));
        assertEquals(java.util.List.of("LOCAL_FIXTURE"), fixture.encoder().claims.getClaim("content_rights"));
    }

    @Test
    void unknownEligibilityOmitsMediaClaims() {
        Fixture fixture = fixture();
        fixture.service().issue(fixture.account(), fixture.session(), null);
        // Fail closed: no media_consent and no content_rights before evaluation.
        assertNull(fixture.encoder().claims.getClaim("media_consent"));
        assertNull(fixture.encoder().claims.getClaim("content_rights"));
    }

    @Test
    void unknownEligibilityEmitsExplicitDenyValuesRatherThanOmitting() {
        Fixture fixture = fixture();
        fixture.service().issue(fixture.account(), fixture.session(), null);
        // Domain PEPs deny on absence; explicit deny values keep the refusal observable.
        assertEquals("NOT_EVALUATED", fixture.encoder().claims.getClaim("adult_gate"));
        assertEquals("UNKNOWN", fixture.encoder().claims.getClaim("consent_state"));
        // Platform identity facts are issuance-time truths, not evaluated eligibility.
        assertEquals("phase-1", fixture.encoder().claims.getClaim("phase"));
        assertEquals("ACTIVE", fixture.encoder().claims.getClaim("account_status"));
    }

    @Test
    void nullEligibilityOmitsTheClaims() {
        Fixture fixture = fixture();
        fixture.service().issue(fixture.account(), fixture.session(), null, null);
        assertNull(fixture.encoder().claims.getClaim("adult_gate"));
        assertNull(fixture.encoder().claims.getClaim("consent_state"));
        assertNull(fixture.encoder().claims.getClaim("phase"));
        assertNull(fixture.encoder().claims.getClaim("account_status"));
    }
}
