package com.englishflow.iam.domain;

import com.englishflow.iam.config.IamRuntimeConfiguration;
import com.englishflow.iam.config.IamServiceProperties;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.env.MockEnvironment;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Duration;
import java.util.Arrays;
import java.util.HexFormat;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;

class IdempotencySecurityHardeningTest {
    private static final String REPLAY_SECRET = "replay-secret-for-idempotency-tests-2026";
    private static final String FINGERPRINT_SECRET = "fingerprint-secret-for-idempotency-tests-2026";

    @Test
    void requestFingerprintIsVersionedPurposeSeparatedHmacRatherThanPlainSha256() throws Exception {
        ObjectMapper mapper = new ObjectMapper().findAndRegisterModules();
        IdempotencyService service = service(new InMemoryIdempotencyStore(), mapper,
                FINGERPRINT_SECRET);
        Object[] components = {"/api/v1/auth/login", "user@example.com", "password-guess"};

        String actual = service.fingerprint(components);
        byte[] payload = mapper.writeValueAsBytes(Arrays.asList(components));
        String plainSha = HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(payload));
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(FINGERPRINT_SECRET.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
        mac.update(("yuxuexing:iam:idempotency:request-binding\u0000hmac-sha256-v1\u0000")
                .getBytes(StandardCharsets.UTF_8));
        String expected = "hmac-sha256-v1:" + HexFormat.of().formatHex(mac.doFinal(payload));

        assertEquals(expected, actual);
        assertNotEquals("hmac-sha256-v1:" + plainSha, actual,
                "a database reader must not be able to test password guesses with plain SHA-256");
        assertEquals(actual, service.fingerprint(components), "the keyed binding must be restart-stable");
        assertNotEquals(actual, service(new InMemoryIdempotencyStore(), mapper,
                "second-independent-fingerprint-secret-2026").fingerprint(components));
    }

    @Test
    void legacyUnkeyedRowsAreConflictTombstonesRatherThanReplayableFingerprints() throws Exception {
        byte[] destroyedLegacyDigest = new byte[32];
        String legacy = IdempotencyRequestFingerprint.fromStored(
                IdempotencyRequestFingerprint.LEGACY_INVALIDATED_VERSION, destroyedLegacyDigest);
        String current = service(new InMemoryIdempotencyStore(), new ObjectMapper(),
                FINGERPRINT_SECRET).fingerprint("same logical request");

        assertFalse(IdempotencyRequestFingerprint.matchesCurrent(legacy, current));
        assertThrows(IllegalArgumentException.class,
                () -> IdempotencyRequestFingerprint.parseCurrent(legacy));
        assertThrows(IllegalArgumentException.class, () -> IdempotencyRequestFingerprint.fromStored(
                IdempotencyRequestFingerprint.LEGACY_INVALIDATED_VERSION,
                MessageDigest.getInstance("SHA-256").digest("not-zero".getBytes(StandardCharsets.UTF_8))));
        assertThrows(IllegalArgumentException.class, () -> IdempotencyRequestFingerprint.fromStored(
                IdempotencyRequestFingerprint.CURRENT_VERSION, new byte[32]));
        assertThrows(IllegalArgumentException.class, () -> IdempotencyRequestFingerprint.parseCurrent(
                IdempotencyRequestFingerprint.CURRENT_VERSION + ":" + "00".repeat(32)));
    }

