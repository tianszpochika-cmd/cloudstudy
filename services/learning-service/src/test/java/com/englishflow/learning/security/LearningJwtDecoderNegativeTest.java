package com.englishflow.learning.security;

import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.JWSHeader;
import com.nimbusds.jose.JWSSigner;
import com.nimbusds.jose.crypto.MACSigner;
import com.nimbusds.jose.crypto.RSASSASigner;
import com.nimbusds.jose.jwk.JWKSet;
import com.nimbusds.jose.jwk.RSAKey;
import com.nimbusds.jose.jwk.gen.RSAKeyGenerator;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;
import com.sun.net.httpserver.HttpServer;

import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtException;

import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

/**
 * Per-service JWT verification negatives: the real decoder must accept a correctly signed token
 * and reject bad signatures, expiry, wrong issuer/audience and non-RS256 algorithms.
 */
class LearningJwtDecoderNegativeTest {

    private static final String ISSUER = "http://iam.test";
    private static final String AUDIENCE = "yuxuexing-api";
    private static final String KEY_ID = "iam-test-key";

    private static HttpServer server;
    private static RSAKey signingKey;
    private static RSAKey attackerKey;

    @BeforeAll
    static void startJwksEndpoint() throws Exception {
        signingKey = new RSAKeyGenerator(2048).keyID(KEY_ID).generate();
        attackerKey = new RSAKeyGenerator(2048).keyID(KEY_ID).generate();
        String envelope = "{\"data\":" + new JWKSet(signingKey.toPublicJWK()) + "}";
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/jwks", exchange -> {
            byte[] body = envelope.getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().add("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, body.length);
            exchange.getResponseBody().write(body);
            exchange.close();
        });
        server.start();
    }

    @AfterAll
    static void stopJwksEndpoint() {
        if (server != null) {
            server.stop(0);
        }
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

    private JwtDecoder decoder() {
        ResourceServerSecurityProperties properties = new ResourceServerSecurityProperties();
        properties.setEnabled(true);
        properties.setIssuerUri(ISSUER);
        properties.setJwkSetUri("http://127.0.0.1:" + server.getAddress().getPort() + "/jwks");
        properties.setAudience(AUDIENCE);
        return new SecurityConfiguration().verifiedJwtDecoder(properties);
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
