package com.englishflow.iam.auth;

import com.englishflow.iam.config.IamServiceProperties;
import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;

import java.time.Duration;
import java.time.Instant;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Service token issuance, with the encoder faked so the test is about the rules rather than about signing.
 *
 * <p>The rules that matter are refusals. An unknown client and a wrong secret must be indistinguishable, a client
 * granted nothing must not receive a token that can only fail later, and the issued claims must be unusable as a
 * user token: a service token that looked like an access token would let an internal caller act as a person.
 */
class ServiceTokenServiceTest {

    /** Captures the claims it is asked to sign, so the test can assert on them. */
    private static final class RecordingEncoder implements JwtEncoder {
        private org.springframework.security.oauth2.jwt.JwtClaimsSet claims;
        private org.springframework.security.oauth2.jwt.JwsHeader header;

        @Override
        public Jwt encode(JwtEncoderParameters parameters) {
            this.claims = parameters.getClaims();
            this.header = parameters.getJwsHeader();
            return new Jwt("signed-value", parameters.getClaims().getIssuedAt(),
                    parameters.getClaims().getExpiresAt(), parameters.getJwsHeader().getHeaders(),
                    parameters.getClaims().getClaims());
        }
    }

    private static IamServiceProperties properties(String clientId, String secret, List<String> permissions,
                                                   Duration ttl) {
        IamServiceProperties properties = new IamServiceProperties();
        IamServiceProperties.ServiceClientProperties client = new IamServiceProperties.ServiceClientProperties();
        client.setSecretDigest(ServiceTokenService.sha256(secret));
        client.setPermissions(permissions);
        client.setTokenTtl(ttl);
        properties.setServiceClients(new java.util.LinkedHashMap<>(java.util.Map.of(clientId, client)));
        return properties;
    }

    private static ServiceTokenService service(IamServiceProperties properties, RecordingEncoder encoder) {
        return new ServiceTokenService(encoder, null, properties,
                java.time.Clock.fixed(Instant.parse("2026-09-14T12:00:00Z"), java.time.ZoneOffset.UTC));
    }

    @Test
    void theRightSecretProducesATokenThatCannotBeUsedAsAUserToken() {
        RecordingEncoder encoder = new RecordingEncoder();
        IamServiceProperties properties = properties("api-gateway", "s3cret", List.of("audit.ingest"),
                Duration.ofMinutes(5));

        ServiceTokenService.IssuedServiceToken issued = service(properties, encoder).issue("api-gateway", "s3cret");

        assertEquals("api-gateway", encoder.claims.getSubject());
        // Subject-bound service identity (the IAM resource server requires
        // service_id to equal the subject); token_type still keeps a service
        // token unmistakable from a person's access token.
        assertEquals("api-gateway", encoder.claims.getClaim("service_id"));
        // The claim name is the same one user tokens carry and the value is not, so every existing authority
        // mapping keeps working while a service token can never be mistaken for a person's.
        assertEquals("service", encoder.claims.getClaim("token_type"));
        assertEquals(List.of("audit.ingest"), encoder.claims.getClaim("permissions"));
        assertEquals("api-gateway", issued.serviceId());
        assertEquals(Duration.ofMinutes(5).toSeconds(), Duration.between(issued.issuedAt(), issued.expiresAt()).toSeconds());
        assertNotEquals(null, issued.jti());
    }

    @Test
    void anUnknownClientAndAWrongSecretAreRefusedTheSameWay() {
        RecordingEncoder encoder = new RecordingEncoder();
        ServiceTokenService service = service(properties("api-gateway", "s3cret", List.of("audit.ingest"),
                Duration.ofMinutes(5)), encoder);

        ServiceTokenService.CredentialsRejected unknown = assertThrows(ServiceTokenService.CredentialsRejected.class,
                () -> service.issue("nobody", "s3cret"));
        ServiceTokenService.CredentialsRejected wrong = assertThrows(ServiceTokenService.CredentialsRejected.class,
                () -> service.issue("api-gateway", "wrong"));

        // Telling them apart would say which half of a guess was right.
        assertEquals(unknown.getMessage(), wrong.getMessage());
        assertTrue(unknown.getMessage().contains("not accepted"), unknown.getMessage());
    }

    @Test
    void aClientGrantedNothingIsRefusedRatherThanGivenATokenThatCanOnlyFailLater() {
        RecordingEncoder encoder = new RecordingEncoder();

        IllegalStateException refusal = assertThrows(IllegalStateException.class,
                () -> service(properties("api-gateway", "s3cret", List.of(), Duration.ofMinutes(5)), encoder)
                        .issue("api-gateway", "s3cret"));

        assertTrue(refusal.getMessage().contains("no permissions"), refusal.getMessage());
    }

    @Test
    void theTtlIsShortByDefaultAndNeverLongerThanConfiguredWhenUnset() {
        RecordingEncoder encoder = new RecordingEncoder();
        // A zero TTL is a configuration mistake, not a request for a token that expires immediately.
        ServiceTokenService.IssuedServiceToken issued = service(
                properties("api-gateway", "s3cret", List.of("audit.ingest"), Duration.ZERO), encoder)
                .issue("api-gateway", "s3cret");

        assertEquals(Duration.ofMinutes(5).toSeconds(), Duration.between(issued.issuedAt(), issued.expiresAt()).toSeconds());
        // No refresh token is issued, so a leaked token expires rather than renewing itself. Asserted as "absent"
        // rather than "equal to null": the overload taking two nulls is ambiguous, and the assertion is about the
        // claim not being present at all.
        assertTrue(encoder.claims.getClaims().get("refresh_token") == null,
                String.valueOf(encoder.claims.getClaims().get("refresh_token")));
    }

    @Test
    void noClientConfiguredMeansNoTokenCanBeIssued() {
        RecordingEncoder encoder = new RecordingEncoder();

        assertThrows(ServiceTokenService.CredentialsRejected.class,
                () -> service(new IamServiceProperties(), encoder).issue("api-gateway", "s3cret"));
    }

    @Test
    void theDigestIsStableAndThePlaintextIsNotTheStoredForm() {
        String digest = ServiceTokenService.sha256("s3cret");

        assertEquals(digest, ServiceTokenService.sha256("s3cret"));
        assertEquals(64, digest.length());
        assertTrue(digest.matches("[0-9a-f]{64}"), digest);
        assertNotEquals("s3cret", digest);
    }
}
