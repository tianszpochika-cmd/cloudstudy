package com.englishflow.gateway.support;

import tools.jackson.databind.ObjectMapper;

import java.io.PrintStream;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;
import java.util.regex.Pattern;

/**
 * Writes one strict JSON object per line for the explicitly selected
 * {@code m2-evidence} profile.  The projection has a closed field set and is
 * intentionally non-durable: it is only a locally captured M2-001 boundary
 * observation and must never be described as audit-service evidence.
 */
public final class RuntimeEvidenceSecurityAuditSink implements SecurityAuditSink {

    public static final String SCHEMA = "m2.gateway.security-audit.evidence.v1";
    public static final String DURABILITY = "NON_DURABLE_TEST_ONLY";

    static final int ROUTE_ID_LIMIT = 128;
    static final int METHOD_LIMIT = 16;
    static final int CORRELATION_ID_LIMIT = 128;
    static final int HASH_LIMIT = 64;
    static final int CLIENT_PROFILE_LIMIT = 32;
    static final int DECISION_LIMIT = 16;
    static final int REASON_CODE_LIMIT = 128;
    static final int LATENCY_BUCKET_LIMIT = 32;

    private static final Pattern SHA_256 = Pattern.compile("[0-9a-f]{64}");
    private static final Pattern SENSITIVE_ASSIGNMENT = Pattern.compile(
            "(?i)(authorization|cookie|password|credential|access[_-]?token|refresh[_-]?token|private[_-]?key|secret)\\s*[:=]");
    private static final Pattern SENSITIVE_CORRELATION_TERM = Pattern.compile(
            "(?i)(authorization|cookie|password|credential|token|private[_-]?key|secret)");
    private static final Pattern BEARER = Pattern.compile("(?i)\\bbearer\\s+[A-Za-z0-9._~+/-]+=*");
    private static final Pattern COMPACT_JWT = Pattern.compile(
            "[A-Za-z0-9_-]{10,}\\.[A-Za-z0-9_-]{10,}\\.[A-Za-z0-9_-]{10,}");
    private static final Pattern PRIVATE_KEY = Pattern.compile("(?i)-----BEGIN(?: [A-Z]+)? PRIVATE KEY-----");

    private final PrintStream output;
    private final ObjectMapper objectMapper;
    private final Object outputLock = new Object();

    public RuntimeEvidenceSecurityAuditSink(PrintStream output) {
        this(output, new ObjectMapper());
    }

    RuntimeEvidenceSecurityAuditSink(PrintStream output, ObjectMapper objectMapper) {
        this.output = Objects.requireNonNull(output, "output");
        this.objectMapper = Objects.requireNonNull(objectMapper, "objectMapper");
    }

    @Override
    public void record(SecurityAuditRecord record) {
        Objects.requireNonNull(record, "record");
        Map<String, Object> line = new LinkedHashMap<>();
        line.put("schema", SCHEMA);
        line.put("durability", DURABILITY);
        line.put("occurredAt", occurredAt(record.occurredAt()).toString());
        line.put("routeId", safeText(record.routeId(), ROUTE_ID_LIMIT));
        line.put("method", safeText(record.method(), METHOD_LIMIT));
        line.put("status", safeStatus(record.status()));
        line.put("requestId", safeCorrelation(record.requestId()));
        line.put("traceId", safeCorrelation(record.traceId()));
        line.put("subjectHash", safeHash(record.subjectHash()));
        line.put("tenantHash", safeHash(record.tenantHash()));
        line.put("clientProfile", safeText(record.clientProfile(), CLIENT_PROFILE_LIMIT));
        line.put("decision", safeText(record.decision(), DECISION_LIMIT));
        line.put("reasonCode", safeText(record.reasonCode(), REASON_CODE_LIMIT));
        line.put("latencyBucket", safeText(record.latencyBucket(), LATENCY_BUCKET_LIMIT));

        final String encoded;
        try {
            encoded = objectMapper.writeValueAsString(line);
        } catch (Exception exception) {
            throw new IllegalStateException("M2 audit evidence serialization failed", exception);
        }
        synchronized (outputLock) {
            output.println(encoded);
            if (output.checkError()) {
                throw new IllegalStateException("M2 audit evidence stdout write failed");
            }
        }
    }

    private static Instant occurredAt(Instant value) {
        return Objects.requireNonNull(value, "occurredAt");
    }

    private static int safeStatus(int value) {
        return value >= 100 && value <= 599 ? value : 500;
    }

    private static String safeHash(String value) {
        if (value == null || value.isBlank()) return "";
        String normalized = value.trim().toLowerCase(java.util.Locale.ROOT);
        return SHA_256.matcher(normalized).matches() ? normalized : "REDACTED";
    }

    private static String safeCorrelation(String value) {
        if (value != null && SENSITIVE_CORRELATION_TERM.matcher(value).find()) return "REDACTED";
        return safeText(value, CORRELATION_ID_LIMIT);
    }

    private static String safeText(String value, int limit) {
        if (value == null || value.isBlank()) return "";
        String candidate = value.strip();
        int query = candidate.indexOf('?');
        int fragment = candidate.indexOf('#');
        int cut = query < 0 ? fragment : fragment < 0 ? query : Math.min(query, fragment);
        if (cut >= 0) candidate = candidate.substring(0, cut);
        if (looksSensitive(candidate)) return "REDACTED";

        StringBuilder safe = new StringBuilder(Math.min(candidate.length(), limit));
        for (int index = 0; index < candidate.length() && safe.length() < limit; index++) {
            char character = candidate.charAt(index);
            boolean allowed = character >= 'a' && character <= 'z'
                    || character >= 'A' && character <= 'Z'
                    || character >= '0' && character <= '9'
                    || character == '.' || character == '_' || character == ':' || character == '-';
            safe.append(allowed ? character : '_');
        }
        return safe.toString();
    }

    private static boolean looksSensitive(String value) {
        return SENSITIVE_ASSIGNMENT.matcher(value).find()
                || BEARER.matcher(value).find()
                || COMPACT_JWT.matcher(value).find()
                || PRIVATE_KEY.matcher(value).find();
    }
}
