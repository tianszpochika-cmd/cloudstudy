package com.englishflow.gateway.support;

import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.io.ByteArrayOutputStream;
import java.io.PrintStream;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class RuntimeEvidenceSecurityAuditSinkTest {

    private static final Set<String> EXACT_FIELDS = Set.of(
            "schema", "durability", "occurredAt", "routeId", "method", "status",
            "requestId", "traceId", "subjectHash", "tenantHash", "clientProfile",
            "decision", "reasonCode", "latencyBucket");

    @Test
    void emitsOneClosedSchemaNdjsonLineWithBoundedFields() throws Exception {
        ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        RuntimeEvidenceSecurityAuditSink sink = new RuntimeEvidenceSecurityAuditSink(
                new PrintStream(bytes, true, StandardCharsets.UTF_8));
        String longValue = "a".repeat(400);

        sink.record(new SecurityAuditRecord(
                Instant.parse("2026-09-04T00:00:00Z"), longValue, "GET", 200,
                longValue, "trace-1", "1".repeat(64), "2".repeat(64),
                "LEARNER_WEB", "ALLOW", longValue, "LT_50_MS"));

        String output = bytes.toString(StandardCharsets.UTF_8);
        assertEquals(1, output.lines().count());
        JsonNode json = new ObjectMapper().readTree(output.strip());
        assertEquals(EXACT_FIELDS, json.properties().stream().map(java.util.Map.Entry::getKey).collect(java.util.stream.Collectors.toSet()));
        assertEquals(RuntimeEvidenceSecurityAuditSink.SCHEMA, json.path("schema").asText());
        assertEquals(RuntimeEvidenceSecurityAuditSink.DURABILITY, json.path("durability").asText());
        assertEquals(RuntimeEvidenceSecurityAuditSink.ROUTE_ID_LIMIT, json.path("routeId").asText().length());
        assertEquals(RuntimeEvidenceSecurityAuditSink.CORRELATION_ID_LIMIT, json.path("requestId").asText().length());
        assertEquals(RuntimeEvidenceSecurityAuditSink.REASON_CODE_LIMIT, json.path("reasonCode").asText().length());
        assertEquals(64, json.path("subjectHash").asText().length());
        assertEquals(64, json.path("tenantHash").asText().length());
    }

    @Test
    void stripsQueryFragmentsAndRedactsCredentialShapedValues() throws Exception {
        ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        RuntimeEvidenceSecurityAuditSink sink = new RuntimeEvidenceSecurityAuditSink(
                new PrintStream(bytes, true, StandardCharsets.UTF_8));

        sink.record(new SecurityAuditRecord(
                Instant.parse("2026-09-04T00:00:00Z"),
                "gateway-health?access_token=TOP_SECRET", "GET", 401,
                "request-1\r\nCookie: session=DO_NOT_PRINT", "credential-shaped-trace",
                "not-a-hash", "", "NO_BROWSER_PROFILE", "DENY",
                "Bearer eyJabcdefghij.abcdefghijk.abcdefghijk", "LT_50_MS"));

        String output = bytes.toString(StandardCharsets.UTF_8);
        JsonNode json = new ObjectMapper().readTree(output.strip());
        assertEquals("gateway-health", json.path("routeId").asText());
        assertEquals("REDACTED", json.path("requestId").asText());
        assertEquals("REDACTED", json.path("traceId").asText());
        assertEquals("REDACTED", json.path("reasonCode").asText());
        assertEquals("REDACTED", json.path("subjectHash").asText());
        for (String forbidden : Set.of(
                "TOP_SECRET", "DO_NOT_PRINT", "eyJabcdefghij", "access_token=", "credential-shaped-trace")) {
            assertFalse(output.contains(forbidden), forbidden);
        }
        assertFalse(output.strip().contains("\r"));
        assertFalse(output.contains("\nCookie"));
    }

    @Test
    void schemaCannotGrowSensitiveRequestFields() throws Exception {
        ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        RuntimeEvidenceSecurityAuditSink sink = new RuntimeEvidenceSecurityAuditSink(
                new PrintStream(bytes, true, StandardCharsets.UTF_8));
        sink.record(new SecurityAuditRecord(
                Instant.now(), "gateway-health", "GET", 503, "request-1", "trace-1",
                "", "", "NO_BROWSER_PROFILE", "ERROR", "rate_limit_backend_unavailable", "LT_50_MS"));

        JsonNode json = new ObjectMapper().readTree(bytes.toString(StandardCharsets.UTF_8).strip());
        Set<String> lowerFields = json.properties().stream()
                .map(java.util.Map.Entry::getKey)
                .map(String::toLowerCase)
                .collect(java.util.stream.Collectors.toSet());
        for (String forbidden : Set.of("body", "query", "cookie", "token", "credential", "authorization", "password")) {
            assertTrue(lowerFields.stream().noneMatch(field -> field.contains(forbidden)), forbidden);
        }
    }
}
