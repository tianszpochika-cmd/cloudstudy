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
import com.englishflow.iam.domain.ConsentPolicyDescriptor;
import com.englishflow.iam.domain.ConsentRecord;
import com.englishflow.iam.domain.ConsentService;
import com.englishflow.iam.domain.ConsentType;
import com.englishflow.iam.domain.ConsentVersion;
import com.englishflow.iam.domain.InMemoryAccountStore;
import com.englishflow.iam.domain.InMemoryConsentStore;
import com.englishflow.iam.domain.InMemoryPasswordResetChallengeStore;
import com.englishflow.iam.domain.InMemoryRateLimitStore;
import com.englishflow.iam.domain.InMemorySessionStore;
import com.englishflow.iam.domain.InMemoryAdultGateFactStore;
import com.englishflow.iam.domain.IdempotencyRecord;
import com.englishflow.iam.domain.IdempotencyService;
import com.englishflow.iam.domain.IamDecisionCode;
import com.englishflow.iam.domain.IamPolicyException;
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
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** Java 25 in-process security-fact tests; no external service is treated as runtime evidence. */
class IamSecurityFactsTest {

    private static final Instant NOW = Instant.parse("2026-09-01T00:00:00Z");
    private static final Clock CLOCK = Clock.fixed(NOW, ZoneOffset.UTC);

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
                properties, sessions, com.englishflow.iam.domain.IamTransactionRunner.direct());

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
        InMemoryConsentStore store = new InMemoryConsentStore();
        AuditFactPort failingAudit = decision -> {
            throw new IllegalStateException("audit unavailable");
        };
        ConsentService consents = new ConsentService(store, policy, failingAudit, CLOCK);
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
                runtimeObjectMapper());
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
                "stable-test-idempotency-replay-secret-2026");
        TypeReference<String> type = new TypeReference<>() {};
        String firstHash = idempotency.fingerprint("K1", "refresh");
        ResponseEntity<String> first = idempotency.execute("/auth/token/refresh", "key-k1-123456789",
                firstHash, type,
                () -> new IdempotencyService.Execution<>(ResponseEntity.ok()
                        .header(HttpHeaders.SET_COOKIE, "refresh=opaque-secret; HttpOnly")
                        .body("access-opaque-secret"), "session-reference"),
                record -> ResponseEntity.status(500).body("fallback-must-not-run"));

        String secondHash = idempotency.fingerprint("K2", "refresh");
        idempotency.execute("/auth/token/refresh", "key-k2-123456789", secondHash, type,
                () -> new IdempotencyService.Execution<>(ResponseEntity.ok().body("later-rotation"), "later"),
                record -> ResponseEntity.status(500).body("fallback-must-not-run"));

        ResponseEntity<String> replay = idempotency.execute("/auth/token/refresh", "key-k1-123456789",
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
                        "weak-secret"));
    }

    @Test
    void instantBearingResponseSnapshotSurvivesExactEncryptedReplay() {
        ObjectMapper mapper = runtimeObjectMapper();
        var store = new com.englishflow.iam.domain.InMemoryIdempotencyStore();
        IdempotencyService idempotency = new IdempotencyService(store, mapper,
                com.englishflow.iam.domain.IamTransactionRunner.direct(),
                "stable-test-idempotency-replay-secret-2026");
        TypeReference<TimedEnvelope> type = new TypeReference<>() {};
        String hash = idempotency.fingerprint("instant-envelope", NOW);

        ResponseEntity<TimedEnvelope> first = idempotency.execute("/auth/register",
                "key-instant-123456789", hash, type,
                () -> new IdempotencyService.Execution<>(
                        ResponseEntity.ok(new TimedEnvelope("created", NOW)), "session-ref"),
                record -> ResponseEntity.status(500).build());
        ResponseEntity<TimedEnvelope> replay = idempotency.execute("/auth/register",
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
                null, com.englishflow.iam.domain.IamTransactionRunner.direct(), limits);
        resets.request("rate@example.com");
        IamPolicyException resetLimited = assertThrows(IamPolicyException.class,
                () -> resets.request("rate@example.com"));
        assertEquals(IamDecisionCode.RATE_LIMITED, resetLimited.code());
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
    }
}
