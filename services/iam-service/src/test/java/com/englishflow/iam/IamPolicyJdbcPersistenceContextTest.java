package com.englishflow.iam;

import com.englishflow.iam.config.IamServiceProperties;
import com.englishflow.iam.domain.AccountRecord;
import com.englishflow.iam.domain.AccountStore;
import com.englishflow.iam.domain.AccountStatus;
import com.englishflow.iam.domain.DeviceId;
import com.englishflow.iam.domain.IdempotencyService;
import com.englishflow.iam.domain.IdempotencyStore;
import com.englishflow.iam.domain.IamTransactionRunner;
import com.englishflow.iam.domain.IamDecisionCode;
import com.englishflow.iam.domain.IamPolicyException;
import com.englishflow.iam.domain.JdbcPolicyStore;
import com.englishflow.iam.domain.PolicyAccessAuthenticationVerifier;
import com.englishflow.iam.domain.PolicyActor;
import com.englishflow.iam.domain.PolicyBootstrapService;
import com.englishflow.iam.domain.PolicyControlService;
import com.englishflow.iam.domain.PolicyDocument;
import com.englishflow.iam.domain.PolicyLifecycleStatus;
import com.englishflow.iam.domain.PolicyMutation;
import com.englishflow.iam.domain.PolicyStore;
import com.englishflow.iam.domain.PrincipalId;
import com.englishflow.iam.domain.ServerPrincipalContext;
import com.englishflow.iam.domain.SessionRecord;
import com.englishflow.iam.domain.SessionService;
import com.englishflow.iam.domain.TenantScope;
import com.englishflow.iam.web.IamPolicyControlController;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.test.context.ActiveProfiles;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Opt-in local MySQL proof for M2-002. It is intentionally skipped from ordinary unit tests:
 * a local dependency being absent must never be reported as policy-runtime evidence.
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
class IamPolicyJdbcPersistenceContextTest {
    @Autowired private JdbcTemplate jdbc;
    @Autowired private AccountStore accounts;
    @Autowired private SessionService sessions;
    @Autowired private PolicyStore policies;
    @Autowired private PolicyControlService policyControl;
    @Autowired private PolicyAccessAuthenticationVerifier accessVerifier;
    @Autowired private IdempotencyStore idempotencyStore;
    @Autowired private IamTransactionRunner transactions;
    @Autowired private ObjectMapper iamObjectMapper;

