package com.englishflow.iam;

import com.englishflow.iam.domain.ClientAuthorityClaims;
import com.englishflow.iam.domain.ConsentPolicyDescriptor;
import com.englishflow.iam.domain.ConsentPolicyPort;
import com.englishflow.iam.domain.ConsentRecord;
import com.englishflow.iam.domain.ConsentService;
import com.englishflow.iam.domain.ConsentType;
import com.englishflow.iam.domain.IamPolicyException;
import com.englishflow.iam.domain.JdbcConsentStore;
import com.englishflow.iam.domain.PrincipalId;
import com.englishflow.iam.domain.ServerPrincipalContext;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;

import java.util.List;
import java.util.Set;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Opt-in MySQL proof for the M2-002 consent history/current-fact boundary. It is skipped during
 * ordinary unit runs so a missing external database cannot be reported as runtime evidence.
 */
@SpringBootTest(
        classes = IamServiceApplication.class,
        webEnvironment = SpringBootTest.WebEnvironment.MOCK,
        properties = {
                "iam.persistence.enabled=true",
                "iam.persistence.jdbc-url=${IAM_JDBC_URL:jdbc:mysql://127.0.0.1:13306/iam_service?useUnicode=true&characterEncoding=utf8&serverTimezone=UTC}",
                "iam.persistence.username=${IAM_JDBC_USERNAME:iam_runtime}",
                "iam.persistence.password=${IAM_JDBC_PASSWORD:}",
                "spring.flyway.enabled=true",
                "iam.idempotency.replay-secret=test-only-idempotency-replay-secret",
                "iam.idempotency.fingerprint-secret=test-only-idempotency-fingerprint-secret",
                "iam.idempotency.v13-writers-drained=true",
                "iam.jwt.ephemeral-keys-allowed=true",
                "management.opentelemetry.enabled=false",
                "management.tracing.export.enabled=false",
                "management.otlp.metrics.export.enabled=false",
                "management.otlp.tracing.export.enabled=false"
        })
@ActiveProfiles("test")
@EnabledIfSystemProperty(named = "iam.jdbc.integration", matches = "true")
class IamConsentJdbcPersistenceContextTest {

    @Autowired
    private JdbcTemplate jdbc;

    @Autowired
    private ConsentService consents;

    @Autowired
    private ConsentPolicyPort policy;

    @Test
    void v11AddsSeparatePublishedFactsAndDeterministicCurrentProjection() {
        for (String column : List.of("purpose", "required_scope", "document_version", "document_digest",
                "policy_digest", "effective_at", "withdrawal_effect", "revoke_sessions")) {
            Integer present = jdbc.queryForObject(
                    "SELECT COUNT(*) FROM information_schema.columns "
                            + "WHERE table_schema = DATABASE() AND table_name = 'iam_consent' AND column_name = ?",
                    Integer.class, column);
            assertEquals(1, present, "missing V11 consent fact column " + column);
        }
        for (String table : List.of("iam_consent_lock", "iam_consent_current")) {
            Integer present = jdbc.queryForObject(
                    "SELECT COUNT(*) FROM information_schema.tables "
                            + "WHERE table_schema = DATABASE() AND table_name = ?",
                    Integer.class, table);
            assertEquals(1, present, "missing V11 consent table " + table);
        }

        String migration;
        try (java.io.InputStream source = IamConsentJdbcPersistenceContextTest.class
                .getResourceAsStream("/db/migration/V11__extend_iam_consent_facts.sql")) {
            if (source == null) throw new AssertionError("V11 migration must be packaged");
            migration = new String(source.readAllBytes(), java.nio.charset.StandardCharsets.UTF_8);
        } catch (java.io.IOException exception) {
            throw new AssertionError("V11 migration must be readable", exception);
        }
        assertTrue(migration.contains("ROW_NUMBER() OVER"),
                "current backfill must select one deterministic row per principal/type");
        assertTrue(migration.contains("ORDER BY c.granted_at DESC, c.consent_id DESC"),
                "current backfill must tie-break equal timestamps by immutable consent id");
    }

    @Test
    void jdbcConsentHistoryReplayAndRestartKeepServerPublishedFacts() {
        PrincipalId principal = PrincipalId.random();
        ServerPrincipalContext context = ServerPrincipalContext.forPlatform(principal, Set.of("learner"));
        ConsentPolicyDescriptor descriptor = policy.descriptor(ConsentType.TERMS_OF_SERVICE);
        try {
            ConsentRecord granted = consents.record(context, command(descriptor));
            ConsentRecord replay = consents.record(context, command(descriptor));
            assertEquals(granted, replay, "same published consent fact must replay without a duplicate");
            assertEquals(descriptor.documentDigest(), granted.documentDigest());
            assertEquals(descriptor.policyVersion(), granted.policyVersion());

            IamPolicyException mismatch = assertThrows(IamPolicyException.class, () ->
                    consents.record(context, new com.englishflow.iam.domain.ConsentCommand(
                            ConsentType.TERMS_OF_SERVICE, descriptor.documentVersion(), true,
                            ClientAuthorityClaims.none(), "0".repeat(64))));
            assertEquals(com.englishflow.iam.domain.IamDecisionCode.CONSENT_VERSION_MISMATCH, mismatch.code());

            ConsentRecord withdrawn = consents.withdraw(context, ConsentType.TERMS_OF_SERVICE,
                    descriptor.documentVersion(), descriptor.documentDigest());
            assertTrue(!withdrawn.accepted());
            ConsentRecord regranted = consents.record(context, command(descriptor));
            assertTrue(regranted.accepted());

            JdbcConsentStore restarted = new JdbcConsentStore(jdbc);
            List<ConsentRecord> history = restarted.history(principal, ConsentType.TERMS_OF_SERVICE);
            assertEquals(3, history.size(), "grant/withdraw/re-grant must retain immutable history");
            assertTrue(history.get(0).accepted());
            assertTrue(!history.get(1).accepted());
            assertTrue(history.get(2).accepted());
            ConsentRecord current = restarted.find(principal, ConsentType.TERMS_OF_SERVICE).orElseThrow();
            assertEquals(regranted, current, "a new store instance must read the current projection");
            Integer currentRows = jdbc.queryForObject(
                    "SELECT COUNT(*) FROM iam_consent_current WHERE principal_id = ? AND consent_type = ?",
                    Integer.class, principal.toString(), ConsentType.TERMS_OF_SERVICE.name());
            assertEquals(1, currentRows);
        } finally {
            cleanup(principal);
        }
    }

