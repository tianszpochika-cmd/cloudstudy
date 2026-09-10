package com.englishflow.gateway.config;

import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.JWSHeader;
import com.nimbusds.jose.jwk.JWK;
import com.nimbusds.jose.jwk.JWKSet;
import com.nimbusds.jose.jwk.RSAKey;
import com.nimbusds.jose.jwk.gen.RSAKeyGenerator;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;
import org.junit.jupiter.api.Test;
import reactor.core.publisher.Mono;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * The IAM public JWKS is published as an {@code ApiSuccessEnvelope}; the Gateway
 * decoder must resolve the documented envelope instead of handing it to
 * {@code JWKSet.parse}, which only accepts a bare RFC 7517 JWK Set.
 */
class GatewayIamPublicJwkSourceTest {

    private static final String KID = "iam-local-test-key";

    @Test
    void resolvesDocumentedEnvelopeAndSelectsThePublishedKey() throws Exception {
        RSAKey key = signingKey(KID);
        GatewayIamPublicJwkSource source = new GatewayIamPublicJwkSource(
                Mono.just(enveloped(key)), fixedClock(Instant.parse("2026-09-10T00:00:00Z")));

        List<JWK> selected = source.select(signedJwtWithKeyId(KID)).collectList().block();

        assertEquals(1, selected.size());
        assertEquals(KID, selected.getFirst().getKeyID());
        assertTrue(selected.getFirst().toJSONString().contains("\"n\""));
        assertTrue(!selected.getFirst().toJSONString().contains("\"d\""),
                "only public key material may be selected");
    }

    @Test
    void toleratesBareJwkSetForDefenceInDepth() throws Exception {
        RSAKey key = signingKey(KID);
        GatewayIamPublicJwkSource source = new GatewayIamPublicJwkSource(
                Mono.just(new JWKSet(key.toPublicJWK()).toString()), fixedClock(Instant.now()));

        assertEquals(1, source.select(signedJwtWithKeyId(KID)).collectList().block().size());
    }

    @Test
    void unknownKidFailsClosedAfterOneBoundedRefetch() throws Exception {
        RSAKey key = signingKey(KID);
        AtomicInteger reads = new AtomicInteger();
        GatewayIamPublicJwkSource source = new GatewayIamPublicJwkSource(
                countingDocument(enveloped(key), reads), fixedClock(Instant.now()));

        assertTrue(source.select(signedJwtWithKeyId("rotated-away")).collectList().block().isEmpty());
        assertEquals(1, reads.get(), "an unknown kid must not retry per request");
    }

    @Test
    void absentKidFailsClosedWithoutReadingTheDocument() throws Exception {
        AtomicInteger reads = new AtomicInteger();
        GatewayIamPublicJwkSource source = new GatewayIamPublicJwkSource(
                countingDocument(enveloped(signingKey(KID)), reads), fixedClock(Instant.now()));

        SignedJWT withoutKeyId = new SignedJWT(
                new JWSHeader.Builder(JWSAlgorithm.RS256).build(),
                new JWTClaimsSet.Builder().build());

        assertTrue(source.select(withoutKeyId).collectList().block().isEmpty());
        assertTrue(source.select(null).collectList().block().isEmpty());
        assertEquals(0, reads.get(), "a token without kid must not trigger an upstream read");
    }

    @Test
    void cachedKeyIsServedWithoutASecondReadWithinTheContractTtl() throws Exception {
        RSAKey key = signingKey(KID);
        AtomicInteger reads = new AtomicInteger();
        GatewayIamPublicJwkSource source = new GatewayIamPublicJwkSource(
                countingDocument(enveloped(key), reads), fixedClock(Instant.now()));

        source.select(signedJwtWithKeyId(KID)).collectList().block();
        source.select(signedJwtWithKeyId(KID)).collectList().block();

        assertEquals(1, reads.get());
    }

    @Test
    void rotationRefetchesOnceThePublishedKeyIdChanges() throws Exception {
        RSAKey first = signingKey("kid-1");
        RSAKey second = signingKey("kid-2");
        AtomicInteger reads = new AtomicInteger();
        Mono<String> document = Mono.defer(() -> {
            int read = reads.incrementAndGet();
            return Mono.just(enveloped(read == 1 ? first : second));
        });
        GatewayIamPublicJwkSource source = new GatewayIamPublicJwkSource(document, fixedClock(Instant.now()));

        source.select(signedJwtWithKeyId("kid-1")).collectList().block();
        List<JWK> rotated = source.select(signedJwtWithKeyId("kid-2")).collectList().block();

        assertEquals(2, reads.get());
        assertEquals("kid-2", rotated.getFirst().getKeyID());
    }