    @Test
    void policyDraftAndExactMutationEnvelopeSurviveFreshStoreAndIdempotencyServiceInstances() {
        PrincipalId principal = PrincipalId.random();
        String identifier = "jdbc-policy-" + principal + "@example.com";
        String scope = "policy:create:" + principal;
        String key = "jdbc-policy-create-key-123456";
        UUID policyId = null;
        SessionRecord session = null;
        try {
            accounts.save(new AccountRecord(principal, identifier, "$2a$12$jdbcPolicyControlHash", Set.of("policy-operator"),
                    Set.of("iam.policy.draft.create"), AccountStatus.ACTIVE, 0, null, Instant.now(), Instant.now()));
            session = sessions.open(ServerPrincipalContext.forPlatform(principal, Set.of("policy-operator")),
                    new DeviceId(UUID.randomUUID().toString())).session();
            IamPolicyControlController firstController = new IamPolicyControlController(policyControl,
                    new IdempotencyService(idempotencyStore, iamObjectMapper, transactions,
                            "test-only-idempotency-replay-secret",
                            "test-only-idempotency-fingerprint-secret", java.time.Duration.ofHours(24)),
                    accessVerifier);
            IamPolicyControlController.PolicyCreateRequest request =
                    new IamPolicyControlController.PolicyCreateRequest(document(), "durable policy draft");
            JwtAuthenticationToken token = accessToken(principal, session, Set.of("iam.policy.draft.create"));
            var first = firstController.create(token, request, key);
            policyId = UUID.fromString(first.getBody().data().policy().policyVersionId());
            UUID persistedPolicyId = policyId;

            // New adapters model a process restart: no in-memory policy or replay result is reused.
            IamPolicyControlController restarted = new IamPolicyControlController(policyControl,
                    new IdempotencyService(idempotencyStore, iamObjectMapper, transactions,
                            "test-only-idempotency-replay-secret",
                            "test-only-idempotency-fingerprint-secret", java.time.Duration.ofHours(24)),
                    accessVerifier);
            var replay = restarted.create(token, request, key);
            assertEquals(first.getBody(), replay.getBody(), "same key must restore the exact encrypted envelope");

            JdbcPolicyStore restartedStore = new JdbcPolicyStore(jdbc, iamObjectMapper);
            assertEquals(PolicyLifecycleStatus.DRAFT, restartedStore.find(policyId).orElseThrow().status());
            PolicyActor author = new PolicyActor(principal, TenantScope.PLATFORM_TENANT,
                    PolicyBootstrapService.CONTROL_PERMISSIONS);
            PolicyMutation submitted = policyControl.submit(persistedPolicyId, 1, "submit", author, "jdbc-submit", "jdbc-trace");
            IamPolicyException selfApproval = assertThrows(IamPolicyException.class, () ->
                    policyControl.approve(persistedPolicyId, submitted.policy().revision(), "self approve", author,
                            "jdbc-self-approve", "jdbc-trace"));
            assertEquals(IamDecisionCode.POLICY_SEPARATION_OF_DUTIES, selfApproval.code());
            Integer deniedAuditCount = jdbc.queryForObject(
                    "SELECT COUNT(*) FROM iam_decision_audit WHERE principal_id = ? "
                            + "AND reason_code = 'policy_separation_of_duties' AND decision = 'DENY'",
                    Integer.class, principal.toString());
            assertTrue(deniedAuditCount != null && deniedAuditCount >= 1,
                    "separation-of-duties denial audit must commit even though approval is rejected");
            PolicyMutation approved = policyControl.approve(persistedPolicyId, 2, "independent approve",
                    new PolicyActor(PrincipalId.random(), TenantScope.PLATFORM_TENANT,
                            PolicyBootstrapService.CONTROL_PERMISSIONS), "jdbc-approve", "jdbc-trace");
            PolicyMutation active = policyControl.activate(persistedPolicyId, 3, "activate",
                    new PolicyActor(PrincipalId.random(), TenantScope.PLATFORM_TENANT,
                            PolicyBootstrapService.CONTROL_PERMISSIONS), "jdbc-activate", "jdbc-trace");
            assertEquals(persistedPolicyId, restartedStore.active(TenantScope.PLATFORM_TENANT).orElseThrow().policyVersionId());
            assertTrue(active.cacheInvalidation().denyUntilCurrentVersionProven());

            policyControl.revoke(persistedPolicyId, 4, "revoke after restart proof",
                    new PolicyActor(PrincipalId.random(), TenantScope.PLATFORM_TENANT,
                            PolicyBootstrapService.CONTROL_PERMISSIONS), "jdbc-revoke", "jdbc-trace");
            assertTrue(restartedStore.active(TenantScope.PLATFORM_TENANT).isEmpty());
        } finally {
            if (policyId != null) {
                jdbc.update("UPDATE iam_policy_active_slot SET policy_version_id = NULL WHERE tenant_id = ? AND policy_version_id = ?",
                        TenantScope.PLATFORM_TENANT, policyId.toString());
                jdbc.update("DELETE FROM iam_policy_control_audit WHERE policy_version_id = ?", policyId.toString());
                jdbc.update("DELETE FROM iam_policy_control_contributor WHERE policy_version_id = ?", policyId.toString());
                jdbc.update("DELETE FROM iam_policy_control_version WHERE policy_version_id = ?", policyId.toString());
            }
            jdbc.update("DELETE FROM iam_idempotency_record WHERE scope_key = ?", scope);
            jdbc.update("DELETE FROM iam_decision_audit WHERE principal_id = ?", principal.toString());
            if (session != null) {
                jdbc.update("DELETE FROM iam_refresh_token_history WHERE session_id = ?", session.sessionId().toString());
                jdbc.update("DELETE FROM iam_session WHERE session_id = ?", session.sessionId().toString());
            }
            jdbc.update("DELETE FROM iam_account WHERE principal_id = ?", principal.toString());
            jdbc.update("DELETE FROM iam_principal WHERE principal_id = ?", principal.toString());
        }
    }

    private static PolicyDocument document() {
        return new PolicyDocument("JDBC policy", null,
                List.of(new PolicyDocument.RoleBinding("learner", List.of("content.read"),
                        "SERVER_DERIVED_PLATFORM_TENANT")),
                List.of(new PolicyDocument.PolicyRule("ALLOW", List.of("content.read"), List.of("content.read"),
                        List.of("lesson"), new PolicyDocument.Conditions(List.of("P1"), true,
                        List.of("ACCOUNT_TERMS", "PRIVACY_NOTICE"), "REGISTERED", List.of("VALID"), false, true))));
    }

    private static JwtAuthenticationToken accessToken(PrincipalId principal, SessionRecord session, Set<String> permissions) {
        Jwt jwt = Jwt.withTokenValue("jdbc-policy-access-token")
                .header("alg", "RS256").claim("typ", "JWT").subject(principal.toString())
                .issuedAt(Instant.now()).expiresAt(Instant.now().plusSeconds(300)).claim("jti", UUID.randomUUID().toString())
                .claim("token_type", "access").claim("tenant_id", TenantScope.PLATFORM_TENANT)
                .claim("owner_id", principal.toString()).claim("session_id", session.sessionId().toString())
                .claim("permissions", permissions).claim("scope", String.join(" ", permissions)).build();
        List<SimpleGrantedAuthority> authorities = new ArrayList<>();
        authorities.add(new SimpleGrantedAuthority("TOKEN_TYPE_access"));
        permissions.forEach(permission -> authorities.add(new SimpleGrantedAuthority("PERM_" + permission)));
        return new JwtAuthenticationToken(jwt, authorities);
    }
}
