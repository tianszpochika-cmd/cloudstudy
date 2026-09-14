package com.englishflow.gateway.support;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.Instant;
import java.util.concurrent.atomic.AtomicLong;
import java.util.concurrent.atomic.AtomicReference;

/**
 * Obtains and caches the service token the Gateway uses for internal calls (ADR-0016).
 *
 * <p>The token is short-lived by design, so the useful thing to hold is not the token but the ability to get one:
 * this keeps the current token until it is close to expiry, asks again when it is, and can be told that a token it
 * believed in was refused. It never signs anything itself, because the architecture rules make iam-service the only
 * issuer and a Gateway that could mint its own credentials would be an exception to that rule rather than a user of
 * it.
 *
 * <p>Failures are counted and returned as an empty token rather than thrown at the caller. The caller is a security
 * audit path: a request that was allowed must stay allowed when the audit service cannot be reached, and an absent
 * token is a fact the sink records rather than an exception that changes a user's response.
 */
public class ServiceTokenClient {

    /** A token and the moment it stops being usable. */
    public record CachedToken(String value, Instant expiresAt) {
        boolean usableAt(Instant now, Duration margin) {
            return value != null && !value.isBlank() && expiresAt != null && now.plus(margin).isBefore(expiresAt);
        }
    }

    private final URI endpoint;
    private final String clientId;
    private final String clientSecret;
    private final HttpClient client;
    private final Duration timeout;
    private final Duration refreshMargin;
    /** Renewal is serialised so a burst of deliveries does not each ask for its own token. */
    private final Object lock = new Object();
    private final AtomicReference<CachedToken> current = new AtomicReference<>(new CachedToken(null, null));
    private final AtomicLong issued = new AtomicLong();
    private final AtomicLong failures = new AtomicLong();

    public ServiceTokenClient(URI endpoint, String clientId, String clientSecret, Duration timeout,
                              Duration refreshMargin) {
        this(endpoint, clientId, clientSecret, timeout, refreshMargin,
                HttpClient.newBuilder().connectTimeout(timeout).build());
    }

    ServiceTokenClient(URI endpoint, String clientId, String clientSecret, Duration timeout, Duration refreshMargin,
                       HttpClient client) {
        this.endpoint = endpoint;
        this.clientId = clientId;
        this.clientSecret = clientSecret;
        this.timeout = timeout;
        this.refreshMargin = refreshMargin;
        this.client = client;
    }

    /** Whether a client is configured at all. Without one this returns no token and says nothing else. */
    public boolean configured() {
        return endpoint != null && clientId != null && !clientId.isBlank()
                && clientSecret != null && !clientSecret.isBlank();
    }

    /**
     * The current token, obtaining one if there is none or it is close to expiry.
     *
     * <p>Returns an empty string when no token can be had. An empty string rather than null so a caller cannot
     * accidentally send the header {@code Bearer null}.
     */
    public String token() {
        return token(false);
    }

    /** The current token, asking for a new one first when the caller has been refused. */
    public String token(boolean afterRefusal) {
        if (!configured()) return "";
        CachedToken cached = current.get();
        if (!afterRefusal && cached.usableAt(Instant.now(), refreshMargin)) return cached.value();
        synchronized (lock) {
            // Another delivery may have renewed it while this one waited.
            CachedToken latest = current.get();
            if (!afterRefusal && latest.usableAt(Instant.now(), refreshMargin)) return latest.value();
            CachedToken fetched = fetch();
            current.set(fetched);
            // The contract is an empty string, and a failed fetch produces a token whose value is null. Returning
            // it directly broke that contract, which the test caught: the caller would have sent "Bearer null".
            return fetched.value() == null ? "" : fetched.value();
        }
    }

    /** Asks IAM for a token. Any failure leaves the cache empty and is counted. */
    private CachedToken fetch() {
        try {
            String body = "{\"clientId\":" + quote(clientId) + ",\"clientSecret\":" + quote(clientSecret) + "}";
            HttpRequest request = HttpRequest.newBuilder(endpoint)
                    .timeout(timeout)
                    .header("content-type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(body))
                    .build();
            HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() != 200) {
                failures.incrementAndGet();
                return new CachedToken(null, null);
            }
            String token = field(response.body(), "accessToken");
            String expiresAt = field(response.body(), "expiresAt");
            if (token == null || expiresAt == null) {
                failures.incrementAndGet();
                return new CachedToken(null, null);
            }
            issued.incrementAndGet();
            return new CachedToken(token, Instant.parse(expiresAt));
        } catch (RuntimeException | java.io.IOException | InterruptedException failure) {
            if (failure instanceof InterruptedException) Thread.currentThread().interrupt();
            failures.incrementAndGet();
            return new CachedToken(null, null);
        }
    }

    /** Counts an operator can read: how often a token was obtained and how often that failed. */
    public java.util.Map<String, Long> counters() {
        return java.util.Map.of("issued", issued.get(), "failures", failures.get());
    }

    /** A minimal string-field reader, so this needs no JSON dependency of its own. */
    private static String field(String json, String name) {
        java.util.regex.Matcher match = java.util.regex.Pattern
                .compile("\"" + name + "\"\\s*:\\s*\"([^\"]*)\"").matcher(json);
        return match.find() ? match.group(1) : null;
    }

    private static String quote(String value) {
        return "\"" + value.replace("\\", "\\\\").replace("\"", "\\\"") + "\"";
    }
}
