package com.englishflow.gateway.support;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Map;

/**
 * Sends the redacted Gateway audit record to the canonical audit ingest.
 *
 * <p>The two sinks that existed before this one are a bounded in-memory buffer and a stdout projection, and the
 * configuration's own documentation said neither was durable. A security decision that is only in memory is lost
 * on restart and gone on redeploy, which is the one thing a security audit cannot be.
 *
 * <p>Delivery is attempted off the request thread. Auditing must not be able to stall the traffic it observes,
 * and it must not be able to fail a request either: a request that was allowed stays allowed even if the audit
 * service is down. What it must not do is pretend. A failure is recorded locally and reported through the
 * counters below, so "the audit service was unreachable for a while" is a fact an operator can see rather than
 * a silence they have to guess at.
 */
public class HttpSecurityAuditSink implements SecurityAuditSink {

    private static final String SCHEMA_VERSION = "m2.gateway.security-audit.evidence.v1";

    private final URI endpoint;
    private final String bearerToken;
    private final HttpClient client;
    private final Duration timeout;
    private final java.util.concurrent.Executor executor;
    private final java.util.concurrent.atomic.AtomicLong delivered = new java.util.concurrent.atomic.AtomicLong();
    private final java.util.concurrent.atomic.AtomicLong failed = new java.util.concurrent.atomic.AtomicLong();
    private final java.util.concurrent.atomic.AtomicLong dropped = new java.util.concurrent.atomic.AtomicLong();

    public HttpSecurityAuditSink(URI endpoint, String bearerToken, Duration timeout) {
        this(endpoint, bearerToken, timeout,
                HttpClient.newBuilder().connectTimeout(timeout).build(),
                java.util.concurrent.Executors.newSingleThreadExecutor((runnable) -> {
                    Thread thread = new Thread(runnable, "gateway-security-audit");
                    // A daemon thread so the executor can never hold the process open at shutdown.
                    thread.setDaemon(true);
                    return thread;
                }));
    }

    HttpSecurityAuditSink(URI endpoint, String bearerToken, Duration timeout, HttpClient client,
                          java.util.concurrent.Executor executor) {
        this.endpoint = endpoint;
        this.bearerToken = bearerToken;
        this.timeout = timeout;
        this.client = client;
        this.executor = executor;
    }

    @Override
    public void record(SecurityAuditRecord record) {
        try {
            executor.execute(() -> send(record));
        } catch (java.util.concurrent.RejectedExecutionException shutdown) {
            // The executor is gone, which happens during shutdown. Counted rather than ignored so a burst of
            // drops at shutdown is visible instead of looking like a quiet period.
            dropped.incrementAndGet();
        }
    }

    /** Performs the delivery. Package-private so a test can call it without the executor. */
    void send(SecurityAuditRecord record) {
        try {
            HttpRequest request = HttpRequest.newBuilder(endpoint)
                    .timeout(timeout)
                    .header("content-type", "application/json")
                    .header("authorization", "Bearer " + bearerToken)
                    .POST(HttpRequest.BodyPublishers.ofString(envelope(record)))
                    .build();
            HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
            // 202 is the first acceptance and 200 the duplicate replay; both mean the fact is durable.
            if (response.statusCode() == 202 || response.statusCode() == 200) {
                delivered.incrementAndGet();
            } else {
                failed.incrementAndGet();
            }
        } catch (RuntimeException | java.io.IOException | InterruptedException failure) {
            if (failure instanceof InterruptedException) {
                Thread.currentThread().interrupt();
            }
            failed.incrementAndGet();
        }
    }

    /**
     * The envelope the canonical ingest accepts.
     *
     * <p>Built from the redacted record only, so nothing the Gateway never held can appear here: the record
     * already excludes path parameters, query strings, bodies, cookies, tokens and client authority headers, and
     * this mapping adds nothing to it.
     */
    String envelope(SecurityAuditRecord record) {
        String eventId = java.util.UUID.randomUUID().toString();
        Map<String, Object> payload = new java.util.LinkedHashMap<>();
        payload.put("eventId", eventId);
        payload.put("sourceService", "api-gateway");
        payload.put("schemaVersion", SCHEMA_VERSION);
        payload.put("tenantId", "platform");
        // The actor hash comes from the record's subject hash, which is already a digest; the event id doubles as
        // the audit id so a caller holding the response can find what was stored for its own request.
        payload.put("actorSubjectHash", record.subjectHash() == null ? null : pad(record.subjectHash()));
        payload.put("action", record.routeId() == null ? "gateway.unknown-route" : "gateway." + record.routeId());
        payload.put("decision", record.decision() == null ? "UNKNOWN" : record.decision());
        payload.put("reasonCode", record.reasonCode() == null ? "UNRECORDED" : record.reasonCode());
        payload.put("occurredAt", record.occurredAt() == null ? java.time.Instant.now().toString() : record.occurredAt().toString());
        payload.put("requestId", record.requestId());
        payload.put("traceId", record.traceId());
        payload.put("redactedPayload", redactedDetail(record));
        return toJson(payload);
    }

    /** The fields the Gateway may disclose, and nothing else. */
    private static Map<String, Object> redactedDetail(SecurityAuditRecord record) {
        Map<String, Object> detail = new java.util.LinkedHashMap<>();
        detail.put("method", record.method());
        detail.put("status", record.status());
        detail.put("tenantHash", record.tenantHash());
        detail.put("clientProfile", record.clientProfile());
        detail.put("latencyBucket", record.latencyBucket());
        return detail;
    }

    /** The ingest stores a 64-character actor hash, so a shorter digest is padded rather than rejected. */
    private static String pad(String hash) {
        return hash.length() >= 64 ? hash.substring(0, 64) : hash + "0".repeat(64 - hash.length());
    }

    private static String toJson(Object value) {
        StringBuilder out = new StringBuilder();
        write(out, value);
        return out.toString();
    }

    private static void write(StringBuilder out, Object value) {
        switch (value) {
            case null -> out.append("null");
            case String text -> out.append('"').append(text.replace("\\", "\\\\").replace("\"", "\\\"")
                    .replace("\n", "\\n").replace("\r", "\\r").replace("\t", "\\t")).append('"');
            case Number number -> out.append(number);
            case Boolean flag -> out.append(flag);
            case Map<?, ?> map -> {
                out.append('{');
                boolean first = true;
                for (Map.Entry<?, ?> entry : map.entrySet()) {
                    if (!first) out.append(',');
                    first = false;
                    write(out, String.valueOf(entry.getKey()));
                    out.append(':');
                    write(out, entry.getValue());
                }
                out.append('}');
            }
            default -> write(out, String.valueOf(value));
        }
    }

    /** Counts an operator can read to see whether auditing is keeping up. */
    public Map<String, Long> counters() {
        return Map.of("delivered", delivered.get(), "failed", failed.get(), "dropped", dropped.get());
    }
}