    @Test
    void malformedOrUnsupportedFingerprintIsRejectedBeforeAnyStoreAccess() {
        IdempotencyStore store = mock(IdempotencyStore.class);
        IdempotencyService service = new IdempotencyService(store, new ObjectMapper(),
                IamTransactionRunner.direct(), REPLAY_SECRET, FINGERPRINT_SECRET,
                Duration.ofHours(24));
        String[] malformed = {null, "", "0".repeat(64), "sha256-v0:" + "ab".repeat(32),
                "hmac-sha256-v1:" + "AB".repeat(32),
                "hmac-sha256-v1:" + "ab".repeat(31),
                "hmac-sha256-v1:" + "00".repeat(32),
                "hmac-sha256-v1:" + "ab".repeat(32) + ":tail"};

        for (String fingerprint : malformed) {
            IamPolicyException failure = assertThrows(IamPolicyException.class, () ->
                    service.execute("/unknown/write", "valid-idempotency-key", fingerprint,
                            () -> new IdempotencyService.Execution<>(ResponseEntity.ok("no"), "no"),
                            record -> ResponseEntity.ok("no")));
            assertEquals(IamDecisionCode.INVALID_REQUEST, failure.code());
        }
        verifyNoInteractions(store);
    }

    @Test
    void replayPolicyDefaultsUnknownAndMalformedDynamicScopesToCurrentFacts() {
        IdempotencyReplayPolicy policy = IdempotencyReplayPolicy.failClosedDefaults();
        assertEquals(IdempotencyReplayPolicy.ReplayMode.REQUIRE_CURRENT_FACTS_CALLBACK,
                policy.modeFor("/unknown/write"));
        assertEquals(IdempotencyReplayPolicy.ReplayMode.REQUIRE_CURRENT_FACTS_CALLBACK,
                policy.modeFor("/api/v1/auth/login"));
        assertEquals(IdempotencyReplayPolicy.ReplayMode.ENCRYPTED_SNAPSHOT,
                policy.modeFor("/api/v1/iam/consents"));
        assertEquals(IdempotencyReplayPolicy.ReplayMode.ENCRYPTED_SNAPSHOT,
                policy.modeFor("policy:create:123e4567-e89b-12d3-a456-426614174000"));
        assertEquals(IdempotencyReplayPolicy.ReplayMode.ENCRYPTED_SNAPSHOT,
                policy.modeFor("policy:activate:123e4567-e89b-12d3-a456-426614174000:"
                        + "123e4567-e89b-12d3-a456-426614174001"));
        for (String malformed : new String[]{
                "policy:create:not-a-uuid",
                "policy:create:123E4567-E89B-12D3-A456-426614174000",
                "policy:activate:123e4567-e89b-12d3-a456-426614174000",
                "policy:unknown:123e4567-e89b-12d3-a456-426614174000:"
                        + "123e4567-e89b-12d3-a456-426614174001",
                "policy:create:123e4567-e89b-12d3-a456-426614174000:extra"}) {
            assertEquals(IdempotencyReplayPolicy.ReplayMode.REQUIRE_CURRENT_FACTS_CALLBACK,
                    policy.modeFor(malformed));
        }
    }

    @Test
    void credentialScopesNeverPersistOrUnconditionallyRestoreResponseSnapshots() {
        InMemoryIdempotencyStore store = new InMemoryIdempotencyStore();
        IdempotencyService service = service(store, new ObjectMapper(), FINGERPRINT_SECRET);
        String scope = "/api/v1/auth/login";
        String key = "credential-key-123456";
        String fingerprint = service.fingerprint(scope, "user@example.com", "password");
        TypeReference<String> type = new TypeReference<>() {};
        AtomicInteger operations = new AtomicInteger();
        AtomicInteger currentFactChecks = new AtomicInteger();

        ResponseEntity<String> first = service.execute(scope, key, fingerprint, type,
                () -> {
                    operations.incrementAndGet();
                    return new IdempotencyService.Execution<>(ResponseEntity.ok()
                            .header(HttpHeaders.SET_COOKIE, "refresh=credential; HttpOnly")
                            .body("original-credential-response"), "session-1");
                }, record -> ResponseEntity.ok("must-not-replay-on-first-execution"));
        assertEquals("original-credential-response", first.getBody());

        IdempotencyRecord persisted = store.claim(scope, key, fingerprint);
        assertFalse(persisted.hasResponseSnapshot(),
                "credential responses must not be persisted even as a replayable encrypted snapshot");

        IamPolicyException revoked = assertThrows(IamPolicyException.class, () ->
                service.execute(scope, key, fingerprint, type,
                        () -> new IdempotencyService.Execution<>(ResponseEntity.ok("must-not-run"), "bad"),
                        record -> {
                            currentFactChecks.incrementAndGet();
                            throw new IamPolicyException(IamDecisionCode.IDEMPOTENCY_RESULT_UNAVAILABLE,
                                    "iam.idempotency.result_unavailable");
                        }));
        assertEquals(IamDecisionCode.IDEMPOTENCY_RESULT_UNAVAILABLE, revoked.code());

        ResponseEntity<String> current = service.execute(scope, key, fingerprint, type,
                () -> new IdempotencyService.Execution<>(ResponseEntity.ok("must-not-run"), "bad"),
                record -> {
                    currentFactChecks.incrementAndGet();
                    return ResponseEntity.ok("rebuilt-after-current-facts-check");
                });
        assertEquals("rebuilt-after-current-facts-check", current.getBody());
        assertEquals(1, operations.get());
        assertEquals(2, currentFactChecks.get());
    }

