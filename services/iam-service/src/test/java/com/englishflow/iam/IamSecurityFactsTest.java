package com.englishflow.iam;

import com.englishflow.iam.config.IamServiceProperties;
import com.englishflow.iam.domain.AccountRecord;
import com.englishflow.iam.domain.AdultGateCommand;
import com.englishflow.iam.domain.AdultGateResult;
import com.englishflow.iam.domain.AdultGateService;
import com.englishflow.iam.domain.AuditDecision;
import com.englishflow.iam.domain.AuditFactPort;
import com.englishflow.iam.domain.ClientAuthorityClaims;
import com.englishflow.iam.domain.ConsentCommand;
import com.englishflow.iam.domain.ConsentHistoryEntry;
import com.englishflow.iam.domain.ConsentPolicyDescriptor;
import com.englishflow.iam.domain.ConsentRecord;
import com.englishflow.iam.domain.ConsentService;
import com.englishflow.iam.domain.ConsentStore;
import com.englishflow.iam.domain.ConsentType;
import com.englishflow.iam.domain.ConsentVersion;
import com.englishflow.iam.domain.InMemoryAccountStore;
import com.englishflow.iam.domain.InMemoryConsentStore;
import com.englishflow.iam.domain.InMemoryPasswordResetChallengeStore;
import com.englishflow.iam.domain.InMemoryPasswordResetDelivery;
import com.englishflow.iam.domain.InMemoryRateLimitStore;
import com.englishflow.iam.domain.InMemorySessionStore;
import com.englishflow.iam.domain.InMemoryAdultGateFactStore;
import com.englishflow.iam.domain.IdempotencyRecord;
import com.englishflow.iam.domain.IdempotencyService;
import com.englishflow.iam.domain.IamDecisionCode;
import com.englishflow.iam.domain.IamPolicyException;
import com.englishflow.iam.domain.IamTransactionRunner;
import com.englishflow.iam.domain.PasswordAccountService;
import com.englishflow.iam.domain.PasswordResetChallenge;
import com.englishflow.iam.domain.PasswordResetService;
import com.englishflow.iam.domain.PrincipalId;
import com.englishflow.iam.domain.ServerPrincipalContext;
import com.englishflow.iam.domain.SessionService;
import com.englishflow.iam.domain.TrustedAgeEvidence;
import com.englishflow.iam.domain.TenantScope;
import com.englishflow.iam.domain.StaticConsentPolicy;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.http.ResponseEntity;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.core.type.TypeReference;
import org.springframework.http.HttpHeaders;
import org.springframework.mock.env.MockEnvironment;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** Java 25 in-process security-fact tests; no external service is treated as runtime evidence. */
class IamSecurityFactsTest {

    private static final Instant NOW = Instant.parse("2026-09-01T00:00:00Z");
    private static final Clock CLOCK = Clock.fixed(NOW, ZoneOffset.UTC);
    private static final String IDEMPOTENCY_REPLAY_KEY =
            "security-facts-idempotency-replay-key-2026";
    private static final String IDEMPOTENCY_FINGERPRINT_KEY =
            "security-facts-idempotency-fingerprint-key-2026";

    @Test
    void resetChallengeIsOneTimeAndPasswordResetRevokesAllSessionsAtTheBoundary() {
        IamServiceProperties properties = properties();
        RecordingAudit audit = new RecordingAudit();
        InMemoryAccountStore accountStore = new InMemoryAccountStore();
        PasswordAccountService passwords = new PasswordAccountService(accountStore,
                new BCryptPasswordEncoder(12), audit, CLOCK, properties);
        AccountRecord account = passwords.register("reset@example.com", "correct horse battery staple!",
                ClientAuthorityClaims.none());
        String token = "reset-token-value-012345678901234567890123456789";
        InMemoryPasswordResetChallengeStore challenges = new InMemoryPasswordResetChallengeStore();
        challenges.save(new PasswordResetChallenge("challenge-1", account.principalId(),
                com.englishflow.iam.domain.SecretDigests.sha256Hex(token), NOW, NOW.plusSeconds(900), false));
        SessionService sessions = new SessionService(new InMemorySessionStore(), audit, CLOCK, properties);
        sessions.open(ServerPrincipalContext.forPlatform(account.principalId(), account.roles()),
                new com.englishflow.iam.domain.DeviceId("reset-session"));
        PasswordResetService reset = new PasswordResetService(accountStore, challenges, passwords, audit, CLOCK,
                properties, sessions, com.englishflow.iam.domain.IamTransactionRunner.direct(), null,
                new InMemoryPasswordResetDelivery(), IDEMPOTENCY_FINGERPRINT_KEY);

        assertEquals(account.principalId(), reset.confirm("reset@example.com", token,
                "new correct horse battery staple!").principalId());
        assertTrue(sessions.findByPrincipal(account.principalId()).stream()
                .allMatch(session -> session.status() == com.englishflow.iam.domain.SessionStatus.REVOKED));
        IamPolicyException replay = assertThrows(IamPolicyException.class,
                () -> reset.confirm("reset@example.com", token, "another correct horse battery staple!"));
        assertEquals(IamDecisionCode.PASSWORD_RESET_INVALID, replay.code());
    }

