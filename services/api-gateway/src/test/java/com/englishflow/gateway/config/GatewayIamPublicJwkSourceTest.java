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
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import reactor.core.publisher.Mono;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.LinkedHashMap;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;

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
    void rejectsSyntheticPrivateRsaInBareAndEnvelopedDocuments() throws Exception {
        RSAKey privateKey = signingKey(KID);
        String privateDocument = new JWKSet(privateKey).toString(false);

        assertPrivateRejected(privateDocument);
        assertPrivateRejected("{\"data\":" + privateDocument + ",\"meta\":{\"requestId\":\"unit-test\"}}");
    }

    @Test
    void rejectsEntireMixedDocumentInsteadOfSelectingItsPublicKey() throws Exception {
        RSAKey publicKey = signingKey(KID).toPublicJWK();
        RSAKey privateKey = signingKey("synthetic-private");
        String mixed = new JWKSet(List.of(publicKey, privateKey)).toString(false);
        GatewayIamPublicJwkSource source = new GatewayIamPublicJwkSource(Mono.just(mixed), fixedClock(Instant.now()));

        IllegalStateException failure = assertThrows(IllegalStateException.class,
                () -> source.select(signedJwtWithKeyId(KID)).collectList().block());
        assertSafePrivateFailure(failure);
    }

    @ParameterizedTest
    @ValueSource(strings = {"d", "p", "q", "dp", "dq", "qi", "oth", "k"})
    void rejectsPrivateMemberPresenceEvenIfMalformedOrNull(String member) throws Exception {
        for (Object value : new Object[]{"synthetic-private-marker", 7, List.of(), Map.of()}) {
            Map<String, Object> key = new LinkedHashMap<>(signingKey(KID).toPublicJWK().toJSONObject());
            key.put(member, value);
            assertPrivateRejected(com.nimbusds.jose.util.JSONObjectUtils.toJSONString(Map.of("keys", List.of(key))));
        }
        Map<String, Object> nullMember = new LinkedHashMap<>(signingKey(KID).toPublicJWK().toJSONObject());
        nullMember.put(member, null);
        assertPrivateRejected(com.nimbusds.jose.util.JSONObjectUtils.toJSONString(Map.of("keys", List.of(nullMember))));
    }

    @Test
    void rejectsPrivateMembersInUnsupportedMalformedEcOkpAndSymmetricKeys() throws Exception {
        String publicKey = signingKey(KID).toPublicJWK().toJSONString();
        for (String hidden : List.of(
                "{\"kty\":\"UNKNOWN\",\"d\":null}",
                "{\"kty\":\"UNKNOWN\",\"k\":{}}",
                "{\"kty\":\"RSA\",\"oth\":[]}",
                "{\"kty\":\"EC\",\"d\":\"synthetic-private-marker\"}",
                "{\"kty\":\"OKP\",\"d\":\"synthetic-private-marker\"}",
                "{\"kty\":\"oct\",\"k\":\"synthetic-private-marker\"}")) {
            String mixed = "{\"keys\":[" + publicKey + "," + hidden + "]}";
            assertPrivateRejected(mixed);
            assertPrivateRejected("{\"data\":" + mixed + ",\"meta\":{\"requestId\":\"unit-test\"}}");
        }
    }

    @Test
    void privateMaterialInIgnoredEnvelopeOrExtensionCannotBypassTheCheck() throws Exception {
        String publicDocument = new JWKSet(signingKey(KID).toPublicJWK()).toString();
        assertPrivateRejected("{\"data\":" + publicDocument + ",\"keys\":[{\"kty\":\"UNKNOWN\",\"d\":null}]}");
        assertPrivateRejected("{\"data\":" + publicDocument + ",\"extension\":{\"nested\":[{\"k\":null}]}}");
    }

    @Test
    void privateDocumentFailureNeverEntersCacheAndValidRetryRecovers() throws Exception {
        RSAKey key = signingKey(KID);
        AtomicReference<String> currentDocument = new AtomicReference<>(new JWKSet(key).toString(false));
        AtomicInteger reads = new AtomicInteger();
        GatewayIamPublicJwkSource source = new GatewayIamPublicJwkSource(Mono.defer(() -> {
            reads.incrementAndGet();
            return Mono.just(currentDocument.get());
        }), fixedClock(Instant.now()));

        for (int attempt = 0; attempt < 2; attempt++) {
            assertSafePrivateFailure(assertThrows(IllegalStateException.class,
                    () -> source.select(signedJwtWithKeyId(KID)).collectList().block()));
        }
        assertEquals(2, reads.get(), "a rejected document must not become a successful or failed cached key set");
        currentDocument.set(enveloped(key));
        List<JWK> selected = source.select(signedJwtWithKeyId(KID)).collectList().block();
        assertEquals(1, selected.size());
        assertTrue(!selected.getFirst().isPrivate());
        source.select(signedJwtWithKeyId(KID)).collectList().block();
        assertEquals(3, reads.get(), "only a validated public key set may enter the cache");
    }

    @Test
    void malformedDocumentDiagnosticsDoNotRetainInputOrParserCause() {
        for (String malformed : List.of("{\"synthetic-private-marker\":",
                "{\"keys\":[{\"kty\":\"RSA\",\"n\":\"synthetic-private-marker\"}]}")) {
            IllegalStateException failure = assertThrows(IllegalStateException.class,
                    () -> GatewayIamPublicJwkSource.parseJwkSet(malformed));
            assertTrue(!failure.getMessage().contains("synthetic-private-marker"));
            assertNull(failure.getCause());
        }
    }

    private static void assertPrivateRejected(String document) {
        assertSafePrivateFailure(assertThrows(IllegalStateException.class,
                () -> GatewayIamPublicJwkSource.parseJwkSet(document)));
    }

    private static void assertSafePrivateFailure(IllegalStateException failure) {
        assertEquals("IAM public JWKS document contains private key material", failure.getMessage());
        assertNull(failure.getCause(), "parser causes may retain unpublished key material");
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
