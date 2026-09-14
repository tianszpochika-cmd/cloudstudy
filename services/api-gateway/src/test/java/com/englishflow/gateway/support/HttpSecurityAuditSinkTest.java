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
 * The durable sink's envelope and its failure behaviour.
 *
 * <p>Two things matter here and neither is about HTTP plumbing. The envelope must carry only what the Gateway
 * is allowed to disclose, because the whole point of the redacted record is that it excludes path parameters,
 * query strings, bodies, cookies, tokens and client authority headers — and a mapping that adds a field quietly
 * undoes that. And a failure to deliver must be counted rather than swallowed or thrown: auditing must not be
 * able to fail the request it observes, and it must not be able to hide that it stopped working either.
 */
class HttpSecurityAuditSinkTest {

    private static SecurityAuditRecord record() {
        return new SecurityAuditRecord(Instant.parse("2026-09-14T12:00:00Z"), "learner-roster", "GET", 401,
                "req-1", "trace-1", "a".repeat(64), "b".repeat(64), "browser", "DENY", "AUTH_REQUIRED", "lt-10");
    }

    @Test
    void theEnvelopeCarriesOnlyWhatTheRedactedRecordHolds() {
        HttpSecurityAuditSink sink = new HttpSecurityAuditSink(URI.create("http://127.0.0.1:1/audit"), "token",
                Duration.ofMillis(10));

        String envelope = sink.envelope(record());

        assertTrue(envelope.contains("\"sourceService\":\"api-gateway\""));
        assertTrue(envelope.contains("\"schemaVersion\":\"m2.gateway.security-audit.evidence.v1\""));
        assertTrue(envelope.contains("\"requestId\":\"req-1\""));
        assertTrue(envelope.contains("\"traceId\":\"trace-1\""));
        // The action names the route, and the detail carries the qualifying fields only.
        assertTrue(envelope.contains("\"action\":\"gateway.learner-roster\""), envelope);
        assertTrue(envelope.contains("\"latencyBucket\":\"lt-10\""));
        // Nothing that the record deliberately excludes may appear.
        for (String forbidden : new String[]{"authorization", "cookie", "password", "token\":", "query", "body\":"}) {
            assertFalse(envelope.toLowerCase().contains(forbidden),
                    "must not disclose " + forbidden + ": " + envelope);
        }
    }

    @Test
    void aShortSubjectHashIsPaddedRatherThanRejected() {
        HttpSecurityAuditSink sink = new HttpSecurityAuditSink(URI.create("http://127.0.0.1:1/audit"), "token",
                Duration.ofMillis(10));
        SecurityAuditRecord shortHash = new SecurityAuditRecord(Instant.now(), "route", "GET", 200, "r", "t",
                "abc", null, null, "ALLOW", "OK", null);

        String envelope = sink.envelope(shortHash);

        // The ingest stores a 64-character hash; padding keeps a short digest recordable instead of dropping the
        // event, and it is still the same digest with trailing zeroes rather than a different value.
        assertTrue(envelope.contains("a".repeat(0) + "abc" + "0".repeat(61)), envelope);
    }

    @Test
    void aFailedDeliveryIsCountedAndDoesNotThrow() {
        // Port 1 refuses the connection, so this is a real delivery failure rather than a simulated one.
        HttpSecurityAuditSink sink = new HttpSecurityAuditSink(URI.create("http://127.0.0.1:1/audit"), "token",
                Duration.ofMillis(200));

        sink.send(record());

        Map<String, Long> counters = sink.counters();
        assertEquals(1L, counters.get("failed"), counters.toString());
        assertEquals(0L, counters.get("delivered"), counters.toString());
    }
}
