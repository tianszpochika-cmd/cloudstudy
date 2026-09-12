package com.englishflow.assessment.security;

import com.nimbusds.jose.jwk.JWKMatcher;
import com.nimbusds.jose.jwk.JWKSelector;
import com.nimbusds.jose.jwk.JWKSet;
import com.nimbusds.jose.jwk.RSAKey;
import com.nimbusds.jose.jwk.gen.RSAKeyGenerator;

import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class IamEnvelopedJwkSourceTest {

    private static final Instant NOW = Instant.parse("2026-09-11T00:00:00Z");

    private static RSAKey rsaKey() throws Exception {
        return new RSAKeyGenerator(2048).keyID("iam-test-key").generate();
    }

    @Test
    void acceptsTheCanonicalEnvelopeAndABareJwkSet() throws Exception {
        JWKSet bare = new JWKSet(rsaKey());
        String envelope = "{\"data\":" + bare.toString() + ",\"meta\":{\"apiVersion\":\"v1\"}}";

        assertEquals(1, IamEnvelopedJwkSource.parseJwkSet(envelope).getKeys().size());
        assertEquals(1, IamEnvelopedJwkSource.parseJwkSet(bare.toString()).getKeys().size());
    }

    @Test
    void rejectsDocumentsWithoutAKeyList() {
        assertThrows(IllegalStateException.class, () -> IamEnvelopedJwkSource.parseJwkSet(""));
        assertThrows(IllegalStateException.class, () -> IamEnvelopedJwkSource.parseJwkSet("not-json"));
        assertThrows(IllegalStateException.class, () -> IamEnvelopedJwkSource.parseJwkSet("{\"data\":{\"meta\":{}}}"));
    }

    @Test
    void selectsPublishedKeysByKeyId() throws Exception {
        RSAKey key = rsaKey();
        JWKSet set = new JWKSet(key);
        AtomicInteger fetches = new AtomicInteger();
        IamEnvelopedJwkSource source = new IamEnvelopedJwkSource(() -> {
            fetches.incrementAndGet();
            return "{\"data\":" + set + "}";
        }, Clock.fixed(NOW, ZoneOffset.UTC));

        JWKSelector selector = new JWKSelector(new JWKMatcher.Builder().keyID("iam-test-key").build());
        assertEquals(1, source.get(selector, null).size());
        assertEquals(0, source.get(new JWKSelector(new JWKMatcher.Builder().keyID("other").build()), null).size());
        assertEquals(1, fetches.get(), "the cached key set must not be re-fetched inside the TTL");
    }

    @Test
    void emptyPublishedKeySetsFailClosed() {
        IamEnvelopedJwkSource source = new IamEnvelopedJwkSource(
                () -> "{\"data\":{\"keys\":[]}}", Clock.fixed(NOW, ZoneOffset.UTC));
        assertThrows(IllegalStateException.class,
                () -> source.get(new JWKSelector(new JWKMatcher.Builder().build()), null));
    }
}
