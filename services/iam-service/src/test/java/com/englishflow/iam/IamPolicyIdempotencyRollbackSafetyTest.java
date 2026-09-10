package com.englishflow.iam;

import com.englishflow.iam.domain.IamDecisionCode;
import com.englishflow.iam.domain.IamPolicyException;
import com.englishflow.iam.domain.IdempotencyService;
import com.englishflow.iam.domain.PolicyActor;
import com.englishflow.iam.domain.PolicyBootstrapService;
import com.englishflow.iam.domain.PolicyControlService;
import com.englishflow.iam.domain.PolicyDocument;
import com.englishflow.iam.domain.PolicyMutation;
import com.englishflow.iam.domain.PrincipalId;
import com.englishflow.iam.domain.TenantScope;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Opt-in MySQL proof that an expected policy lifecycle rejection inside the IAM idempotency
 * boundary commits its rejection and denial audit instead of poisoning the outer transaction.
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
class IamPolicyIdempotencyRollbackSafetyTest {

    @Autowired
    private JdbcTemplate jdbc;

    @Autowired
    private PolicyControlService policyControl;

    @Autowired
    private IdempotencyService idempotency;

    @Test
    void expectedLifecycleRejectionCommitsRejectionInsteadOfRollingBackTheBoundary() {
        PrincipalId principal = PrincipalId.random();
        PolicyActor actor = new PolicyActor(principal, TenantScope.PLATFORM_TENANT,
                PolicyBootstrapService.CONTROL_PERMISSIONS);
        UUID policyId = null;
        String scope = null;
        String key = null;
        try {
            PolicyMutation draft = policyControl.create(actor, document(), "draft", "m2-002-create", "m2-002-trace");
            policyId = draft.policy().policyVersionId();
            final String updateScope = "policy:update:" + policyId + ":" + principal;
            final String updateKey = "m2-002-policy-stale-" + UUID.randomUUID();
            scope = updateScope;
            key = updateKey;
            String hash = idempotency.fingerprint("policy-update", policyId.toString(), principal.toString(),
                    "stale-revision");
            UUID target = policyId;
            IamPolicyException failure = assertThrows(IamPolicyException.class, () -> idempotency.execute(
                    updateScope, updateKey, hash,
                    () -> {
                        policyControl.update(target, 99, document(), "stale revision", actor,
                                "m2-002-update", "m2-002-trace");
                        return new IdempotencyService.Execution<>(ResponseEntity.ok("unexpected"), null);
                    },
                    record -> ResponseEntity.status(409).body("replay")));
            assertEquals(IamDecisionCode.POLICY_REVISION_CONFLICT, failure.code());

            Map<String, Object> row = jdbc.queryForMap(
                    "SELECT state, response_status, error_code FROM iam_idempotency_record "
                            + "WHERE scope_key = ? AND idempotency_key = ?", updateScope, updateKey);
            assertEquals("REJECTED", row.get("state"));
            assertEquals(409, ((Number) row.get("response_status")).intValue());
            assertEquals(IamDecisionCode.POLICY_REVISION_CONFLICT.name(), row.get("error_code"));
            Integer revision = jdbc.queryForObject(
                    "SELECT revision FROM iam_policy_control_version WHERE policy_version_id = ?",
                    Integer.class, policyId.toString());
            assertEquals(1, revision, "the rejected update must not change the durable draft revision");
        } finally {
            cleanup(principal, scope, key, policyId);
        }
    }

