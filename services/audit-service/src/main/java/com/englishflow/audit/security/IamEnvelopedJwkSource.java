package com.englishflow.audit.security;

import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.jwk.JWK;
import com.nimbusds.jose.jwk.JWKSelector;
import com.nimbusds.jose.jwk.JWKSet;
import com.nimbusds.jose.jwk.source.JWKSource;
import com.nimbusds.jose.proc.SecurityContext;
import com.nimbusds.jose.util.JSONObjectUtils;
import com.nimbusds.jwt.proc.DefaultJWTProcessor;
import com.nimbusds.jose.proc.JWSVerificationKeySelector;

import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.text.ParseException;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.function.Supplier;

/**
 * Resolves the IAM public verification keys for domain service JWT decoders. IAM publishes the
 * contract-mandated {@code ApiSuccessEnvelope} document ({@code {"data":{"keys":[...]},"meta":...}}),
 * so the stock {@code NimbusJwtDecoder.withJwkSetUri} parser cannot read it: it hands the whole
 * document to {@code JWKSet.parse}, which expects a bare RFC 7517 JWK Set. This source unwraps the
 * documented envelope (accepting a bare set only for defence in depth), caches the set with a
 * bounded TTL and fails closed on transport, parse or empty-key errors.
 */
public final class IamEnvelopedJwkSource implements JWKSource<SecurityContext> {

    private static final Duration CACHE_TTL = Duration.ofMinutes(5);
    private static final Duration REQUEST_TIMEOUT = Duration.ofSeconds(5);
    private static final int MAX_DOCUMENT_CHARS = 262_144;

    private final Supplier<String> documentSupplier;
    private final Clock clock;
    private volatile CachedJwkSet cached;

    public IamEnvelopedJwkSource(String jwkSetUri, Clock clock) {
        this(() -> fetchDocument(jwkSetUri), clock);
    }

    IamEnvelopedJwkSource(Supplier<String> documentSupplier, Clock clock) {
        this.documentSupplier = Objects.requireNonNull(documentSupplier, "documentSupplier");
        this.clock = Objects.requireNonNull(clock, "clock");
    }

    @Override
    public List<JWK> get(JWKSelector selector, SecurityContext context) {
        Objects.requireNonNull(selector, "selector");
        return selector.select(currentJwkSet());
    }

    private JWKSet currentJwkSet() {
        CachedJwkSet snapshot = cached;
        if (snapshot != null && !snapshot.expiredAt(clock)) {
            return snapshot.jwkSet();
        }
        synchronized (this) {
            snapshot = cached;
            if (snapshot != null && !snapshot.expiredAt(clock)) {
                return snapshot.jwkSet();
            }
            JWKSet refreshed = parseJwkSet(documentSupplier.get());
            if (refreshed.getKeys().isEmpty()) {
                throw new IllegalStateException("IAM public JWKS contains no keys");
            }
            cached = new CachedJwkSet(refreshed, clock.instant());
            return refreshed;
        }
    }

    private static String fetchDocument(String jwkSetUri) {
        Objects.requireNonNull(jwkSetUri, "jwkSetUri");
        try {
            HttpRequest request = HttpRequest.newBuilder(URI.create(jwkSetUri))
                    .timeout(REQUEST_TIMEOUT)
                    .header("Accept", "application/json")
                    .GET()
                    .build();
            HttpResponse<String> response = HttpClient.newBuilder()
                    .connectTimeout(REQUEST_TIMEOUT)
                    .build()
                    .send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() / 100 != 2) {
                throw new IllegalStateException(
                        "IAM public JWKS endpoint returned " + response.statusCode());
            }
            return response.body();
        } catch (java.io.IOException exception) {
            throw new IllegalStateException("IAM public JWKS endpoint is unavailable", exception);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("IAM public JWKS request was interrupted", exception);
        }
    }

    /**
     * Accepts the documented {@code {"data":{"keys":[...]}}} envelope and, for defence in depth, a
     * bare RFC 7517 JWK Set. Anything else is rejected so a mis-published document can never be
     * treated as a usable key set.
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

    /** Builds a servlet-side decoder whose RSA verification keys come from the enveloped JWKS. */
    public static NimbusJwtDecoder decoder(String jwkSetUri, Clock clock) {
        IamEnvelopedJwkSource source = new IamEnvelopedJwkSource(jwkSetUri, clock);
        DefaultJWTProcessor<SecurityContext> processor = new DefaultJWTProcessor<>();
        processor.setJWSKeySelector(new JWSVerificationKeySelector<>(JWSAlgorithm.Family.RSA, source));
        return new NimbusJwtDecoder(processor);
    }

    private static Map<String, Object> stringKeyed(Map<?, ?> source) {
        Map<String, Object> copy = new LinkedHashMap<>();
        for (Map.Entry<?, ?> entry : source.entrySet()) {
            copy.put(String.valueOf(entry.getKey()), entry.getValue());
        }
        return copy;
    }

    private record CachedJwkSet(JWKSet jwkSet, Instant fetchedAt) {

        boolean expiredAt(Clock clock) {
            return fetchedAt.plus(CACHE_TTL).isBefore(clock.instant());
        }
    }
}
