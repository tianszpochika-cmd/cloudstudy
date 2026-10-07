package com.englishflow.gateway.config;

import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.JWSHeader;
import com.nimbusds.jose.jwk.JWKSet;
import com.nimbusds.jose.jwk.RSAKey;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;
import org.springframework.boot.context.properties.bind.Bindable;
import org.springframework.boot.context.properties.bind.Binder;
import org.springframework.boot.context.properties.source.MapConfigurationPropertySource;
import org.springframework.boot.web.server.autoconfigure.ServerProperties;
import org.springframework.cloud.gateway.config.HttpClientFactory;
import org.springframework.cloud.gateway.config.HttpClientProperties;
import org.springframework.cloud.gateway.config.HttpClientSslConfigurer;
import reactor.core.publisher.Mono;
import reactor.netty.http.client.HttpClient;

import java.nio.file.Path;
import java.security.KeyPairGenerator;
import java.security.interfaces.RSAPrivateKey;
import java.security.interfaces.RSAPublicKey;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;

/** D1 offline probe: uses loaded production classes, never signs JWT or sends a request. */
public final class GatewayTlsProbe {
    private static final String PREFIX = "spring.cloud.gateway.server.webflux.httpclient";

    public static void main(String[] args) throws Exception {
        // Dynamic execution must be added/reviewed with a separately approved D2 window.
        if (args.length != 4 || !args[0].equals("--offline")) {
            throw new IllegalArgumentException("D2_NOT_AUTHORIZED: only --offline certificate registeredGatewayPort registeredIamPort");
        }
        if (!args[2].equals("18070") || !args[3].equals("18087")) {
            throw new IllegalArgumentException("Registered fixed ports required");
        }
        String certificate = Path.of(args[1]).toUri().toString();
        var properties = new Binder(new MapConfigurationPropertySource(Map.of(
                PREFIX + ".ssl.trusted-x509-certificates[0]", certificate,
                PREFIX + ".ssl.use-insecure-trust-manager", "false",
                PREFIX + ".connect-timeout", "2000",
                PREFIX + ".response-timeout", "2s")))
                .bind(PREFIX, Bindable.of(HttpClientProperties.class)).get();
        if (properties.getSsl().isUseInsecureTrustManager()
                || !properties.getSsl().getTrustedX509Certificates().equals(List.of(certificate))) {
            throw new IllegalStateException("Unsafe route client binding");
        }
        var serverProperties = new ServerProperties();
        var sslConfigurer = new HttpClientSslConfigurer(properties.getSsl(), serverProperties, null);
        var factory = new HttpClientFactory(properties, serverProperties, sslConfigurer, List.of());
        try {
            factory.afterPropertiesSet();
            HttpClient routeClient = factory.getObject();
            if (routeClient == null) throw new IllegalStateException("SCG client not created");
            // Constructor builds the production default WebClient request Mono; it is NOT subscribed.
            var unrequestedProductionSource = new GatewayIamPublicJwkSource(
                    "https://127.0.0.1:18087/api/v1/auth/jwks", Clock.systemUTC());
            if (unrequestedProductionSource == null) throw new IllegalStateException("source missing");

            Map<String, Object> result = new LinkedHashMap<>();
            result.put("kind", "R1_002_D1_OFFLINE_CLIENT_PROBE");
            result.put("iamBusinessRuntime", false);
            result.put("scgFactoryInstantiated", true);
            result.put("productionIndependentSourceInstantiated", true);
            result.put("networkRequests", 0);
            result.put("listeners", 0);
            result.put("accessTokensSigned", 0);
            result.put("routeHandshake", "NOT_EXECUTED");
            result.put("independentHandshake", "NOT_EXECUTED");
            result.put("routeFactoryClass", HttpClientFactory.class.getName());
            result.put("routeFactoryCodeSource", origin(HttpClientFactory.class));
            result.put("independentClass", GatewayIamPublicJwkSource.class.getName());
            result.put("independentCodeSource", origin(GatewayIamPublicJwkSource.class));
            result.put("productionRequestTimeoutMillis", GatewayIamPublicJwkSource.REQUEST_TIMEOUT.toMillis());
            result.put("productionCacheTtlSeconds", GatewayIamPublicJwkSource.CACHE_TTL.toSeconds());
            result.put("documentFixtureChecks", inspectProductionSelection());
            System.out.println(com.nimbusds.jose.util.JSONObjectUtils.toJSONString(result));
        } finally {
            factory.destroy();
        }
    }