    @Test
    void consentWithdrawalIsDurableAndIdempotentInProcess() {
        RecordingAudit audit = new RecordingAudit();
        ConsentVersion version = new ConsentVersion("b30-consent-v1");
        ConsentService consents = new ConsentService(new InMemoryConsentStore(),
                new StaticConsentPolicy(Map.of(ConsentType.TERMS_OF_SERVICE, version,
                        ConsentType.PRIVACY_NOTICE, version)), audit, CLOCK);
        var principal = com.englishflow.iam.domain.PrincipalId.random();
        ServerPrincipalContext context = ServerPrincipalContext.forPlatform(principal, Set.of("learner"));

        ConsentRecord granted = consents.record(context,
                new ConsentCommand(ConsentType.TERMS_OF_SERVICE, version, true, ClientAuthorityClaims.none()));
        ConsentRecord withdrawn = consents.withdraw(context, ConsentType.TERMS_OF_SERVICE, version);
        ConsentRecord repeated = consents.withdraw(context, ConsentType.TERMS_OF_SERVICE, version);

        assertTrue(granted.accepted());
        assertEquals(false, withdrawn.accepted());
        assertEquals(withdrawn, repeated);
        assertEquals(false, consents.hasAllRequiredConsent(principal));
    }

    @Test
    void allFiveConsentTypesUseServerPolicyFactsAndKeepOptionalScopesSeparate() {
        RecordingAudit audit = new RecordingAudit();
        InMemoryConsentStore store = new InMemoryConsentStore();
        StaticConsentPolicy policy = StaticConsentPolicy.localCandidate(true);
        ConsentService consents = new ConsentService(store, policy, audit, CLOCK);
        PrincipalId principal = PrincipalId.random();
        ServerPrincipalContext context = ServerPrincipalContext.forPlatform(principal, Set.of("learner"));

        for (ConsentType type : ConsentType.values()) {
            ConsentPolicyDescriptor descriptor = policy.descriptor(type);
            assertTrue(descriptor.policyRef().startsWith("iam://consent/"),
                    "opaque policyRef may preserve contract-defined case while remaining safe");
            consents.record(context, new ConsentCommand(type, descriptor.documentVersion(), true,
                    ClientAuthorityClaims.none(), descriptor.documentDigest()));
        }

        assertTrue(consents.hasRequiredConsentFor(principal, "LEARNING"));
        assertTrue(consents.hasRequiredConsentFor(principal, "VOICE_REMOTE_RECORD"));
        assertTrue(consents.hasRequiredConsentFor(principal, "ANALYTICS"));
        assertEquals(5, store.history(principal, ConsentType.TERMS_OF_SERVICE).size()
                + store.history(principal, ConsentType.PRIVACY_NOTICE).size()
                + store.history(principal, ConsentType.ADULT_LEARNING).size()
                + store.history(principal, ConsentType.PRODUCT_ANALYTICS).size()
                + store.history(principal, ConsentType.VOICE_RECORDING).size());
    }

    @Test
    void capabilityConsentRequiresBaseAndVoiceFactsButNotOptionalAnalytics() {
        RecordingAudit audit = new RecordingAudit();
        StaticConsentPolicy policy = StaticConsentPolicy.localCandidate(true);
        InMemoryConsentStore store = new InMemoryConsentStore();
        PrincipalId principal = PrincipalId.random();
        ServerPrincipalContext context = ServerPrincipalContext.forPlatform(principal, Set.of("learner"));
        ConsentService consents = new ConsentService(store, policy, audit, CLOCK);

        for (ConsentType type : List.of(ConsentType.TERMS_OF_SERVICE,
                ConsentType.PRIVACY_NOTICE, ConsentType.ADULT_LEARNING)) {
            ConsentPolicyDescriptor descriptor = policy.descriptor(type);
            consents.record(context, new ConsentCommand(type, descriptor.documentVersion(), true,
                    ClientAuthorityClaims.none(), descriptor.documentDigest()));
        }
        assertTrue(consents.hasRequiredConsentFor(principal, "LEARNING"));
        assertTrue(consents.hasRequiredConsentFor(principal, "ANALYTICS"),
                "optional analytics consent must not gate learning or base capability checks");
        assertEquals(false, consents.hasRequiredConsentFor(principal, "VOICE_REMOTE_RECORD"),
                "voice processing requires the dedicated voice consent");
        assertEquals(false, consents.hasRequiredConsentFor(principal, "UNDECLARED_CAPABILITY"));

        SessionService sessions = new SessionService(new InMemorySessionStore(), audit, CLOCK, properties());
        sessions.open(context, new com.englishflow.iam.domain.DeviceId("voice-capability-device"));
        ConsentPolicyDescriptor voice = policy.descriptor(ConsentType.VOICE_RECORDING);
        consents = new ConsentService(store, policy, audit, CLOCK, sessions,
                com.englishflow.iam.domain.IamTransactionRunner.direct());
        consents.record(context, new ConsentCommand(ConsentType.VOICE_RECORDING,
                voice.documentVersion(), true, ClientAuthorityClaims.none(), voice.documentDigest()));
        assertTrue(consents.hasRequiredConsentFor(principal, "VOICE_REMOTE_RECORD"));
        consents.withdraw(context, ConsentType.VOICE_RECORDING, voice.documentVersion(), voice.documentDigest());
        assertEquals(false, consents.hasRequiredConsentFor(principal, "VOICE_REMOTE_RECORD"));
        assertTrue(sessions.findByPrincipal(principal).stream()
                .allMatch(session -> session.status() == com.englishflow.iam.domain.SessionStatus.ACTIVE));
    }

