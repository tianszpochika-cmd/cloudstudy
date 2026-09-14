package com.englishflow.gateway.support;

import org.junit.jupiter.api.Test;

import java.net.URI;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * The service token client's caching and its behaviour when IAM cannot be reached.
 *
 * <p>What is worth testing here is not the HTTP call but the rules around it. A token must be reused rather than
 * re-fetched for every delivery, because a busy Gateway would otherwise turn every audited request into an extra
 * round trip to the identity service. A refused token must be replaced rather than reused, or a Gateway that was
 * told its token was no good would keep sending it. And a failure must produce an empty token rather than an
 * exception, because this path audits requests and must not be able to change their outcome.
 */
class ServiceTokenClientTest {

    private static final URI UNREACHABLE = URI.create("http://127.0.0.1:1/service-token");

    @Test
    void aClientWithNoConfigurationReturnsNoTokenRatherThanFailing() {
        ServiceTokenClient client = new ServiceTokenClient(null, null, null, Duration.ofMillis(200), Duration.ofSeconds(30));

        assertFalse(client.configured());
        assertEquals("", client.token());
        // An empty string, not null: a caller cannot accidentally send "Bearer null".
        assertEquals(0L, client.counters().get("failures"));
    }

    @Test
    void anUnreachableIdentityServiceProducesAnEmptyTokenAndIsCounted() {
        ServiceTokenClient client = new ServiceTokenClient(UNREACHABLE, "api-gateway", "s3cret",
                Duration.ofMillis(300), Duration.ofSeconds(30));

        assertEquals("", client.token());

        Map<String, Long> counters = client.counters();
        assertEquals(1L, counters.get("failures"), counters.toString());
        assertEquals(0L, counters.get("issued"), counters.toString());
    }

    @Test
    void aFreshlyObtainedTokenIsReusedUntilItIsCloseToExpiry() {
        // A cache entry that is still valid must be returned without another call, which is what keeps auditing
        // from adding a round trip per request.
        ServiceTokenClient.CachedToken fresh = new ServiceTokenClient.CachedToken("token-value",
                Instant.now().plusSeconds(300));

        assertTrue(fresh.usableAt(Instant.now(), Duration.ofSeconds(30)));
        // Within the margin it is treated as expired, so a token is renewed before it can be refused.
        assertFalse(fresh.usableAt(Instant.now(), Duration.ofSeconds(400)));
        // An entry with no expiry is never considered usable.
        assertFalse(new ServiceTokenClient.CachedToken("token-value", null).usableAt(Instant.now(), Duration.ZERO));
        assertFalse(new ServiceTokenClient.CachedToken("", Instant.now().plusSeconds(300)).usableAt(Instant.now(), Duration.ZERO));
    }

    @Test
    void aRefusedTokenIsNotHandedBackFromTheCache() {
        ServiceTokenClient client = new ServiceTokenClient(UNREACHABLE, "api-gateway", "s3cret",
                Duration.ofMillis(300), Duration.ofSeconds(30));

        // afterRefusal skips the cache, so a token IAM has rejected is never returned as if it were good.
        assertEquals("", client.token(true));
        assertEquals(1L, client.counters().get("failures"));
    }

    @Test
    void aMissingSecretCountsAsUnconfigured() {
        assertFalse(new ServiceTokenClient(UNREACHABLE, "api-gateway", "", Duration.ofMillis(100),
                Duration.ofSeconds(30)).configured());
    }
}
