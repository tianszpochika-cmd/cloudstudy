package com.englishflow.iam;

import com.englishflow.iam.domain.ClientAuthorityClaims;
import com.englishflow.iam.domain.ConsentCommand;
import com.englishflow.iam.domain.ConsentPolicyDescriptor;
import com.englishflow.iam.domain.ConsentPolicyPort;
import com.englishflow.iam.domain.ConsentService;
import com.englishflow.iam.domain.ConsentType;
import com.englishflow.iam.domain.IamDecisionCode;
import com.englishflow.iam.domain.IamPolicyException;
import com.englishflow.iam.domain.IdempotencyService;
import com.englishflow.iam.domain.PrincipalId;
import com.englishflow.iam.domain.ServerPrincipalContext;
import com.fasterxml.jackson.core.type.TypeReference;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;

import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicBoolean;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;

/**
 * Opt-in MySQL proof that an expected consent rejection inside the IAM idempotency boundary
 * commits its rejection record instead of poisoning the outer transaction (rollback-only 500).
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
class IamConsentIdempotencyRollbackSafetyTest {

    private static final String SCOPE = "/api/v1/iam/consents";
    private static final TypeReference<String> TEXT = new TypeReference<>() {};

    @Autowired
    private JdbcTemplate jdbc;

    @Autowired
    private ConsentService consents;

    @Autowired
    private ConsentPolicyPort policy;

    @Autowired
    private IdempotencyService idempotency;

    @Test
    void expectedConsentRejectionCommitsRejectionInsteadOfRollingBackTheBoundary() {
        PrincipalId principal = PrincipalId.random();
        ServerPrincipalContext context = ServerPrincipalContext.forPlatform(principal, Set.of("learner"));
        ConsentPolicyDescriptor descriptor = policy.descriptor(ConsentType.TERMS_OF_SERVICE);
        String key = "m2-002-reject-" + UUID.randomUUID();
        String hash = idempotency.fingerprint(SCOPE, principal.toString(), "expected-rejection");
        try {
            IamPolicyException failure = assertThrows(IamPolicyException.class, () -> idempotency.execute(
                    SCOPE, key, hash, TEXT,
                    () -> {
                        consents.record(context, new ConsentCommand(ConsentType.TERMS_OF_SERVICE,
                                descriptor.documentVersion(), true, ClientAuthorityClaims.none(), "0".repeat(64)));
                        return new IdempotencyService.Execution<>(ResponseEntity.ok("unexpected"), null);
                    },
                    record -> ResponseEntity.status(409).body("replay")));
            assertEquals(IamDecisionCode.CONSENT_VERSION_MISMATCH, failure.code());

            Map<String, Object> row = jdbc.queryForMap(
                    "SELECT state, response_status, error_code FROM iam_idempotency_record "
                            + "WHERE scope_key = ? AND idempotency_key = ?",
                    SCOPE, key);
            assertEquals("REJECTED", row.get("state"));
            assertEquals(409, ((Number) row.get("response_status")).intValue());
            assertEquals(IamDecisionCode.CONSENT_VERSION_MISMATCH.name(), row.get("error_code"));

            AtomicBoolean replayedOperation = new AtomicBoolean(false);
            IamPolicyException replay = assertThrows(IamPolicyException.class, () -> idempotency.execute(
                    SCOPE, key, hash, TEXT,
                    () -> {
                        replayedOperation.set(true);
                        return new IdempotencyService.Execution<>(ResponseEntity.ok("unexpected"), null);
                    },
                    record -> ResponseEntity.status(409).body("replay")));
            assertEquals(IamDecisionCode.CONSENT_VERSION_MISMATCH, replay.code());
            assertFalse(replayedOperation.get(), "a rejected idempotency key must not re-run the operation");
        } finally {
            cleanup(principal, key);
        }
    }

    @Test
    void successfulConsentRecordAndIdempotencyCompletionCommitTogether() {
        PrincipalId principal = PrincipalId.random();
        ServerPrincipalContext context = ServerPrincipalContext.forPlatform(principal, Set.of("learner"));
        ConsentPolicyDescriptor descriptor = policy.descriptor(ConsentType.TERMS_OF_SERVICE);
        String key = "m2-002-commit-" + UUID.randomUUID();
        String hash = idempotency.fingerprint(SCOPE, principal.toString(), "expected-success");
        try {
            ResponseEntity<String> first = idempotency.execute(
                    SCOPE, key, hash, TEXT,
                    () -> {
                        consents.record(context, new ConsentCommand(ConsentType.TERMS_OF_SERVICE,
                                descriptor.documentVersion(), true, ClientAuthorityClaims.none(),
                                descriptor.documentDigest()));
                        return new IdempotencyService.Execution<>(ResponseEntity.ok("recorded"), "recorded");
                    },
                    record -> ResponseEntity.status(409).body("replay"));
            assertEquals(200, first.getStatusCode().value());

            Map<String, Object> row = jdbc.queryForMap(
                    "SELECT state, response_status FROM iam_idempotency_record "
                            + "WHERE scope_key = ? AND idempotency_key = ?",
                    SCOPE, key);
            assertEquals("COMPLETED", row.get("state"));
            assertEquals(200, ((Number) row.get("response_status")).intValue());
            Integer consentRows = jdbc.queryForObject(
                    "SELECT COUNT(*) FROM iam_consent WHERE principal_id = ? AND consent_type = ?",
                    Integer.class, principal.toString(), ConsentType.TERMS_OF_SERVICE.name());
            assertEquals(1, consentRows, "the consent fact must commit with its idempotency completion");

            AtomicBoolean replayedOperation = new AtomicBoolean(false);
            ResponseEntity<String> replay = idempotency.execute(
                    SCOPE, key, hash, TEXT,
                    () -> {
                        replayedOperation.set(true);
                        return new IdempotencyService.Execution<>(ResponseEntity.ok("unexpected"), null);
                    },
                    record -> ResponseEntity.status(409).body("replay"));
            assertEquals(200, replay.getStatusCode().value());
            assertFalse(replayedOperation.get(), "a completed idempotency key must restore its snapshot");
        } finally {
            cleanup(principal, key);
        }
    }

    private void cleanup(PrincipalId principal, String key) {
        jdbc.update("DELETE FROM iam_idempotency_record WHERE scope_key = ? AND idempotency_key = ?", SCOPE, key);
        jdbc.update("DELETE FROM iam_consent_current WHERE principal_id = ?", principal.toString());
        jdbc.update("DELETE FROM iam_consent_lock WHERE principal_id = ?", principal.toString());
        jdbc.update("DELETE FROM iam_consent WHERE principal_id = ?", principal.toString());
        jdbc.update("DELETE FROM iam_decision_audit WHERE principal_id = ?", principal.toString());
    }
}