    @Test
    void expectedDocumentDigestMustMatchPublishedServerFact() {
        RecordingAudit audit = new RecordingAudit();
        StaticConsentPolicy policy = StaticConsentPolicy.localCandidate(true);
        InMemoryConsentStore store = new InMemoryConsentStore();
        ConsentService consents = new ConsentService(store, policy, audit, CLOCK);
        PrincipalId principal = PrincipalId.random();
        ServerPrincipalContext context = ServerPrincipalContext.forPlatform(principal, Set.of("learner"));
        ConsentPolicyDescriptor descriptor = policy.descriptor(ConsentType.TERMS_OF_SERVICE);

        IamPolicyException mismatch = assertThrows(IamPolicyException.class, () ->
                consents.record(context, new ConsentCommand(ConsentType.TERMS_OF_SERVICE,
                        descriptor.documentVersion(), true, ClientAuthorityClaims.none(),
                        "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")));
        assertEquals(IamDecisionCode.CONSENT_VERSION_MISMATCH, mismatch.code());
        assertTrue(store.find(principal, ConsentType.TERMS_OF_SERVICE).isEmpty());

        ConsentRecord accepted = consents.record(context, new ConsentCommand(ConsentType.TERMS_OF_SERVICE,
                descriptor.documentVersion(), true, ClientAuthorityClaims.none(), descriptor.documentDigest()));
        assertEquals(descriptor.documentDigest(), accepted.documentDigest());
        assertEquals(descriptor.policyVersion(), accepted.policyVersion());
        IamPolicyException withdrawalMismatch = assertThrows(IamPolicyException.class, () ->
                consents.withdraw(context, ConsentType.TERMS_OF_SERVICE, descriptor.documentVersion(),
                        " ".repeat(16)));
        assertEquals(IamDecisionCode.CONSENT_VERSION_MISMATCH, withdrawalMismatch.code());
        assertTrue(store.find(principal, ConsentType.TERMS_OF_SERVICE).orElseThrow().accepted());
    }

    @Test
    void publicConsentTypeAndDigestAssertionsAreExactAndFailAsConflict() {
        for (String alias : List.of("TERMS_OF_SERVICE", "ACCOUNT_TERMS", "purpose", "terms", " TERMS")) {
            IamPolicyException invalid = assertThrows(IamPolicyException.class,
                    () -> ConsentType.fromWire(alias));
            assertEquals(IamDecisionCode.INVALID_REQUEST, invalid.code());
        }

        RecordingAudit audit = new RecordingAudit();
        StaticConsentPolicy policy = StaticConsentPolicy.localCandidate(true);
        InMemoryConsentStore store = new InMemoryConsentStore();
        ConsentService consents = new ConsentService(store, policy, audit, CLOCK);
        PrincipalId principal = PrincipalId.random();
        ServerPrincipalContext context = ServerPrincipalContext.forPlatform(principal, Set.of("learner"));
        ConsentPolicyDescriptor descriptor = policy.descriptor(ConsentType.TERMS_OF_SERVICE);
        for (String invalidDigest : List.of("short", "a".repeat(15), "a".repeat(161), " ".repeat(16))) {
            IamPolicyException mismatch = assertThrows(IamPolicyException.class, () ->
                    consents.record(context, new ConsentCommand(ConsentType.TERMS_OF_SERVICE,
                            descriptor.documentVersion(), true, ClientAuthorityClaims.none(), invalidDigest)));
            assertEquals(IamDecisionCode.CONSENT_VERSION_MISMATCH, mismatch.code());
        }
        assertTrue(store.find(principal, ConsentType.TERMS_OF_SERVICE).isEmpty());
    }

    @Test
    void consentFactIsNotVisibleWhenImmutableAuditAppendFails() {
        StaticConsentPolicy policy = StaticConsentPolicy.localCandidate(true);
        TransactionalConsentStore store = new TransactionalConsentStore();
        AuditFactPort failingAudit = decision -> {
            throw new IllegalStateException("audit unavailable");
        };
        ConsentService consents = new ConsentService(store, policy, failingAudit, CLOCK, null, store.runner());
        PrincipalId principal = PrincipalId.random();
        ServerPrincipalContext context = ServerPrincipalContext.forPlatform(principal, Set.of("learner"));
        ConsentPolicyDescriptor descriptor = policy.descriptor(ConsentType.TERMS_OF_SERVICE);

        IamPolicyException failure = assertThrows(IamPolicyException.class, () ->
                consents.record(context, new ConsentCommand(ConsentType.TERMS_OF_SERVICE,
                        descriptor.documentVersion(), true, ClientAuthorityClaims.none(), descriptor.documentDigest())));
        assertEquals(IamDecisionCode.AUDIT_UNAVAILABLE, failure.code());
        assertTrue(store.find(principal, ConsentType.TERMS_OF_SERVICE).isEmpty());
        assertTrue(store.history(principal, ConsentType.TERMS_OF_SERVICE).isEmpty());
    }

