package com.englishflow.gateway.config;

import com.nimbusds.jose.JOSEObjectType;
import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.JWSHeader;
import com.nimbusds.jose.crypto.RSASSASigner;
import com.nimbusds.jose.jwk.RSAKey;
import com.nimbusds.jose.jwk.gen.RSAKeyGenerator;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.jwt.JwtValidationException;
import org.springframework.security.oauth2.jwt.ReactiveJwtDecoder;
import org.springframework.security.oauth2.jwt.Jwt;

import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.time.Instant;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class GatewayJwtValidatorsTest {

    private static final String ISSUER = "https://idp.example.test/issuer";

    @Test
    void acceptsOnlyCurrentIssuerAndApiAudience() {
        var validator = GatewayJwtValidators.forSecurity(security());

        assertFalse(validator.validate(jwt(ISSUER, "englishflow-api")).hasErrors());
        assertTrue(validator.validate(jwt("https://other.example.test", "englishflow-api")).hasErrors());
        assertTrue(validator.validate(jwt(ISSUER, "another-api")).hasErrors());
    }

    @Test
    void rejectsExpiredAccessToken() {
        var validator = GatewayJwtValidators.forSecurity(security());
        Instant now = Instant.now();
        Jwt expired = Jwt.withTokenValue("expired")
                .header("alg", "RS256")
                .issuer(ISSUER)
                .audience(List.of("englishflow-api"))
                .issuedAt(now.minusSeconds(600))
                .expiresAt(now.minusSeconds(300))
                .build();

        assertTrue(validator.validate(expired).hasErrors());
    }

    @Test
    void enabledResourceServerRequiresAudienceAndPrevalidationBacking() {
        var missingAudience = new GatewayProperties.Security(
                false, true, true, ISSUER, " ");
        var unbackedPrevalidation = new GatewayProperties.Security(
                true, false, true, ISSUER, "englishflow-api");

        assertFalse(missingAudience.isAudienceConfiguredWhenEnabled());
        assertFalse(unbackedPrevalidation.isPrevalidationBackedByResourceServer());
    }

    @Test
    void discoversIssuerAndVerifiesAccessTokenWithRotatableJwks() throws Exception {
        RSAKey signingKey = new RSAKeyGenerator(2048).keyID("gateway-test-key").generate();
        HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        String issuer = "http://127.0.0.1:" + server.getAddress().getPort();
        server.createContext("/.well-known/openid-configuration", exchange -> json(exchange,
                "{\"issuer\":\"" + issuer + "\",\"jwks_uri\":\"" + issuer + "/jwks\"}"));
        server.createContext("/jwks", exchange -> json(exchange,
                "{\"keys\":[" + signingKey.toPublicJWK().toJSONString() + "]}"));
        server.start();
        try {
            GatewayProperties.Security security = new GatewayProperties.Security(
                    false, true, true, issuer, "englishflow-api");
            GatewayProperties properties = org.mockito.Mockito.mock(GatewayProperties.class);
            org.mockito.Mockito.when(properties.security()).thenReturn(security);
            ReactiveJwtDecoder decoder = new GatewayConfiguration().gatewayJwtDecoder(properties);

            Jwt decoded = decoder.decode(signedToken(signingKey, issuer, "englishflow-api")).block();

            assertNotNull(decoded);
            assertEquals("subject-1", decoded.getSubject());
            assertEquals(issuer, decoded.getIssuer().toString());
            assertThrows(JwtValidationException.class,
                    () -> decoder.decode(signedToken(signingKey, issuer, "wrong-audience")).block());
        } finally {
            server.stop(0);
        }
    }

    private static String signedToken(RSAKey signingKey, String issuer, String audience) throws Exception {
        Instant now = Instant.now();
        SignedJWT token = new SignedJWT(
                new JWSHeader.Builder(JWSAlgorithm.RS256)
                        .keyID(signingKey.getKeyID())
                        .type(JOSEObjectType.JWT)
                        .build(),
                new JWTClaimsSet.Builder()
                        .issuer(issuer)
                        .subject("subject-1")
                        .audience(audience)
                        .issueTime(java.util.Date.from(now.minusSeconds(5)))
                        .expirationTime(java.util.Date.from(now.plusSeconds(300)))
                        .build());
        token.sign(new RSASSASigner(signingKey.toPrivateKey()));
        return token.serialize();
    }

    private static void json(HttpExchange exchange, String value) throws IOException {
        byte[] bytes = value.getBytes(java.nio.charset.StandardCharsets.UTF_8);
        exchange.getResponseHeaders().set("Content-Type", "application/json");
        exchange.sendResponseHeaders(200, bytes.length);
        try (OutputStream output = exchange.getResponseBody()) {
            output.write(bytes);
        }
    }

    private static GatewayProperties.Security security() {
        return new GatewayProperties.Security(
                false, true, true, ISSUER, "englishflow-api");
    }

    private static Jwt jwt(String issuer, String audience) {
        Instant now = Instant.now();
        return Jwt.withTokenValue("access-token")
                .header("alg", "RS256")
                .issuer(issuer)
                .audience(List.of(audience))
                .issuedAt(now.minusSeconds(5))
                .expiresAt(now.plusSeconds(60))
                .build();
    }
}
