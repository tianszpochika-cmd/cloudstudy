package com.englishflow.gateway.config;

import com.nimbusds.jose.JOSEObjectType;
import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.JWSHeader;
import com.nimbusds.jose.crypto.RSASSASigner;
import com.nimbusds.jose.jwk.RSAKey;
import com.nimbusds.jose.jwk.gen.RSAKeyGenerator;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;
import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.jwt.JwtValidationException;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.jwt.JwtException;

import java.time.Instant;
import java.util.Map;
import java.util.List;
import java.util.function.Consumer;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class GatewayJwtValidatorsTest {

    private static final String ISSUER = "https://iam.example.test";
    private static final String AUDIENCE = "yuxuexing-api";

    @Test
    void acceptsOnlyCurrentIssuerAndApiAudience() {
        var validator = GatewayJwtValidators.forSecurity(security());

        assertFalse(validator.validate(jwt(ISSUER, AUDIENCE)).hasErrors());
        assertTrue(validator.validate(jwt("https://other.example.test", AUDIENCE)).hasErrors());
        assertTrue(validator.validate(jwt(ISSUER, "another-api")).hasErrors());
    }

    @Test
    void rejectsExpiredAccessToken() {
        var validator = GatewayJwtValidators.forSecurity(security());
        Instant now = Instant.now();
        Jwt expired = Jwt.withTokenValue("expired")
                .header("alg", "RS256")
                .issuer(ISSUER)
                .audience(List.of(AUDIENCE))
                .issuedAt(now.minusSeconds(600))
                .notBefore(now.minusSeconds(600))
                .expiresAt(now.minusSeconds(300))
                .claim("jti", "expired-token-1")
                .claim("token_type", "access")
                .claim("scope", "learner.profile.read")
                .build();

        assertTrue(validator.validate(expired).hasErrors());
    }

    @Test
    void rejectsEveryMissingRequiredAccessClaim() {
        var validator = GatewayJwtValidators.forSecurity(security());

        for (String claim : List.of("iss", "sub", "aud", "exp", "iat", "nbf", "jti", "token_type", "scope")) {
            assertTrue(validator.validate(jwt(ISSUER, AUDIENCE, claims -> claims.remove(claim))).hasErrors(),
                    () -> "expected missing " + claim + " to be rejected");
        }
    }

    @Test
    void rejectsIncorrectRequiredAccessClaims() {
        var validator = GatewayJwtValidators.forSecurity(security());
        Instant now = Instant.now();

        assertTrue(validator.validate(jwt("https://other.example.test", AUDIENCE)).hasErrors());
        assertTrue(validator.validate(jwt(ISSUER, "wrong-audience")).hasErrors());
        assertTrue(validator.validate(jwt(ISSUER, AUDIENCE, claims -> claims.put("sub", " "))).hasErrors());
        assertTrue(validator.validate(expiredJwt()).hasErrors());
        assertTrue(validator.validate(futureIssuedJwt()).hasErrors());
        assertTrue(validator.validate(jwt(ISSUER, AUDIENCE, claims -> claims.put("nbf", now.plusSeconds(120)))).hasErrors());
        assertTrue(validator.validate(jwt(ISSUER, AUDIENCE, claims -> claims.put("jti", " "))).hasErrors());
        assertTrue(validator.validate(jwt(ISSUER, AUDIENCE, claims -> claims.put("token_type", "refresh"))).hasErrors());
        assertTrue(validator.validate(jwt(ISSUER, AUDIENCE, claims -> claims.put("scope", " "))).hasErrors());
    }

    @Test
    void rejectsMissingOrNonJwtJoseTypeBeforeRouting() throws Exception {
        var validator = GatewayJwtValidators.forSecurity(security());
        assertTrue(validator.validate(jwtWithType(ISSUER, AUDIENCE, null)).hasErrors());
        assertTrue(validator.validate(jwtWithType(ISSUER, AUDIENCE, "at+jwt")).hasErrors());

        RSAKey signingKey = new RSAKeyGenerator(2048).keyID("gateway-typ-test-key").generate();
        NimbusJwtDecoder decoder = NimbusJwtDecoder.withPublicKey(signingKey.toRSAPublicKey()).build();
        decoder.setJwtValidator(validator);

        assertThrows(JwtValidationException.class,
                () -> decoder.decode(signedToken(signingKey, ISSUER, AUDIENCE, JWSAlgorithm.RS256, null)));
        assertThrows(JwtValidationException.class,
                () -> decoder.decode(signedToken(signingKey, ISSUER, AUDIENCE, JWSAlgorithm.RS256, "at+jwt")));
        assertNotNull(decoder.decode(signedToken(signingKey, ISSUER, AUDIENCE, JWSAlgorithm.RS256, "JWT")));
    }

    @Test
    void enabledResourceServerRequiresAudienceAndPrevalidationBacking() {
        var missingAudience = new GatewayProperties.Security(
                false, true, true, ISSUER, " ", ISSUER + "/api/v1/auth/jwks");
        var unbackedPrevalidation = new GatewayProperties.Security(
                true, false, true, ISSUER, AUDIENCE, ISSUER + "/api/v1/auth/jwks");

        assertFalse(missingAudience.isAudienceConfiguredWhenEnabled());
        assertFalse(unbackedPrevalidation.isPrevalidationBackedByResourceServer());
    }

    @Test
    void configuresIamJwksAndVerifiesAnRs256AccessToken() throws Exception {
        RSAKey signingKey = new RSAKeyGenerator(2048).keyID("gateway-test-key").generate();
        GatewayProperties.Security security = new GatewayProperties.Security(
                false, true, true, "http://iam.example.test", AUDIENCE,
                "http://iam.example.test/api/v1/auth/jwks");
        assertEquals("http://iam.example.test/api/v1/auth/jwks", security.jwkSetUri());

        NimbusJwtDecoder decoder = NimbusJwtDecoder.withPublicKey(signingKey.toRSAPublicKey()).build();
        decoder.setJwtValidator(GatewayJwtValidators.forSecurity(security));

        Jwt decoded = decoder.decode(signedToken(signingKey, security.issuerUri(), AUDIENCE));

        assertNotNull(decoded);
        assertEquals("subject-1", decoded.getSubject());
        assertEquals(security.issuerUri(), decoded.getIssuer().toString());
        assertThrows(JwtValidationException.class,
                () -> decoder.decode(signedToken(signingKey, security.issuerUri(), "wrong-audience")));
    }

    @Test
    void rejectsInvalidSignatureAndAlgorithm() throws Exception {
        RSAKey signingKey = new RSAKeyGenerator(2048).keyID("gateway-test-key").generate();
        RSAKey differentKey = new RSAKeyGenerator(2048).keyID("different-key").generate();
        GatewayProperties.Security security = security();

        NimbusJwtDecoder decoder = NimbusJwtDecoder.withPublicKey(signingKey.toRSAPublicKey()).build();
        decoder.setJwtValidator(GatewayJwtValidators.forSecurity(security));

        assertThrows(JwtException.class,
                () -> decoder.decode(signedToken(differentKey, ISSUER, AUDIENCE)));
        assertThrows(JwtException.class,
                () -> decoder.decode(signedToken(signingKey, ISSUER, AUDIENCE, JWSAlgorithm.RS512)));
    }

    private static String signedToken(RSAKey signingKey, String issuer, String audience) throws Exception {
        return signedToken(signingKey, issuer, audience, JWSAlgorithm.RS256);
    }

    private static String signedToken(RSAKey signingKey, String issuer, String audience, JWSAlgorithm algorithm) throws Exception {
        return signedToken(signingKey, issuer, audience, algorithm, "JWT");
    }

    private static String signedToken(
            RSAKey signingKey,
            String issuer,
            String audience,
            JWSAlgorithm algorithm,
            String joseType
    ) throws Exception {
        Instant now = Instant.now();
        JWSHeader.Builder header = new JWSHeader.Builder(algorithm).keyID(signingKey.getKeyID());
        if (joseType != null) {
            header.type(new JOSEObjectType(joseType));
        }
        SignedJWT token = new SignedJWT(
                header.build(),
                new JWTClaimsSet.Builder()
                        .issuer(issuer)
                        .subject("subject-1")
                        .audience(audience)
                        .issueTime(java.util.Date.from(now.minusSeconds(5)))
                        .notBeforeTime(java.util.Date.from(now.minusSeconds(5)))
                        .expirationTime(java.util.Date.from(now.plusSeconds(300)))
                        .jwtID("jwt-1")
                        .claim("token_type", "access")
                        .claim("scope", "learner.profile.read")
                        .build());
        token.sign(new RSASSASigner(signingKey.toPrivateKey()));
        return token.serialize();
    }

    private static GatewayProperties.Security security() {
        return new GatewayProperties.Security(
                false, true, true, ISSUER, AUDIENCE, ISSUER + "/api/v1/auth/jwks");
    }

    private static Jwt jwt(String issuer, String audience) {
        return jwt(issuer, audience, ignored -> { });
    }

    private static Jwt jwt(String issuer, String audience, Consumer<Map<String, Object>> claims) {
        return jwtWithType(issuer, audience, "JWT", claims);
    }

    private static Jwt jwtWithType(String issuer, String audience, String joseType) {
        return jwtWithType(issuer, audience, joseType, ignored -> { });
    }

    private static Jwt jwtWithType(
            String issuer,
            String audience,
            String joseType,
            Consumer<Map<String, Object>> claims
    ) {
        Instant now = Instant.now();
        var builder = Jwt.withTokenValue("access-token")
                .header("alg", "RS256");
        if (joseType != null) {
            builder.header("typ", joseType);
        }
        return builder
                .issuer(issuer)
                .audience(List.of(audience))
                .subject("subject-1")
                .issuedAt(now.minusSeconds(5))
                .notBefore(now.minusSeconds(5))
                .expiresAt(now.plusSeconds(60))
                .claim("jti", "jwt-1")
                .claim("token_type", "access")
                .claim("scope", "learner.profile.read")
                .claims(claims)
                .build();
    }

    private static Jwt expiredJwt() {
        Instant now = Instant.now();
        return Jwt.withTokenValue("expired-access-token")
                .header("alg", "RS256")
                .issuer(ISSUER)
                .audience(List.of(AUDIENCE))
                .subject("subject-1")
                .issuedAt(now.minusSeconds(300))
                .notBefore(now.minusSeconds(300))
                .expiresAt(now.minusSeconds(120))
                .claim("jti", "expired-jwt-1")
                .claim("token_type", "access")
                .claim("scope", "learner.profile.read")
                .build();
    }

    private static Jwt futureIssuedJwt() {
        Instant now = Instant.now();
        return Jwt.withTokenValue("future-issued-access-token")
                .header("alg", "RS256")
                .issuer(ISSUER)
                .audience(List.of(AUDIENCE))
                .subject("subject-1")
                .issuedAt(now.plusSeconds(120))
                .notBefore(now.minusSeconds(5))
                .expiresAt(now.plusSeconds(300))
                .claim("jti", "future-jwt-1")
                .claim("token_type", "access")
                .claim("scope", "learner.profile.read")
                .build();
    }
}