    @Test
    void optionalAndVoiceWithdrawalDoesNotRevokeAllSessions() {
        RecordingAudit audit = new RecordingAudit();
        StaticConsentPolicy policy = StaticConsentPolicy.localCandidate(true);
        InMemoryConsentStore store = new InMemoryConsentStore();
        SessionService sessions = new SessionService(new InMemorySessionStore(), audit, CLOCK, properties());
        PrincipalId principal = PrincipalId.random();
        ServerPrincipalContext context = ServerPrincipalContext.forPlatform(principal, Set.of("learner"));
        sessions.open(context, new com.englishflow.iam.domain.DeviceId("optional-consent-device"));
        ConsentService consents = new ConsentService(store, policy, audit, CLOCK, sessions,
                com.englishflow.iam.domain.IamTransactionRunner.direct());

        ConsentPolicyDescriptor analytics = policy.descriptor(ConsentType.PRODUCT_ANALYTICS);
        consents.record(context, new ConsentCommand(ConsentType.PRODUCT_ANALYTICS,
                analytics.documentVersion(), true, ClientAuthorityClaims.none(), analytics.documentDigest()));
        consents.withdraw(context, ConsentType.PRODUCT_ANALYTICS, analytics.documentVersion(), analytics.documentDigest());
        assertTrue(sessions.findByPrincipal(principal).stream()
                .allMatch(session -> session.status() == com.englishflow.iam.domain.SessionStatus.ACTIVE));

        ConsentPolicyDescriptor voice = policy.descriptor(ConsentType.VOICE_RECORDING);
        consents.record(context, new ConsentCommand(ConsentType.VOICE_RECORDING,
                voice.documentVersion(), true, ClientAuthorityClaims.none(), voice.documentDigest()));
        consents.withdraw(context, ConsentType.VOICE_RECORDING, voice.documentVersion(), voice.documentDigest());
        assertTrue(sessions.findByPrincipal(principal).stream()
                .allMatch(session -> session.status() == com.englishflow.iam.domain.SessionStatus.ACTIVE));
    }

    @Test
    void durableConsentRequirementAndWithdrawalFactsMustMatchThePublishedDescriptor() {
        RecordingAudit audit = new RecordingAudit();
        StaticConsentPolicy policy = StaticConsentPolicy.localCandidate(true);
        InMemoryConsentStore store = new InMemoryConsentStore();
        PrincipalId principal = PrincipalId.random();
        ConsentPolicyDescriptor descriptor = policy.descriptor(ConsentType.TERMS_OF_SERVICE);
        ConsentRecord forged = new ConsentRecord(java.util.UUID.randomUUID(), principal,
                TenantScope.derive(principal), ConsentType.TERMS_OF_SERVICE, descriptor.purpose(),
                ConsentPolicyDescriptor.Requirement.OPTIONAL.name(), false, descriptor.documentVersion(),
                descriptor.documentDigest(), descriptor.policyVersion(), descriptor.policyDigest(), true,
                NOW, NOW, ConsentPolicyDescriptor.WithdrawalEffect.RESTRICT_PROTECTED_CAPABILITY, false);
        store.append(forged);
        ConsentService consents = new ConsentService(store, policy, audit, CLOCK);

        assertEquals(false, consents.hasRequiredConsentFor(principal, "LEARNING"),
                "a durable fact with a weakened requirement/effect must not authorize");
    }

    @Test
    void unprovisionedCandidatePolicyCannotSatisfyAuthorization() {
        StaticConsentPolicy candidate = StaticConsentPolicy.localCandidate(true);
        InMemoryConsentStore store = new InMemoryConsentStore();
        PrincipalId principal = PrincipalId.random();
        ConsentPolicyDescriptor descriptor = candidate.descriptor(ConsentType.TERMS_OF_SERVICE);
        store.append(new ConsentRecord(principal, TenantScope.derive(principal), ConsentType.TERMS_OF_SERVICE,
                descriptor.documentVersion(), true, NOW));
        StaticConsentPolicy policy = StaticConsentPolicy.localCandidate(false);
        ConsentService consents = new ConsentService(store, policy, new RecordingAudit(), CLOCK);
        assertEquals(false, consents.hasRequiredConsentFor(principal, "LEARNING"));
        assertThrows(IamPolicyException.class, () -> policy.descriptor(ConsentType.TERMS_OF_SERVICE));
    }

    @Test
    void adultGateRejectsMissingAndUnderageEvidenceFailClosed() {
        AdultGateService gate = new AdultGateService(new RecordingAudit(), CLOCK);
        var principal = com.englishflow.iam.domain.PrincipalId.random();

        AdultGateResult missing = gate.evaluate(new AdultGateCommand(principal, true, null,
                null, null, ClientAuthorityClaims.none()));
        AdultGateResult underage = gate.evaluate(new AdultGateCommand(principal, true,
                TrustedAgeEvidence.fromServerAttestation(17, "test-attestation", NOW),
                null, null, ClientAuthorityClaims.none()));

        assertEquals(IamDecisionCode.ADULT_AGE_EVIDENCE_MISSING, missing.code());
        assertEquals(IamDecisionCode.ADULT_AGE_BELOW_MINIMUM, underage.code());
        assertEquals(false, missing.allowed());
        assertEquals(false, underage.allowed());
    }

    @Test
    void idempotencyReplaysSameResultAndRejectsDifferentPayloadWithoutPersistingSecrets() {
        IdempotencyService idempotency = new IdempotencyService(new com.englishflow.iam.domain.InMemoryIdempotencyStore(),
                runtimeObjectMapper(), com.englishflow.iam.domain.IamTransactionRunner.direct(),
                IDEMPOTENCY_REPLAY_KEY, IDEMPOTENCY_FINGERPRINT_KEY, Duration.ofHours(24));
        AtomicInteger operations = new AtomicInteger();
        String hash = idempotency.fingerprint("payload", "password-is-transient");
        ResponseEntity<String> first = idempotency.execute("/auth/login", "key-1234567890123456", hash,
                () -> {
                    operations.incrementAndGet();
                    return new IdempotencyService.Execution<>(ResponseEntity.ok("safe-result"), "session-ref");
                }, record -> ResponseEntity.status(record.responseStatus()).body("safe-result"));
        ResponseEntity<String> replay = idempotency.execute("/auth/login", "key-1234567890123456", hash,
                () -> {
                    operations.incrementAndGet();
                    return new IdempotencyService.Execution<>(ResponseEntity.ok("must-not-run"), "bad");
                }, record -> ResponseEntity.status(record.responseStatus()).body("safe-result"));

        assertEquals(first.getBody(), replay.getBody());
        assertEquals(1, operations.get());
        IamPolicyException conflict = assertThrows(IamPolicyException.class,
                () -> idempotency.execute("/auth/login", "key-1234567890123456",
                        idempotency.fingerprint("different"),
                        () -> new IdempotencyService.Execution<>(ResponseEntity.ok("no"), "no"),
                        record -> ResponseEntity.ok("no")));
        assertEquals(IamDecisionCode.IDEMPOTENCY_KEY_REUSED, conflict.code());
    }