    private static String origin(Class<?> type) {
        return type.getProtectionDomain().getCodeSource().getLocation().toString();
    }

    private static SignedJWT selector(String kid) {
        // Header/claims object only: never sign, serialize as bearer, or call any auth endpoint.
        return new SignedJWT(new JWSHeader.Builder(JWSAlgorithm.RS256).keyID(kid).build(),
                new JWTClaimsSet.Builder().build());
    }

    private static Map<String, Object> inspectProductionSelection() throws Exception {
        // A synthetic private JWK exists only in this process memory and is never emitted/persisted.
        var generator = KeyPairGenerator.getInstance("RSA");
        generator.initialize(2048);
        var pair = generator.generateKeyPair();
        var privateFixture = new RSAKey.Builder((RSAPublicKey) pair.getPublic())
                .privateKey((RSAPrivateKey) pair.getPrivate()).keyID("synthetic-offline-kid").build();
        String privateDocument = new JWKSet(privateFixture).toString(false);
        String publicDocument = new JWKSet(privateFixture.toPublicJWK()).toString();
        var privateSource = new GatewayIamPublicJwkSource(Mono.just(privateDocument), Clock.systemUTC());
        var selectedPrivate = privateSource.select(selector("synthetic-offline-kid")).collectList().block();
        boolean privateReturned = selectedPrivate != null && selectedPrivate.stream().anyMatch(key -> key.isPrivate());
        // Report actual loaded production behavior; do not filter/convert its result to fake rejection.
        Map<String, Object> checks = new LinkedHashMap<>();
        checks.put("fixtureIsNotTlsOrBusinessEvidence", true);
        checks.put("privateJwkSelectedCount", selectedPrivate == null ? -1 : selectedPrivate.size());
        checks.put("privateJwkReturned", privateReturned);
        checks.put("publicKeyOnlyProductionGap", privateReturned ? "OPEN" : "NOT_OBSERVED");

        var clock = new MutableClock();
        var reads = new AtomicInteger();
        var source = new GatewayIamPublicJwkSource(Mono.fromSupplier(() -> {
            reads.incrementAndGet(); return publicDocument;
        }), clock);
        int known = source.select(selector("synthetic-offline-kid")).collectList().block().size();
        source.select(selector("synthetic-offline-kid")).collectList().block();
        int hotReads = reads.get();
        int unknown = source.select(selector("unknown-offline-kid")).collectList().block().size();
        int missReads = reads.get();
        clock.now = clock.now.plusSeconds(301);
        source.select(selector("synthetic-offline-kid")).collectList().block();
        checks.put("knownKidCount", known);
        checks.put("cachedKnownKidDocumentReads", hotReads);
        checks.put("unknownKidCount", unknown);
        checks.put("unknownKidDocumentReads", missReads);
        checks.put("expiredCacheDocumentReads", reads.get());
        checks.put("malformedDocumentRejected", rejected("{\"data\":{\"unexpected\":[]}}"));
        checks.put("overBoundDocumentRejected", rejected("x".repeat(GatewayIamPublicJwkSource.MAX_DOCUMENT_CHARS + 1)));
        if (known != 1 || hotReads != 1 || unknown != 0 || missReads != 2 || reads.get() != 3) {
            throw new IllegalStateException("Loaded production cache/selector differs from expected fixture behavior");
        }
        return checks;
    }

    private static boolean rejected(String fixture) {
        try { GatewayIamPublicJwkSource.parseJwkSet(fixture); return false; }
        catch (IllegalStateException expected) { return true; }
    }

    private static final class MutableClock extends Clock {
        Instant now = Instant.parse("2026-10-07T00:00:00Z");
        public ZoneId getZone() { return ZoneOffset.UTC; }
        public Clock withZone(ZoneId zone) { return this; }
        public Instant instant() { return now; }
    }
}