    @Test
    void jdbcConsentFirstGrantIsSerializedByStableLockRow() throws Exception {
        PrincipalId principal = PrincipalId.random();
        ServerPrincipalContext context = ServerPrincipalContext.forPlatform(principal, Set.of("learner"));
        ConsentPolicyDescriptor descriptor = policy.descriptor(ConsentType.PRIVACY_NOTICE);
        CountDownLatch ready = new CountDownLatch(2);
        CountDownLatch start = new CountDownLatch(1);
        ExecutorService executor = Executors.newFixedThreadPool(2);
        try {
            Future<ConsentRecord> first = executor.submit(() -> {
                ready.countDown();
                assertTrue(start.await(10, TimeUnit.SECONDS));
                return consents.record(context, command(descriptor));
            });
            Future<ConsentRecord> second = executor.submit(() -> {
                ready.countDown();
                assertTrue(start.await(10, TimeUnit.SECONDS));
                return consents.record(context, command(descriptor));
            });
            assertTrue(ready.await(10, TimeUnit.SECONDS));
            start.countDown();
            ConsentRecord firstResult = first.get(30, TimeUnit.SECONDS);
            ConsentRecord secondResult = second.get(30, TimeUnit.SECONDS);
            assertNotNull(firstResult);
            assertEquals(firstResult, secondResult,
                    "concurrent first grants must converge on one immutable current fact");
            Integer historyRows = jdbc.queryForObject(
                    "SELECT COUNT(*) FROM iam_consent WHERE principal_id = ? AND consent_type = ?",
                    Integer.class, principal.toString(), ConsentType.PRIVACY_NOTICE.name());
            assertEquals(1, historyRows);
        } finally {
            executor.shutdownNow();
            cleanup(principal);
        }
    }

    @Test
    void legacyCurrentFactIsDeniedUntilFreshServerPublishedReconsent() {
        PrincipalId principal = PrincipalId.random();
        ServerPrincipalContext context = ServerPrincipalContext.forPlatform(principal, Set.of("learner"));
        ConsentPolicyDescriptor descriptor = policy.descriptor(ConsentType.TERMS_OF_SERVICE);
        String legacyId = java.util.UUID.randomUUID().toString();
        java.sql.Timestamp now = java.sql.Timestamp.from(java.time.Instant.parse("2026-08-01T00:00:00Z"));
        try {
            jdbc.update("INSERT INTO iam_consent (consent_id, principal_id, consent_type, purpose, "
                            + "required_scope, document_version, document_digest, policy_version, policy_digest, "
                            + "status, granted_at, effective_at, withdrawal_effect, revoke_sessions) "
                            + "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    legacyId, principal.toString(), ConsentType.TERMS_OF_SERVICE.name(),
                    descriptor.purpose(), descriptor.requirement().name(), descriptor.documentVersion().value(),
                    null, descriptor.policyVersion().value(), null, "GRANTED", now, now,
                    descriptor.withdrawalEffect().name(), descriptor.revokeSessions() ? 1 : 0);
            jdbc.update("INSERT INTO iam_consent_lock (principal_id, consent_type, lock_id) VALUES (?, ?, ?)",
                    principal.toString(), ConsentType.TERMS_OF_SERVICE.name(), java.util.UUID.randomUUID().toString());
            jdbc.update("INSERT INTO iam_consent_current (principal_id, consent_type, consent_id, updated_at) VALUES (?, ?, ?, ?)",
                    principal.toString(), ConsentType.TERMS_OF_SERVICE.name(), legacyId, now);

            assertTrue(!consents.hasRequiredConsentFor(principal, "LEARNING"),
                    "legacy rows without published digests must not authorize learning");
            ConsentRecord fresh = consents.record(context, command(descriptor));
            assertTrue(fresh.accepted());
            assertEquals(descriptor.documentDigest(), fresh.documentDigest());
            assertEquals(fresh, new JdbcConsentStore(jdbc).find(principal, ConsentType.TERMS_OF_SERVICE).orElseThrow());
        } finally {
            cleanup(principal);
        }
    }

    private static com.englishflow.iam.domain.ConsentCommand command(ConsentPolicyDescriptor descriptor) {
        return new com.englishflow.iam.domain.ConsentCommand(descriptor.type(), descriptor.documentVersion(), true,
                ClientAuthorityClaims.none(), descriptor.documentDigest());
    }

    private void cleanup(PrincipalId principal) {
        jdbc.update("DELETE FROM iam_consent_current WHERE principal_id = ?", principal.toString());
        jdbc.update("DELETE FROM iam_consent_lock WHERE principal_id = ?", principal.toString());
        jdbc.update("DELETE FROM iam_consent WHERE principal_id = ?", principal.toString());
        jdbc.update("DELETE FROM iam_decision_audit WHERE principal_id = ?", principal.toString());
    }
}