    @Test
    void encryptedSnapshotReplaysExactlyAfterLaterRotationAndRejectsExpectedFailureOnce() {
        ObjectMapper mapper = runtimeObjectMapper();
        var store = new com.englishflow.iam.domain.InMemoryIdempotencyStore();
        IdempotencyService idempotency = new IdempotencyService(store, mapper,
                com.englishflow.iam.domain.IamTransactionRunner.direct(),
                IDEMPOTENCY_REPLAY_KEY, IDEMPOTENCY_FINGERPRINT_KEY, Duration.ofHours(24));
        TypeReference<String> type = new TypeReference<>() {};
        String firstHash = idempotency.fingerprint("K1", "refresh");
        ResponseEntity<String> first = idempotency.execute("/api/v1/iam/consents", "key-k1-123456789",
                firstHash, type,
                () -> new IdempotencyService.Execution<>(ResponseEntity.ok()
                        .header(HttpHeaders.SET_COOKIE, "refresh=opaque-secret; HttpOnly")
                        .body("access-opaque-secret"), "session-reference"),
                record -> ResponseEntity.status(500).body("fallback-must-not-run"));

        String secondHash = idempotency.fingerprint("K2", "refresh");
        idempotency.execute("/api/v1/iam/consents", "key-k2-123456789", secondHash, type,
                () -> new IdempotencyService.Execution<>(ResponseEntity.ok().body("later-rotation"), "later"),
                record -> ResponseEntity.status(500).body("fallback-must-not-run"));

        ResponseEntity<String> replay = idempotency.execute("/api/v1/iam/consents", "key-k1-123456789",
                firstHash, type,
                () -> new IdempotencyService.Execution<>(ResponseEntity.ok().body("must-not-run"), "bad"),
                record -> ResponseEntity.status(500).body("fallback-must-not-run"));
        assertEquals(first.getStatusCode(), replay.getStatusCode());
        assertEquals(first.getBody(), replay.getBody());
        assertEquals(first.getHeaders().get(HttpHeaders.SET_COOKIE), replay.getHeaders().get(HttpHeaders.SET_COOKIE));

        AtomicInteger failedOperationRuns = new AtomicInteger();
        String rejectedHash = idempotency.fingerprint("reject-me");
        IamPolicyException firstFailure = assertThrows(IamPolicyException.class, () ->
                idempotency.execute("/auth/login", "key-rejected-123456", rejectedHash, type,
                        () -> {
                            failedOperationRuns.incrementAndGet();
                            throw new IamPolicyException(IamDecisionCode.ACCOUNT_LOCKED, "iam.account.locked");
                        }, record -> ResponseEntity.ok("must-not-run")));
        IamPolicyException repeatedFailure = assertThrows(IamPolicyException.class, () ->
                idempotency.execute("/auth/login", "key-rejected-123456", rejectedHash, type,
                        () -> {
                            failedOperationRuns.incrementAndGet();
                            return new IdempotencyService.Execution<>(ResponseEntity.ok("must-not-run"), "bad");
                        }, record -> ResponseEntity.ok("must-not-run")));
        assertEquals(IamDecisionCode.ACCOUNT_LOCKED, firstFailure.code());
        assertEquals(firstFailure.code(), repeatedFailure.code());
        assertEquals(1, failedOperationRuns.get());
        assertTrue(store.claim("/auth/login", "key-rejected-123456", rejectedHash).rejected());

        assertThrows(IllegalStateException.class,
                () -> new IdempotencyService(store, mapper, com.englishflow.iam.domain.IamTransactionRunner.direct(),
                        "weak-secret", IDEMPOTENCY_FINGERPRINT_KEY, Duration.ofHours(24)));
    }

    @Test
    void instantBearingResponseSnapshotSurvivesExactEncryptedReplay() {
        ObjectMapper mapper = runtimeObjectMapper();
        var store = new com.englishflow.iam.domain.InMemoryIdempotencyStore();
        IdempotencyService idempotency = new IdempotencyService(store, mapper,
                com.englishflow.iam.domain.IamTransactionRunner.direct(),
                IDEMPOTENCY_REPLAY_KEY, IDEMPOTENCY_FINGERPRINT_KEY, Duration.ofHours(24));
        TypeReference<TimedEnvelope> type = new TypeReference<>() {};
        String hash = idempotency.fingerprint("instant-envelope", NOW);

        ResponseEntity<TimedEnvelope> first = idempotency.execute("/api/v1/iam/adult-gate",
                "key-instant-123456789", hash, type,
                () -> new IdempotencyService.Execution<>(
                        ResponseEntity.ok(new TimedEnvelope("created", NOW)), "session-ref"),
                record -> ResponseEntity.status(500).build());
        ResponseEntity<TimedEnvelope> replay = idempotency.execute("/api/v1/iam/adult-gate",
                "key-instant-123456789", hash, type,
                () -> new IdempotencyService.Execution<>(
                        ResponseEntity.ok(new TimedEnvelope("must-not-run", NOW.plusSeconds(1))), "bad"),
                record -> ResponseEntity.status(500).build());

        assertEquals(first.getBody(), replay.getBody());
        assertEquals(NOW, replay.getBody().serverTime());
    }

