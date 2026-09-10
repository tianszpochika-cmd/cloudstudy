package com.englishflow.gateway.config;

import com.nimbusds.jose.jwk.JWK;
import com.nimbusds.jose.jwk.JWKSet;
import com.nimbusds.jose.util.JSONObjectUtils;
import com.nimbusds.jwt.SignedJWT;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.text.ParseException;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.atomic.AtomicReference;

/**
 * Resolves the IAM public verification keys for the Gateway JWT decoder.
 *
 * <p>The frozen IAM contract publishes {@code /api/v1/auth/jwks} as
 * {@code ApiSuccessEnvelope<JwksResponse>} ({@code {"data":{"keys":[...]},"meta":{...}}}),
 * so the stock {@code NimbusReactiveJwtDecoder.withJwkSetUri} parser cannot read it:
 * it hands the whole document to {@code JWKSet.parse}, which expects a bare
 * RFC 7517 JWK Set at the top level. This source unwraps the documented envelope
 * before parsing, keeps a bounded public-key cache and fails closed for an
 * unknown or absent {@code kid}.
 *
 * <p>Only public key material is ever read, cached or exposed; the document read
 * is bounded in time and size, and a single refresh is shared by concurrent
 * requests so an expired cache cannot turn into an upstream request storm.
 */
final class GatewayIamPublicJwkSource {

    /** The IAM contract caps public JWKS caching at 300 seconds. */
    static final Duration CACHE_TTL = Duration.ofSeconds(300);

    /** A public key list is small; never hold a request open longer than this. */
    static final Duration REQUEST_TIMEOUT = Duration.ofSeconds(2);

    /** Bounded document read; a JWKS for RS256 keys is a few hundred bytes. */
    static final int MAX_DOCUMENT_CHARS = 256 * 1024;

    private final Mono<String> document;
    private final Clock clock;
    private final AtomicReference<Mono<JWKSet>> refreshInFlight = new AtomicReference<>();
    private volatile CachedJwkSet cached;

    GatewayIamPublicJwkSource(String jwkSetUri, Clock clock) {
        this(readDocument(jwkSetUri), clock);
    }

    GatewayIamPublicJwkSource(Mono<String> document, Clock clock) {
        this.document = Objects.requireNonNull(document, "document");
        this.clock = Objects.requireNonNull(clock, "clock");
    }

    /**
     * Selects the published public keys that can verify the presented JWT.
     * An empty result is deliberate and fails closed: unknown {@code kid},
     * absent {@code kid} and rotated-but-unpublished keys all yield no key.
     */
    Flux<JWK> select(SignedJWT signedJwt) {
        String keyId = signedJwt == null ? null : signedJwt.getHeader().getKeyID();
        if (keyId == null || keyId.isBlank()) {
            return Flux.empty();
        }
        CachedJwkSet snapshot = cached;
        if (snapshot != null && !snapshot.expiredAt(clock)) {
            List<JWK> matched = snapshot.matching(keyId);
            if (!matched.isEmpty()) {
                return Flux.fromIterable(matched);
            }
        }
        // A miss may mean rotation, so allow exactly one shared bounded refetch.
        return refreshed().flatMapMany(jwkSet -> Flux.fromIterable(matching(jwkSet, keyId)));
    }

    private Mono<JWKSet> refreshed() {
        Mono<JWKSet> shared = refreshInFlight.get();
        if (shared != null) {
            return shared;
        }
        Mono<JWKSet> created = document
                .map(GatewayIamPublicJwkSource::parseJwkSet)
                .doOnNext(jwkSet -> cached = new CachedJwkSet(jwkSet, clock.instant()))
                .doFinally(signal -> refreshInFlight.set(null))
                .cache();
        if (refreshInFlight.compareAndSet(null, created)) {
            return created;
        }
        Mono<JWKSet> winner = refreshInFlight.get();
        return winner != null ? winner : created;
    }

    private static Mono<String> readDocument(String jwkSetUri) {
        Objects.requireNonNull(jwkSetUri, "jwkSetUri");
        WebClient client = WebClient.builder()
                .defaultHeader(HttpHeaders.ACCEPT, MediaType.APPLICATION_JSON_VALUE)
                .build();
        return client.get()
                .uri(jwkSetUri)
                .exchangeToMono(response -> response.statusCode().is2xxSuccessful()
                        ? response.bodyToMono(String.class)
                        : response.releaseBody().then(Mono.error(new IllegalStateException(
                                "IAM public JWKS endpoint returned " + response.statusCode().value()))))
                .timeout(REQUEST_TIMEOUT);
    }

    /**
     * Accepts the documented {@code {"data":{"keys":[...]}}} envelope and, for
     * defence in depth, a bare RFC 7517 JWK Set. Anything else is rejected so a
     * mis-published document can never be treated as a usable key set.
     */
    static JWKSet parseJwkSet(String raw) {
        if (raw == null || raw.isBlank()) {
            throw new IllegalStateException("IAM public JWKS document is empty");
        }
        if (raw.length() > MAX_DOCUMENT_CHARS) {
            throw new IllegalStateException("IAM public JWKS document exceeds the bounded read limit");
        }
        Map<String, Object> parsed;
        try {
            parsed = JSONObjectUtils.parse(raw);
        } catch (ParseException exception) {
            throw new IllegalStateException("IAM public JWKS document is not valid JSON", exception);
        }
        Object data = parsed.get("data");
        Map<String, Object> keySetDocument = data instanceof Map<?, ?> envelope
                ? stringKeyed(envelope)
                : parsed;
        if (!(keySetDocument.get("keys") instanceof List<?>)) {
            throw new IllegalStateException("IAM public JWKS document does not contain a key list");
        }
        try {
            return JWKSet.parse(keySetDocument);
        } catch (ParseException exception) {
            throw new IllegalStateException("IAM public JWKS document is not a valid JWK set", exception);
        }
    }

    private static Map<String, Object> stringKeyed(Map<?, ?> source) {
        Map<String, Object> copy = new LinkedHashMap<>();
        for (Map.Entry<?, ?> entry : source.entrySet()) {
            copy.put(String.valueOf(entry.getKey()), entry.getValue());
        }
        return copy;
    }

    private static List<JWK> matching(JWKSet jwkSet, String keyId) {
        return jwkSet.getKeys().stream()
                .filter(key -> keyId.equals(key.getKeyID()))
                .toList();
    }

    private record CachedJwkSet(JWKSet jwkSet, Instant fetchedAt) {

        boolean expiredAt(Clock clock) {
            return fetchedAt.plus(CACHE_TTL).isBefore(clock.instant());
        }

        List<JWK> matching(String keyId) {
            return GatewayIamPublicJwkSource.matching(jwkSet, keyId);
        }
    }
}