    @Test
    void expiredCacheTriggersExactlyOneSharedRefresh() throws Exception {
        RSAKey key = signingKey(KID);
        AtomicInteger reads = new AtomicInteger();
        MutableClock clock = new MutableClock(Instant.parse("2026-09-10T00:00:00Z"));
        GatewayIamPublicJwkSource source = new GatewayIamPublicJwkSource(
                countingDocument(enveloped(key), reads), clock);

        source.select(signedJwtWithKeyId(KID)).collectList().block();
        clock.advance(GatewayIamPublicJwkSource.CACHE_TTL.plusSeconds(1));

        assertEquals(1, source.select(signedJwtWithKeyId(KID)).collectList().block().size(),
                "an expired cache must refresh before serving the key");
        assertEquals(1, source.select(signedJwtWithKeyId(KID)).collectList().block().size());
        assertEquals(2, reads.get(), "the refresh must be reused, not repeated per request");
    }

    @Test
    void rejectsDocumentsThatAreNotAKeySet() {
        assertThrows(IllegalStateException.class, () -> GatewayIamPublicJwkSource.parseJwkSet(null));
        assertThrows(IllegalStateException.class, () -> GatewayIamPublicJwkSource.parseJwkSet("  "));
        assertThrows(IllegalStateException.class, () -> GatewayIamPublicJwkSource.parseJwkSet("not-json"));
        assertThrows(IllegalStateException.class, () -> GatewayIamPublicJwkSource.parseJwkSet("{\"data\":{}}"));
        assertThrows(IllegalStateException.class, () -> GatewayIamPublicJwkSource.parseJwkSet("{\"keys\":\"nope\"}"));
        assertThrows(IllegalStateException.class, () -> GatewayIamPublicJwkSource.parseJwkSet(
                "{\"data\":{\"keys\":[{\"kty\":\"RSA\"}]},\"meta\":{}}"));
    }

    @Test
    void rejectsDocumentsBeyondTheBoundedReadLimit() {
        String oversized = "{\"data\":{\"keys\":[]},\"pad\":\"" + "a".repeat(
                GatewayIamPublicJwkSource.MAX_DOCUMENT_CHARS) + "\"}";

        assertThrows(IllegalStateException.class, () -> GatewayIamPublicJwkSource.parseJwkSet(oversized));
    }

    @Test
    void documentReadIsBoundedInTime() {
        GatewayIamPublicJwkSource source = new GatewayIamPublicJwkSource(
                Mono.never(), fixedClock(Instant.now()));

        assertThrows(Exception.class, () -> source.select(signedJwtWithKeyId(KID))
                .collectList()
                .block(Duration.ofSeconds(6)));
    }

    private static Mono<String> countingDocument(String body, AtomicInteger reads) {
        return Mono.defer(() -> {
            reads.incrementAndGet();
            return Mono.just(body);
        });
    }

    private static String enveloped(RSAKey key) {
        return "{\"data\":" + new JWKSet(key.toPublicJWK()) + ",\"meta\":{\"requestId\":\"unit-test\"}}";
    }

    private static SignedJWT signedJwtWithKeyId(String keyId) {
        return new SignedJWT(
                new JWSHeader.Builder(JWSAlgorithm.RS256).keyID(keyId).build(),
                new JWTClaimsSet.Builder().build());
    }

    private static RSAKey signingKey(String keyId) throws Exception {
        return new RSAKeyGenerator(2048).keyID(keyId).generate();
    }

    private static Clock fixedClock(Instant instant) {
        return Clock.fixed(instant, ZoneOffset.UTC);
    }

    private static final class MutableClock extends Clock {

        private Instant current;

        private MutableClock(Instant current) {
            this.current = current;
        }

        private void advance(Duration amount) {
            current = current.plus(amount);
        }

        @Override
        public ZoneOffset getZone() {
            return ZoneOffset.UTC;
        }

        @Override
        public Clock withZone(java.time.ZoneId zone) {
            return this;
        }

        @Override
        public Instant instant() {
            return current;
        }
    }
}