    @Test
    void separationOfDutiesDenialAuditCommitsInsideTheIdempotencyBoundary() {
        PrincipalId principal = PrincipalId.random();
        PolicyActor author = new PolicyActor(principal, TenantScope.PLATFORM_TENANT,
                PolicyBootstrapService.CONTROL_PERMISSIONS);
        UUID policyId = null;
        String scope = null;
        String key = null;
        try {
            PolicyMutation draft = policyControl.create(author, document(), "draft", "m2-002-create",
                    "m2-002-trace");
            policyId = draft.policy().policyVersionId();
            PolicyMutation submitted = policyControl.submit(policyId, 1, "submit", author, "m2-002-submit",
                    "m2-002-trace");
            scope = "policy:approve:" + policyId + ":" + principal;
            key = "m2-002-policy-sod-" + UUID.randomUUID();
            final String approveScope = scope;
            final String approveKey = key;
            String hash = idempotency.fingerprint("policy-approve", policyId.toString(), principal.toString(),
                    "self-approval");
            UUID target = policyId;
            int revision = submitted.policy().revision();
            IamPolicyException failure = assertThrows(IamPolicyException.class, () -> idempotency.execute(
                    approveScope, approveKey, hash,
                    () -> {
                        policyControl.approve(target, revision, "self approval", author, "m2-002-approve",
                                "m2-002-trace");
                        return new IdempotencyService.Execution<>(ResponseEntity.ok("unexpected"), null);
                    },
                    record -> ResponseEntity.status(409).body("replay")));
            assertEquals(IamDecisionCode.POLICY_SEPARATION_OF_DUTIES, failure.code());

            Integer denied = jdbc.queryForObject(
                    "SELECT COUNT(*) FROM iam_decision_audit WHERE principal_id = ? "
                            + "AND reason_code = 'policy_separation_of_duties' AND decision = 'DENY'",
                    Integer.class, principal.toString());
            assertTrue(denied != null && denied >= 1,
                    "the denial audit must commit with the idempotency rejection");
            Map<String, Object> row = jdbc.queryForMap(
                    "SELECT state, response_status FROM iam_idempotency_record "
                            + "WHERE scope_key = ? AND idempotency_key = ?", approveScope, approveKey);
            assertEquals("REJECTED", row.get("state"));
            assertEquals(403, ((Number) row.get("response_status")).intValue());
            String status = jdbc.queryForObject(
                    "SELECT lifecycle_status FROM iam_policy_control_version WHERE policy_version_id = ?",
                    String.class, policyId.toString());
            assertEquals("SUBMITTED", status, "a denied approval must not advance the lifecycle");
        } finally {
            cleanup(principal, scope, key, policyId);
        }
    }

    private void cleanup(PrincipalId principal, String scope, String key, UUID policyId) {
        if (scope != null && key != null) {
            jdbc.update("DELETE FROM iam_idempotency_record WHERE scope_key = ? AND idempotency_key = ?",
                    scope, key);
        }
        if (policyId != null) {
            jdbc.update("UPDATE iam_policy_active_slot SET policy_version_id = NULL "
                            + "WHERE tenant_id = ? AND policy_version_id = ?",
                    TenantScope.PLATFORM_TENANT, policyId.toString());
            jdbc.update("DELETE FROM iam_policy_control_audit WHERE policy_version_id = ?", policyId.toString());
            jdbc.update("DELETE FROM iam_policy_control_contributor WHERE policy_version_id = ?",
                    policyId.toString());
            jdbc.update("DELETE FROM iam_policy_control_version WHERE policy_version_id = ?", policyId.toString());
        }
        jdbc.update("DELETE FROM iam_decision_audit WHERE principal_id = ?", principal.toString());
    }

    private static PolicyDocument document() {
        return new PolicyDocument("M2-002 policy", null,
                List.of(new PolicyDocument.RoleBinding("learner", List.of("content.read"),
                        "SERVER_DERIVED_PLATFORM_TENANT")),
                List.of(new PolicyDocument.PolicyRule("ALLOW", List.of("content.read"), List.of("content.read"),
                        List.of("lesson"), new PolicyDocument.Conditions(List.of("P1"), true,
                        List.of("ACCOUNT_TERMS", "PRIVACY_NOTICE"), "REGISTERED", List.of("VALID"), false, true))));
    }
}