    @Test
    void runtimeFailsClosedWithoutAnIndependentFingerprintSecret() {
        IamServiceProperties properties = new IamServiceProperties();
        properties.getPersistence().setEnabled(true);
        properties.getPersistence().setJdbcUrl(
                "jdbc:mysql://127.0.0.1:13306/iam_service?useUnicode=true&serverTimezone=UTC");
        properties.getIdempotency().setReplaySecret(REPLAY_SECRET);
        IamRuntimeConfiguration configuration = new IamRuntimeConfiguration();

        IllegalStateException missing = assertThrows(IllegalStateException.class,
                () -> configuration.iamSecurityConfigurationGuard(properties, new MockEnvironment()));
        assertTrue(missing.getMessage().contains("IAM_IDEMPOTENCY_FINGERPRINT_SECRET"));

        properties.getIdempotency().setFingerprintSecret(REPLAY_SECRET);
        IllegalStateException reused = assertThrows(IllegalStateException.class,
                () -> configuration.iamSecurityConfigurationGuard(properties, new MockEnvironment()));
        assertTrue(reused.getMessage().contains("independently provisioned"));

        properties.getIdempotency().setFingerprintSecret(FINGERPRINT_SECRET);
        configuration.iamSecurityConfigurationGuard(properties, new MockEnvironment());

        IllegalStateException flywayDisabled = assertThrows(IllegalStateException.class,
                () -> configuration.iamSecurityConfigurationGuard(properties,
                        new MockEnvironment().withProperty("spring.flyway.enabled", "false")));
        assertTrue(flywayDisabled.getMessage().contains("cannot disable Flyway"));
    }

    @Test
    void directConstructionRejectsWeakOrReusedFingerprintKeys() {
        ObjectMapper mapper = new ObjectMapper();
        assertThrows(IllegalStateException.class, () -> new IdempotencyService(
                new InMemoryIdempotencyStore(), mapper, IamTransactionRunner.direct(),
                REPLAY_SECRET, "weak", Duration.ofHours(24)));
        assertThrows(IllegalStateException.class, () -> new IdempotencyService(
                new InMemoryIdempotencyStore(), mapper, IamTransactionRunner.direct(),
                REPLAY_SECRET, REPLAY_SECRET, Duration.ofHours(24)));
        assertTrue(Arrays.stream(IdempotencyService.class.getConstructors())
                        .allMatch(constructor -> constructor.getParameterCount() >= 6),
                "production code must not expose constructors with embedded test keys");
    }

    private static IdempotencyService service(InMemoryIdempotencyStore store, ObjectMapper mapper,
                                              String fingerprintSecret) {
        return new IdempotencyService(store, mapper, IamTransactionRunner.direct(), REPLAY_SECRET,
                fingerprintSecret, Duration.ofHours(24));
    }
}