    @Test
    void accountAndResetRateWindowsAreActuallyEnforced() {
        IamServiceProperties properties = properties();
        properties.getAccount().setLoginRequestsPerMinute(1);
        properties.getAccount().setResetRequestsPerMinute(1);
        RecordingAudit audit = new RecordingAudit();
        InMemoryRateLimitStore limits = new InMemoryRateLimitStore();
        InMemoryAccountStore accountsStore = new InMemoryAccountStore();
        PasswordAccountService passwords = new PasswordAccountService(accountsStore,
                new BCryptPasswordEncoder(12), audit, CLOCK, properties, limits);
        passwords.register("rate@example.com", "correct horse battery staple!", ClientAuthorityClaims.none());
        assertThrows(IamPolicyException.class, () -> passwords.authenticate("rate@example.com", "wrong password"));
        IamPolicyException loginLimited = assertThrows(IamPolicyException.class,
                () -> passwords.authenticate("rate@example.com", "wrong password"));
        assertEquals(IamDecisionCode.RATE_LIMITED, loginLimited.code());

        PasswordResetService resets = new PasswordResetService(accountsStore,
                new InMemoryPasswordResetChallengeStore(), passwords, audit, CLOCK, properties,
                null, com.englishflow.iam.domain.IamTransactionRunner.direct(), limits,
                new InMemoryPasswordResetDelivery(), IDEMPOTENCY_FINGERPRINT_KEY);
        resets.request("rate@example.com");
        IamPolicyException resetLimited = assertThrows(IamPolicyException.class,
                () -> resets.request("rate@example.com"));
        assertEquals(IamDecisionCode.RATE_LIMITED, resetLimited.code());
    }

    @Test
    void passwordResetHandoffIsNonEnumeratingAuditedAndKeyed() {
        IamServiceProperties properties = properties();
        properties.getAccount().setResetRequestsPerMinute(2);
        RecordingAudit audit = new RecordingAudit();
        InMemoryAccountStore accounts = new InMemoryAccountStore();
        PasswordAccountService passwords = new PasswordAccountService(accounts,
                new BCryptPasswordEncoder(12), audit, CLOCK, properties);
        AccountRecord active = passwords.register("handoff@example.com", "correct horse battery staple!",
                ClientAuthorityClaims.none());
        PrincipalId disabledPrincipal = PrincipalId.random();
        accounts.save(new AccountRecord(disabledPrincipal, "disabled@example.com", active.passwordHash(),
                active.roles(), active.permissions(), com.englishflow.iam.domain.AccountStatus.DISABLED,
                0, null, NOW, NOW));
        InMemoryPasswordResetDelivery delivery = new InMemoryPasswordResetDelivery();
        InMemoryRateLimitStore limits = new InMemoryRateLimitStore();
        PasswordResetService resets = new PasswordResetService(accounts,
                new InMemoryPasswordResetChallengeStore(), passwords, audit, CLOCK, properties,
                null, com.englishflow.iam.domain.IamTransactionRunner.direct(), limits, delivery,
                IDEMPOTENCY_FINGERPRINT_KEY);

        resets.request("handoff@example.com");
        assertEquals(1, delivery.deliveredCount());
        assertTrue(delivery.deliveries().get(0).expiresAt().isAfter(NOW));
        assertTrue(audit.decisions().stream().anyMatch(decision ->
                "password_reset_requested".equals(decision.decisionType()) && decision.allowed()));

        resets.request("missing@example.com");
        assertEquals(1, delivery.deliveredCount(), "unknown identifiers must not receive a challenge");
        AuditDecision missing = audit.decisions().get(audit.decisions().size() - 1);
        assertEquals("password_reset_denied", missing.decisionType());
        assertTrue(missing.principalId().isUnresolved());
        assertFalse(missing.allowed());

        resets.request("disabled@example.com");
        assertEquals(1, delivery.deliveredCount(), "disabled accounts must not receive a challenge");
        AuditDecision disabled = audit.decisions().get(audit.decisions().size() - 1);
        assertEquals("password_reset_denied", disabled.decisionType());
        assertEquals(disabledPrincipal, disabled.principalId());
        assertFalse(disabled.allowed());

        // Audit facts never carry the identifier, the token or any other secret material.
        assertTrue(audit.decisions().stream().allMatch(decision -> decision.safeAttributes().isEmpty()));
        assertTrue(audit.decisions().stream().noneMatch(decision ->
                decision.decisionType().contains("@")
                        || decision.decisionType().toLowerCase(java.util.Locale.ROOT).contains("token")));

        // The rate-limit denial is audited and its public shape stays the canonical 429 error.
        resets.request("handoff@example.com");
        IamPolicyException limited = assertThrows(IamPolicyException.class,
                () -> resets.request("handoff@example.com"));
        assertEquals(IamDecisionCode.RATE_LIMITED, limited.code());
        AuditDecision limitedAudit = audit.decisions().get(audit.decisions().size() - 1);
        assertEquals("password_reset_rate_limited", limitedAudit.decisionType());
        assertTrue(limitedAudit.principalId().isUnresolved());
        assertFalse(limitedAudit.allowed());

        // A different deployment HMAC key selects an independent rate bucket for the same target.
        PasswordResetService otherDeployment = new PasswordResetService(accounts,
                new InMemoryPasswordResetChallengeStore(), passwords, audit, CLOCK, properties,
                null, com.englishflow.iam.domain.IamTransactionRunner.direct(), null,
                new InMemoryPasswordResetDelivery(), IDEMPOTENCY_REPLAY_KEY);
        otherDeployment.request("handoff@example.com");
    }

