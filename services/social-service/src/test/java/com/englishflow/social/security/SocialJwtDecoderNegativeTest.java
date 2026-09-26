package com.englishflow.social.security;

import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.JWSHeader;
import com.nimbusds.jose.JWSSigner;
import com.nimbusds.jose.crypto.MACSigner;
import com.nimbusds.jose.crypto.RSASSASigner;
import com.nimbusds.jose.jwk.JWKSet;
import com.nimbusds.jose.jwk.RSAKey;
import com.nimbusds.jose.jwk.gen.RSAKeyGenerator;
import com.nimbusds.jose.proc.JWSVerificationKeySelector;
import com.nimbusds.jose.proc.SecurityContext;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;
import com.nimbusds.jwt.proc.DefaultJWTProcessor;

import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;

import java.lang.reflect.Method;
import java.time.Clock;
import java.time.Instant;
import java.util.Date;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

/**
 * Per-service JWT verification negatives: the real decoder must accept a correctly signed token
 * and reject bad signatures, expiry, wrong issuer/audience and non-RS256 algorithms.
 */
class SocialJwtDecoderNegativeTest {

    private static final String ISSUER = "http://iam.test";
    private static final String AUDIENCE = "yuxuexing-api";
    private static final String KEY_ID = "iam-test-key";

    private static RSAKey signingKey;
    private static RSAKey attackerKey;

    @BeforeAll
    static void prepareKeys() throws Exception {
        signingKey = new RSAKeyGenerator(2048).keyID(KEY_ID).generate();
        attackerKey = new RSAKeyGenerator(2048).keyID(KEY_ID).generate();
    }

    @Test
    void validTokenIsAccepted() throws Exception {
        assertNotNull(decoder().decode(token(signingKey, ISSUER, AUDIENCE,
                Instant.now().plusSeconds(300), JWSAlgorithm.RS256)));
    }

    @Test
    void badSignatureIsRejected() throws Exception {
        assertThrows(JwtException.class, () -> decoder().decode(token(attackerKey, ISSUER, AUDIENCE,
                Instant.now().plusSeconds(300), JWSAlgorithm.RS256)));
    }

    @Test
    void expiredTokenIsRejected() throws Exception {
        assertThrows(JwtException.class, () -> decoder().decode(token(signingKey, ISSUER, AUDIENCE,
                Instant.now().minusSeconds(120), JWSAlgorithm.RS256)));
    }

    @Test
    void wrongIssuerIsRejected() throws Exception {
        assertThrows(JwtException.class, () -> decoder().decode(token(signingKey, "http://evil.test", AUDIENCE,
                Instant.now().plusSeconds(300), JWSAlgorithm.RS256)));
    }

    @Test
    void wrongAudienceIsRejected() throws Exception {
        assertThrows(JwtException.class, () -> decoder().decode(token(signingKey, ISSUER, "other-api",
                Instant.now().plusSeconds(300), JWSAlgorithm.RS256)));
    }

    @Test
    void nonRs256AlgorithmIsRejected() throws Exception {
        assertThrows(JwtException.class, () -> decoder().decode(token(null, ISSUER, AUDIENCE,
                Instant.now().plusSeconds(300), JWSAlgorithm.HS256)));
    }

    @SuppressWarnings("unchecked")
    private JwtDecoder decoder() throws Exception {
        String envelope = "{\"data\":" + new JWKSet(signingKey.toPublicJWK()) + "}";
        IamEnvelopedJwkSource jwkSource = new IamEnvelopedJwkSource(
                () -> envelope, Clock.systemUTC());
        DefaultJWTProcessor<SecurityContext> processor = new DefaultJWTProcessor<>();
        processor.setJWSKeySelector(
                new JWSVerificationKeySelector<>(JWSAlgorithm.Family.RSA, jwkSource));
        NimbusJwtDecoder decoder = new NimbusJwtDecoder(processor);

        // Keep the production validator under test while injecting JWKS in memory. Reflection is
        // limited to the private validator factory so this test does not duplicate its rules.
        Method validatorFactory = SocialSecurityConfiguration.class.getDeclaredMethod(
                "jwtValidator", String.class, String.class);
        validatorFactory.setAccessible(true);
        OAuth2TokenValidator<Jwt> validator = (OAuth2TokenValidator<Jwt>) validatorFactory.invoke(
                null, ISSUER, AUDIENCE);
        decoder.setJwtValidator(validator);
        return decoder;
    }

    private static String token(RSAKey key, String issuer, String audience, Instant expiresAt, JWSAlgorithm algorithm)
            throws Exception {
        JWTClaimsSet claims = new JWTClaimsSet.Builder()
                .subject("principal-1")
                .issuer(issuer)
                .audience(audience)
                .issueTime(Date.from(Instant.now()))
                .expirationTime(Date.from(expiresAt))
                .claim("token_type", "access")
                .claim("scope", "learning.plan.read")
                .claim("permissions", List.of("learning.plan.read"))
                .build();
        SignedJWT jwt = new SignedJWT(new JWSHeader.Builder(algorithm).keyID(KEY_ID).build(), claims);
        JWSSigner signer = key == null
                ? new MACSigner("0123456789012345678901234567890101234567890123456789012345678901")
                : new RSASSASigner(key);
        jwt.sign(signer);
        return jwt.serialize();
    }
}
