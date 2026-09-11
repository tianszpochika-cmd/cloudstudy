package com.englishflow.iam;

import com.englishflow.iam.domain.ClientAuthorityClaims;
import com.englishflow.iam.domain.ConsentCommand;
import com.englishflow.iam.domain.ConsentPolicyDescriptor;
import com.englishflow.iam.domain.ConsentPolicyPort;
import com.englishflow.iam.domain.ConsentRecord;
import com.englishflow.iam.domain.ConsentService;
import com.englishflow.iam.domain.ConsentType;
import com.englishflow.iam.domain.ConsentVersion;
import com.englishflow.iam.domain.IamDecisionCode;
import com.englishflow.iam.domain.IamPolicyException;
import com.englishflow.iam.domain.JdbcConsentPolicy;
import com.englishflow.iam.domain.PrincipalId;
import com.englishflow.iam.domain.ServerPrincipalContext;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Opt-in MySQL proof that a non-local composition reads consent documents from the published
 * control plane, fails closed while nothing is published, and accepts a real consent write only
 * against the provisioned facts.
 */
@SpringBootTest(
        classes = IamServiceApplication.class,
        webEnvironment = SpringBootTest.WebEnvironment.MOCK,
        properties = {
                "iam.persistence.enabled=true",
                "iam.persistence.jdbc-url=${IAM_JDBC_URL:jdbc:mysql://127.0.0.1:13306/iam_service?useUnicode=true&characterEncoding=utf8&serverTimezone=UTC}",
                "iam.persistence.username=${IAM_JDBC_USERNAME:iam_runtime}",
                "iam.persistence.password=${IAM_JDBC_PASSWORD:}",
                "iam.consent.policy-source=control-plane",
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
class IamConsentPolicyJdbcPersistenceContextTest {

    private static final String DOCUMENT_VERSION = "ctl-consent-doc-v1";
    private static final String POLICY_VERSION = "ctl-consent-policy-v1";
    private static final String POLICY_DIGEST = "f".repeat(64);

    @Autowired
    private JdbcTemplate jdbc;

    @Autowired
    private ConsentPolicyPort policy;

    @Autowired
    private ConsentService consents;

    @Test
    void nonLocalProfileReadsPublishedDocumentsAndFailsClosedWithoutThem() {
        assertTrue(policy instanceof JdbcConsentPolicy,
                "an explicit control-plane source must read the published consent-document control plane");
        assertTrue(policy.writesEnabled());
        assertTrue(policy.evaluationEnabled());

        deletePublishedDocuments();
        IamPolicyException unavailable = assertThrows(IamPolicyException.class,
                () -> policy.descriptor(ConsentType.TERMS_OF_SERVICE));
        assertEquals(IamDecisionCode.POLICY_UNAVAILABLE, unavailable.code());
        assertEquals(Set.of(), policy.descriptors());
        assertFalse(consents.hasRequiredConsentFor(PrincipalId.random(), "LEARNING"),
                "an empty published-required set must restrict the capability instead of authorizing it");

        PrincipalId principal = PrincipalId.random();
        ServerPrincipalContext context = ServerPrincipalContext.forPlatform(principal, Set.of("learner"));
        try {
            publishDocuments();
            for (ConsentType type : ConsentType.values()) {
                ConsentPolicyDescriptor descriptor = policy.descriptor(type);
                assertEquals(type, descriptor.type());
                assertEquals(type.purpose(), descriptor.purpose());
                assertEquals(DOCUMENT_VERSION, descriptor.documentVersion().value());
                assertEquals(POLICY_VERSION, descriptor.policyVersion().value());
                assertTrue(descriptor.runtimeVerified());
                assertTrue(descriptor.isPublishedAt(Instant.now()));
            }
            assertEquals(ConsentType.values().length, policy.descriptors().size());

            ConsentPolicyDescriptor terms = policy.descriptor(ConsentType.TERMS_OF_SERVICE);
            ConsentRecord record = consents.record(context, new ConsentCommand(ConsentType.TERMS_OF_SERVICE,
                    terms.documentVersion(), true, ClientAuthorityClaims.none(), terms.documentDigest()));
            assertTrue(record.accepted());
            assertEquals(terms.documentDigest(), record.documentDigest());
            assertEquals(terms.policyVersion(), record.policyVersion());
        } finally {
            cleanupPrincipal(principal);
            deletePublishedDocuments();
        }

        IamPolicyException revoked = assertThrows(IamPolicyException.class,
                () -> consents.record(context, new ConsentCommand(ConsentType.TERMS_OF_SERVICE,
                        new ConsentVersion(DOCUMENT_VERSION), true, ClientAuthorityClaims.none(), "0".repeat(64))));
        assertEquals(IamDecisionCode.POLICY_UNAVAILABLE, revoked.code());
        assertTrue(policy.descriptors().isEmpty(), "a deployment without published documents stays fail-closed");
    }

    @Test
    void partiallyPublishedControlPlaneMissingALearningRequiredTypeFailsClosed() {
        deletePublishedDocuments();
        PrincipalId principal = PrincipalId.random();
        ServerPrincipalContext context = ServerPrincipalContext.forPlatform(principal, Set.of("learner"));
        try {
            publishDocuments(Set.of("TERMS_OF_SERVICE", "PRIVACY_NOTICE"));
            for (ConsentType type : List.of(ConsentType.TERMS_OF_SERVICE, ConsentType.PRIVACY_NOTICE)) {
                ConsentPolicyDescriptor descriptor = policy.descriptor(type);
                consents.record(context, new ConsentCommand(type, descriptor.documentVersion(), true,
                        ClientAuthorityClaims.none(), descriptor.documentDigest()));
            }
            assertFalse(consents.hasRequiredConsentFor(principal, "LEARNING"),
                    "a control plane missing ADULT_LEARNING must not authorize LEARNING");
            assertTrue(consents.hasRequiredConsentFor(principal, "ACCOUNT"),
                    "ACCOUNT only needs the published and satisfied BASE_REQUIRED types");
        } finally {
            cleanupPrincipal(principal);
            deletePublishedDocuments();
        }
    }

    private void publishDocuments() {
        publishDocuments(Set.of("TERMS_OF_SERVICE", "PRIVACY_NOTICE", "ADULT_LEARNING",
                "PRODUCT_ANALYTICS", "VOICE_RECORDING"));
    }

    private void publishDocuments(Set<String> onlyTypes) {
        Instant publishedAt = Instant.now().minusSeconds(86_400);
        List<String[]> documents = List.of(
                new String[]{"TERMS_OF_SERVICE", "1", "BASE_REQUIRED", "[\"ACCOUNT\",\"LEARNING\"]", "RESTRICT_ALL_LEARNING_ACCESS", "1"},
                new String[]{"PRIVACY_NOTICE", "2", "BASE_REQUIRED", "[\"ACCOUNT\",\"LEARNING\"]", "RESTRICT_ALL_LEARNING_ACCESS", "1"},
                new String[]{"ADULT_LEARNING", "3", "LEARNING_REQUIRED", "[\"LEARNING\"]", "RESTRICT_ALL_LEARNING_ACCESS", "1"},
                new String[]{"PRODUCT_ANALYTICS", "4", "OPTIONAL", "[\"ANALYTICS\"]", "RESTRICT_PROTECTED_CAPABILITY", "0"},
                new String[]{"VOICE_RECORDING", "5", "CAPABILITY_REQUIRED",
                        "[\"VOICE_REMOTE_RECORD\",\"VOICE_REMOTE_UPLOAD\",\"VOICE_REMOTE_PROCESS\",\"VOICE_REMOTE_REPLAY\"]",
                        "RESTRICT_PROTECTED_CAPABILITY", "0"});
        for (String[] document : documents) {
            if (!onlyTypes.contains(document[0])) continue;
            jdbc.update("INSERT INTO iam_consent_document_version (consent_document_id, tenant_id, consent_type, "
                            + "document_version, document_digest, published_at, policy_version, policy_digest, "
                            + "requirement, capabilities, withdrawal_effect, revoke_sessions, policy_ref, "
                            + "runtime_status, lifecycle_status, revoked_at, created_at) "
                            + "VALUES (?, 'platform', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'RUNTIME_VERIFIED', "
                            + "'ACTIVE', NULL, UTC_TIMESTAMP(6))",
                    UUID.randomUUID().toString(), document[0], DOCUMENT_VERSION, document[1].repeat(64),
                    Timestamp.from(publishedAt), POLICY_VERSION, POLICY_DIGEST, document[2], document[3],
                    document[4], Integer.parseInt(document[5]),
                    "iam://consent/" + document[0]);
        }
    }

    private void deletePublishedDocuments() {
        jdbc.update("DELETE FROM iam_consent_document_version WHERE tenant_id = 'platform' "
                + "AND document_version = ?", DOCUMENT_VERSION);
    }

    private void cleanupPrincipal(PrincipalId principal) {
        jdbc.update("DELETE FROM iam_consent_current WHERE principal_id = ?", principal.toString());
        jdbc.update("DELETE FROM iam_consent_lock WHERE principal_id = ?", principal.toString());
        jdbc.update("DELETE FROM iam_consent WHERE principal_id = ?", principal.toString());
        jdbc.update("DELETE FROM iam_decision_audit WHERE principal_id = ?", principal.toString());
    }
}