    @Test
    void unprovisionedDeliveryIsAuditedWithoutChangingTheAcceptedOutcome() {        IamServiceProperties properties = properties();
        RecordingAudit audit = new RecordingAudit();
        InMemoryAccountStore accounts = new InMemoryAccountStore();
        PasswordAccountService passwords = new PasswordAccountService(accounts,
                new BCryptPasswordEncoder(12), audit, CLOCK, properties);
        passwords.register("nodelivery@example.com", "correct horse battery staple!",
                ClientAuthorityClaims.none());
        PasswordResetService resets = new PasswordResetService(accounts,
                new InMemoryPasswordResetChallengeStore(), passwords, audit, CLOCK, properties,
                null, com.englishflow.iam.domain.IamTransactionRunner.direct(), null,
                new com.englishflow.iam.domain.UnprovisionedPasswordResetDelivery(),
                IDEMPOTENCY_FINGERPRINT_KEY);

        resets.request("nodelivery@example.com");
        assertTrue(audit.decisions().stream().anyMatch(decision ->
                        "password_reset_delivery_unprovisioned".equals(decision.decisionType())
                                && !decision.allowed()),
                "a missing transport must stay visible to operations through audit");
    }

    @Test
    void nonLocalRuntimeRejectsEphemeralSignerAndWeakPersistentReplaySecret() {
        IamServiceProperties properties = properties();
        properties.getJwt().setEphemeralKeysAllowed(true);
        assertThrows(IllegalStateException.class, () ->
                new com.englishflow.iam.config.IamRuntimeConfiguration()
                        .iamSecurityConfigurationGuard(properties, new MockEnvironment()));

        properties.getJwt().setEphemeralKeysAllowed(false);
        properties.getPersistence().setEnabled(false);
        assertThrows(IllegalStateException.class, () ->
                new com.englishflow.iam.config.IamRuntimeConfiguration()
                        .iamSecurityConfigurationGuard(properties, new MockEnvironment()));

        properties.getPersistence().setEnabled(true);
        properties.getIdempotency().setReplaySecret("weak-secret");
        assertThrows(IllegalStateException.class, () ->
                new com.englishflow.iam.config.IamRuntimeConfiguration()
                        .iamSecurityConfigurationGuard(properties, new MockEnvironment()));
    }

    @Test
    void unverifiedNativeTransportTrustRequiresAnExplicitLocalOrTestProfile() {
        IamServiceProperties properties = properties();
        properties.getPersistence().setEnabled(true);
        properties.getPersistence().setJdbcUrl("jdbc:mysql://127.0.0.1:13306/iam_service");
        properties.getIdempotency().setReplaySecret("native-guard-replay-secret-2026-abcdefgh");
        properties.getIdempotency().setFingerprintSecret("native-guard-fingerprint-secret-2026-abcdefgh");
        properties.getAuth().setNativeTransportPolicy("local-unverified");
        assertThrows(IllegalStateException.class, () ->
                new com.englishflow.iam.config.IamRuntimeConfiguration()
                        .iamSecurityConfigurationGuard(properties, new MockEnvironment()));

        MockEnvironment local = new MockEnvironment();
        local.setActiveProfiles("local");
        new com.englishflow.iam.config.IamRuntimeConfiguration()
                .iamSecurityConfigurationGuard(properties, local);
    }

    @Test
    void adultInvalidationAndConsentWithdrawalRevokeSessions() {
        RecordingAudit audit = new RecordingAudit();
        var principal = com.englishflow.iam.domain.PrincipalId.random();
        SessionService sessions = new SessionService(new InMemorySessionStore(), audit, CLOCK, properties());
        sessions.open(ServerPrincipalContext.forPlatform(principal, Set.of("learner")),
                new com.englishflow.iam.domain.DeviceId("gate-session"));
        InMemoryAdultGateFactStore facts = new InMemoryAdultGateFactStore();
        AdultGateService gate = new AdultGateService(audit, CLOCK, facts, sessions,
                com.englishflow.iam.domain.IamTransactionRunner.direct());
        facts.approve(principal, "b30-adult-v1", NOW);
        gate.invalidate(principal, "b30-adult-v1");
        assertTrue(sessions.findByPrincipal(principal).stream()
                .allMatch(session -> session.status() == com.englishflow.iam.domain.SessionStatus.REVOKED));

        SessionService consentSessions = new SessionService(new InMemorySessionStore(), audit, CLOCK, properties());
        consentSessions.open(ServerPrincipalContext.forPlatform(principal, Set.of("learner")),
                new com.englishflow.iam.domain.DeviceId("consent-session"));
        ConsentVersion version = new ConsentVersion("b30-consent-v1");
        ConsentService consents = new ConsentService(new InMemoryConsentStore(),
                new StaticConsentPolicy(Map.of(ConsentType.TERMS_OF_SERVICE, version,
                        ConsentType.PRIVACY_NOTICE, version)), audit, CLOCK, consentSessions,
                com.englishflow.iam.domain.IamTransactionRunner.direct());
        ServerPrincipalContext context = ServerPrincipalContext.forPlatform(principal, Set.of("learner"));
        consents.record(context, new ConsentCommand(ConsentType.TERMS_OF_SERVICE, version, true,
                ClientAuthorityClaims.none()));
        consents.withdraw(context, ConsentType.TERMS_OF_SERVICE, version);
        assertTrue(consentSessions.findByPrincipal(principal).stream()
                .allMatch(session -> session.status() == com.englishflow.iam.domain.SessionStatus.REVOKED));
    }

    @Test
    void rejectedConsentCasLeavesNoSuccessAudit() {
        RecordingAudit audit = new RecordingAudit();
        ConsentVersion version = new ConsentVersion("b30-consent-v1");
        ConsentService consents = new ConsentService(new RejectingConsentStore(),
                new StaticConsentPolicy(Map.of(ConsentType.TERMS_OF_SERVICE, version)), audit, CLOCK, null,
                com.englishflow.iam.domain.IamTransactionRunner.direct());
        ServerPrincipalContext context = ServerPrincipalContext.forPlatform(PrincipalId.random(), Set.of("learner"));

        IamPolicyException failure = assertThrows(IamPolicyException.class, () -> consents.record(context,
                new ConsentCommand(ConsentType.TERMS_OF_SERVICE, version, true, ClientAuthorityClaims.none())));
        assertEquals(IamDecisionCode.CONSENT_VERSION_MISMATCH, failure.code());
        assertTrue(audit.decisions().stream().noneMatch(decision ->
                        "consent_recorded".equals(decision.decisionType())),
                "a rejected consent CAS must not leave a success audit claiming an unstored fact");
    }

    private static IamServiceProperties properties() {
        IamServiceProperties properties = new IamServiceProperties();
        properties.getAccount().setPasswordMinLength(12);
        return properties;
    }

    private static ObjectMapper runtimeObjectMapper() {
        return new com.englishflow.iam.config.IamRuntimeConfiguration().iamObjectMapper();
    }

    private record TimedEnvelope(String status, Instant serverTime) {}

    private static final class RecordingAudit implements AuditFactPort {
        private final List<AuditDecision> decisions = new ArrayList<>();

        @Override
        public void append(AuditDecision decision) {
            decisions.add(decision);
        }

        List<AuditDecision> decisions() {
            return List.copyOf(decisions);
        }
    }

    /**
     * In-memory store plus runner that emulates the production transaction rollback: when the
     * operation throws, every record appended during it is discarded, so audit/CAS atomicity can
     * be asserted without a database.
     */
    private static final class TransactionalConsentStore implements ConsentStore {
        private InMemoryConsentStore delegate = new InMemoryConsentStore();
        private final LinkedHashSet<String> touched = new LinkedHashSet<>();

        IamTransactionRunner runner() {
            return new IamTransactionRunner() {
                @Override
                public <T> T execute(java.util.function.Supplier<T> operation) {
                    Map<String, List<ConsentRecord>> snapshot = new HashMap<>();
                    for (String key : touched) {
                        String[] parts = key.split("\\|", 2);
                        PrincipalId principal = new PrincipalId(UUID.fromString(parts[0]));
                        ConsentType type = ConsentType.valueOf(parts[1]);
                        snapshot.put(key, delegate.history(principal, type).stream()
                                .map(ConsentHistoryEntry::verifiedRecord).toList());
                    }
                    try {
                        return operation.get();
                    } catch (RuntimeException failure) {
                        InMemoryConsentStore restored = new InMemoryConsentStore();
                        snapshot.values().forEach(records -> records.forEach(restored::append));
                        delegate = restored;
                        throw failure;
                    }
                }
            };
        }

        private void touch(PrincipalId principalId, ConsentType type) {
            touched.add(principalId + "|" + type.name());
        }

        @Override
        public Optional<ConsentRecord> find(PrincipalId principalId, ConsentType type) {
            touch(principalId, type);
            return delegate.find(principalId, type);
        }

        @Override
        public Optional<ConsentRecord> findForUpdate(PrincipalId principalId, ConsentType type) {
            touch(principalId, type);
            return delegate.findForUpdate(principalId, type);
        }

        @Override
        public ConsentRecord append(ConsentRecord record) {
            touch(record.principalId(), record.type());
            return delegate.append(record);
        }

        @Override
        public ConsentRecord appendIfCurrent(ConsentRecord record, ConsentRecord expected) {
            touch(record.principalId(), record.type());
            return delegate.appendIfCurrent(record, expected);
        }

        @Override
        public List<ConsentHistoryEntry> history(PrincipalId principalId, ConsentType type) {
            touch(principalId, type);
            return delegate.history(principalId, type);
        }
    }

    /** Store whose guarded append always loses the CAS, so the audit ordering is observable. */
    private static final class RejectingConsentStore implements ConsentStore {        @Override
        public Optional<ConsentRecord> find(PrincipalId principalId, ConsentType type) {
            return Optional.empty();
        }

        @Override
        public Optional<ConsentRecord> findForUpdate(PrincipalId principalId, ConsentType type) {
            return Optional.empty();
        }

        @Override
        public ConsentRecord append(ConsentRecord record) {
            throw new IamPolicyException(IamDecisionCode.CONSENT_VERSION_MISMATCH, "iam.consent.version_mismatch");
        }

        @Override
        public ConsentRecord appendIfCurrent(ConsentRecord record, ConsentRecord expected) {
            throw new IamPolicyException(IamDecisionCode.CONSENT_VERSION_MISMATCH, "iam.consent.version_mismatch");
        }

        @Override
        public List<ConsentHistoryEntry> history(PrincipalId principalId, ConsentType type) {
            return List.of();
        }
    }
}
