package com.englishflow.iam;

import com.englishflow.iam.config.IamRuntimeConfiguration;
import com.englishflow.iam.config.IamServiceProperties;
import com.englishflow.iam.domain.AccountRecord;
import com.englishflow.iam.domain.AccountStatus;
import com.englishflow.iam.domain.AdultGateFactStore;
import com.englishflow.iam.domain.AuditDecision;
import com.englishflow.iam.domain.AuditFactPort;
import com.englishflow.iam.domain.ConsentRecord;
import com.englishflow.iam.domain.ConsentType;
import com.englishflow.iam.domain.ConsentVersion;
import com.englishflow.iam.domain.DeviceId;
import com.englishflow.iam.domain.FailClosedPolicyStore;
import com.englishflow.iam.domain.IamDecisionCode;
import com.englishflow.iam.domain.IamPolicyException;
import com.englishflow.iam.domain.IamTransactionRunner;
import com.englishflow.iam.domain.IdempotencyService;
import com.englishflow.iam.domain.InMemoryAccountStore;
import com.englishflow.iam.domain.InMemoryAdultGateFactStore;
import com.englishflow.iam.domain.InMemoryConsentStore;
import com.englishflow.iam.domain.InMemoryIdempotencyStore;
import com.englishflow.iam.domain.InMemoryPolicyStore;
import com.englishflow.iam.domain.InMemorySessionStore;
import com.englishflow.iam.domain.PdpAuthorizationRequest;
import com.englishflow.iam.domain.PdpDecision;
import com.englishflow.iam.domain.PdpDecisionService;
import com.englishflow.iam.domain.PolicyActor;
import com.englishflow.iam.domain.PolicyAccessAuthenticationVerifier;
import com.englishflow.iam.domain.PolicyBootstrapService;
import com.englishflow.iam.domain.PolicyCacheInvalidationReceipt;
import com.englishflow.iam.domain.PolicyControlService;
import com.englishflow.iam.domain.PolicyDocument;
import com.englishflow.iam.domain.PolicyLifecycleStatus;
import com.englishflow.iam.domain.PolicyMutation;
import com.englishflow.iam.domain.PolicyVersionRecord;
import com.englishflow.iam.domain.PrincipalId;
import com.englishflow.iam.domain.ServerPrincipalContext;
import com.englishflow.iam.domain.SessionService;
import com.englishflow.iam.domain.SessionRecord;
import com.englishflow.iam.domain.TenantScope;
import com.englishflow.iam.domain.VerifiedServiceIdentity;
import com.englishflow.iam.web.IamPolicyControlController;
import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * M2-002 in-process policy/PDP proof. Integration persistence is covered separately by the
 * opt-in JDBC context test, so this class never treats an in-memory adapter as runtime evidence.
 */
class IamPolicyControlServiceTest {
    private static final Instant NOW = Instant.parse("2026-09-01T00:00:00Z");
    private static final Clock CLOCK = Clock.fixed(NOW, ZoneOffset.UTC);

    @Test
    void lifecycleUsesRevisionCasIndependentApprovalAndFailClosedInvalidationReceipts() {
        ControlFixture fixture = new ControlFixture();
        PolicyActor author = fixture.operator();
        PolicyActor contributor = fixture.operator();
        PolicyActor approver = fixture.operator();

        PolicyMutation created = fixture.policies.create(author, learningDocument(), "create policy", "req-1", "trace-1");
        assertEquals(PolicyLifecycleStatus.DRAFT, created.policy().status());
        assertEquals(1, created.policy().revision());
        assertFalse(created.cacheInvalidation().required());
        assertTrue(created.cacheInvalidation().denyUntilCurrentVersionProven());

        PolicyMutation updated = fixture.policies.update(created.policy().policyVersionId(), 1, learningDocument(),
                "reviewed draft", contributor, "req-2", "trace-2");
        assertEquals(2, updated.policy().revision());
        assertTrue(updated.policy().contributors().contains(contributor.principalId()));
        IamPolicyException stale = assertThrows(IamPolicyException.class, () -> fixture.policies.submit(
                created.policy().policyVersionId(), 1, "stale revision", author, "req-stale", "trace-stale"));
        assertEquals(IamDecisionCode.POLICY_REVISION_CONFLICT, stale.code());

        PolicyMutation submitted = fixture.policies.submit(updated.policy().policyVersionId(), 2,
                "submit for independent review", author, "req-3", "trace-3");
        assertEquals(PolicyLifecycleStatus.SUBMITTED, submitted.policy().status());
        IamPolicyException selfApproval = assertThrows(IamPolicyException.class, () -> fixture.policies.approve(
                submitted.policy().policyVersionId(), 3, "self approve", author, "req-4", "trace-4"));
        assertEquals(IamDecisionCode.POLICY_SEPARATION_OF_DUTIES, selfApproval.code());
        IamPolicyException contributorApproval = assertThrows(IamPolicyException.class, () -> fixture.policies.approve(
                submitted.policy().policyVersionId(), 3, "contributor approve", contributor, "req-5", "trace-5"));
        assertEquals(IamDecisionCode.POLICY_SEPARATION_OF_DUTIES, contributorApproval.code());

        PolicyMutation approved = fixture.policies.approve(submitted.policy().policyVersionId(), 3,
                "independent approval", approver, "req-6", "trace-6");
        assertEquals(PolicyLifecycleStatus.APPROVED, approved.policy().status());
        assertEquals(approver.principalId(), approved.policy().approvedBy());
        PolicyMutation activated = fixture.policies.activate(approved.policy().policyVersionId(), 4,
                "activate approved policy", fixture.operator(), "req-7", "trace-7");
        assertEquals(PolicyLifecycleStatus.ACTIVE, activated.policy().status());
        assertTrue(activated.cacheInvalidation().required());
        assertEquals("PENDING", activated.cacheInvalidation().status());
        assertTrue(activated.cacheInvalidation().denyUntilCurrentVersionProven());
        assertEquals(activated.policy().policyVersionId(), fixture.policies.activeBundle().policy().policyVersionId());

        PolicyMutation revoked = fixture.policies.revoke(activated.policy().policyVersionId(), 5,
                "emergency revoke", fixture.operator(), "req-8", "trace-8");
        assertEquals(PolicyLifecycleStatus.REVOKED, revoked.policy().status());
        assertEquals("REVOCATION_AND_AFFECTED_PEP_SECURITY_CACHES", revoked.cacheInvalidation().scope());
        assertThrows(IamPolicyException.class, fixture.policies::activeBundle);
        assertTrue(fixture.audit.codes().contains(IamDecisionCode.POLICY_SEPARATION_OF_DUTIES));
    }

    @Test
    void onlyExplicitLocalBootstrapCanGrantControlPermissionsToAnExistingAccount() {
        ControlFixture fixture = new ControlFixture();
        PrincipalId ordinaryId = PrincipalId.random();
        AccountRecord ordinary = account(ordinaryId, "ordinary-policy@example.com", Set.of("learner"), Set.of());
        fixture.accounts.save(ordinary);
        PolicyActor beforeBootstrap = new PolicyActor(ordinaryId, TenantScope.PLATFORM_TENANT, Set.of());
        IamPolicyException denied = assertThrows(IamPolicyException.class,
                () -> fixture.policies.create(beforeBootstrap, learningDocument(), "not permitted", "req", "trace"));
        assertEquals(IamDecisionCode.POLICY_PERMISSION_DENIED, denied.code());

        PolicyBootstrapService bootstrap = new PolicyBootstrapService(fixture.accounts, fixture.audit, CLOCK);
        AccountRecord promoted = bootstrap.grantToExistingAccount(ordinary.identifier());
        assertTrue(promoted.permissions().containsAll(PolicyBootstrapService.CONTROL_PERMISSIONS));
        PolicyActor explicitlyPromoted = new PolicyActor(promoted.principalId(), TenantScope.PLATFORM_TENANT,
                promoted.permissions());
        assertEquals(PolicyLifecycleStatus.DRAFT, fixture.policies.create(explicitlyPromoted, learningDocument(),
                "local bootstrap use", "req-promoted", "trace-promoted").policy().status());
        assertThrows(IllegalStateException.class, () -> bootstrap.grantToExistingAccount("missing@example.com"));

        PrincipalId auditFailureId = PrincipalId.random();
        AccountRecord auditFailureAccount = account(auditFailureId, "audit-failure-policy@example.com", Set.of("learner"), Set.of());
        fixture.accounts.save(auditFailureAccount);
        PolicyBootstrapService failingAuditBootstrap = new PolicyBootstrapService(fixture.accounts,
                decision -> { throw new IllegalStateException("audit unavailable"); }, CLOCK, IamTransactionRunner.direct());
        IamPolicyException auditFailure = assertThrows(IamPolicyException.class,
                () -> failingAuditBootstrap.grantToExistingAccount(auditFailureAccount.identifier()));
        assertEquals(IamDecisionCode.AUDIT_UNAVAILABLE, auditFailure.code());
        assertEquals(Set.of(), fixture.accounts.findByPrincipalId(auditFailureId).orElseThrow().permissions(),
                "an audit failure must not leave control permissions granted");
    }

    @Test
    void publicMutationPathReplaysExactlyAndRejectsAServiceProfile() {
        ControlFixture fixture = new ControlFixture();
        PrincipalId actorId = PrincipalId.random();
        InMemoryIdempotencyStore idempotencyStore = new InMemoryIdempotencyStore();
        IdempotencyService idempotency = new IdempotencyService(idempotencyStore,
                new IamRuntimeConfiguration().iamObjectMapper(), IamTransactionRunner.direct(),
                "policy-control-test-replay-secret-2026");
        IamPolicyControlController controller = new IamPolicyControlController(fixture.policies, idempotency,
                fixture.accessVerifier);
        JwtAuthenticationToken access = fixture.provisionAccess(actorId, Set.of("iam.policy.draft.create"));
        IamPolicyControlController.PolicyCreateRequest body =
                new IamPolicyControlController.PolicyCreateRequest(learningDocument(), "create exactly once");

        ResponseEntity<IamPolicyControlController.SuccessEnvelope<IamPolicyControlController.PolicyMutationResponse>> first =
                controller.create(access, body, "policy-create-idempotency-key");
        IdempotencyService restarted = new IdempotencyService(idempotencyStore,
                new IamRuntimeConfiguration().iamObjectMapper(), IamTransactionRunner.direct(),
                "policy-control-test-replay-secret-2026");
        IamPolicyControlController restartedController = new IamPolicyControlController(fixture.policies, restarted,
                fixture.accessVerifier);
        ResponseEntity<IamPolicyControlController.SuccessEnvelope<IamPolicyControlController.PolicyMutationResponse>> replay =
                restartedController.create(access, body, "policy-create-idempotency-key");
        assertEquals(201, first.getStatusCode().value());
        assertEquals(first.getBody(), replay.getBody());
        assertEquals(1, fixture.store.list(TenantScope.PLATFORM_TENANT).size());

        JwtAuthenticationToken service = token("service", "content-service", Set.of(), List.of("SERVICE_content-service"));
        IamPolicyException rejected = assertThrows(IamPolicyException.class, () -> controller.create(service, body,
                "must-not-use-service-profile"));
        assertEquals(IamDecisionCode.JWT_TOKEN_TYPE_INVALID, rejected.code());
    }

    @Test
    void policyAccessVerifierRejectsRevokedSessionAndPermissionsRemovedAfterTokenIssue() {
        ControlFixture fixture = new ControlFixture();
        PrincipalId actorId = PrincipalId.random();
        Set<String> permissions = Set.of("iam.policy.draft.create");
        JwtAuthenticationToken token = fixture.provisionAccess(actorId, permissions);
        assertEquals(actorId, fixture.accessVerifier.verify(token).principalId());

        AccountRecord current = fixture.accounts.findByPrincipalId(actorId).orElseThrow();
        fixture.accounts.replace(current.withPermissions(Set.of()));
        IamPolicyException stalePermissions = assertThrows(IamPolicyException.class,
                () -> fixture.accessVerifier.verify(token));
        assertEquals(IamDecisionCode.POLICY_PERMISSION_DENIED, stalePermissions.code());

        fixture.accounts.replace(current);
        SessionRecord session = fixture.sessions.findByPrincipal(actorId).getFirst();
        fixture.sessions.revoke(session.sessionId(), "test policy revocation");
        IamPolicyException revoked = assertThrows(IamPolicyException.class, () -> fixture.accessVerifier.verify(token));
        assertEquals(IamDecisionCode.SESSION_REVOKED, revoked.code());
    }

    @Test
    void pdpBindsServiceAndServerFactsAndRejectsForgedPrincipalTenantAdultAndConsent() {
        PdpFixture fixture = new PdpFixture(learningDocument());
        PdpAuthorizationRequest allowedRequest = fixture.request(fixture.requiredConsent());
        PdpDecision allowed = fixture.pdp.decide(allowedRequest, fixture.caller(), "pdp-1", "trace-1");
        assertTrue(allowed.allowed());
        assertEquals("ALLOWED", allowed.reasonCode());

        PdpAuthorizationRequest wrongService = withService(allowedRequest,
                new PdpAuthorizationRequest.ServiceIdentityContext("assessment-service",
                        "VALIDATED_SERVICE_JWT_BOUND_TO_PEP", "yuxuexing-api", NOW));
        assertEquals("INVALID_SERVICE_IDENTITY", fixture.pdp.decide(wrongService, fixture.caller(), "pdp-2", "trace-2").reasonCode());

        PdpAuthorizationRequest forgedRoles = withPrincipal(allowedRequest, new PdpAuthorizationRequest.PrincipalContext(
                allowedRequest.principal().subject(), allowedRequest.principal().tenant(), List.of("forged-admin"),
                allowedRequest.principal().permissions(), allowedRequest.principal().phase(),
                allowedRequest.principal().adultGate(), allowedRequest.principal().consent(),
                allowedRequest.principal().deviceTrust(), allowedRequest.principal().authorityProvenance()));
        assertEquals("CONTEXT_MISSING", fixture.pdp.decide(forgedRoles, fixture.caller(), "pdp-3", "trace-3").reasonCode());

        PdpAuthorizationRequest forgedTenant = withPrincipal(allowedRequest, new PdpAuthorizationRequest.PrincipalContext(
                allowedRequest.principal().subject(), new PdpAuthorizationRequest.Tenant("other", "IAM_PLATFORM_TENANT", NOW),
                allowedRequest.principal().roles(), allowedRequest.principal().permissions(), allowedRequest.principal().phase(),
                allowedRequest.principal().adultGate(), allowedRequest.principal().consent(),
                allowedRequest.principal().deviceTrust(), allowedRequest.principal().authorityProvenance()));
        assertEquals("CONTEXT_MISSING", fixture.pdp.decide(forgedTenant, fixture.caller(), "pdp-4", "trace-4").reasonCode());

        PdpAuthorizationRequest forgedAdult = withPrincipal(allowedRequest, new PdpAuthorizationRequest.PrincipalContext(
                allowedRequest.principal().subject(), allowedRequest.principal().tenant(), allowedRequest.principal().roles(),
                allowedRequest.principal().permissions(), allowedRequest.principal().phase(),
                new PdpAuthorizationRequest.AdultGate("PASSED", "ELIGIBLE", NOW, "forged-adult-policy", NOW, 18,
                        hex('b'), "SERVER_VERIFIED", allowedRequest.principal().adultGate().evaluationProvenance(),
                        allowedRequest.principal().adultGate().revalidation()), allowedRequest.principal().consent(),
                allowedRequest.principal().deviceTrust(), allowedRequest.principal().authorityProvenance()));
        assertEquals("ADULT_GATE_REQUIRED", fixture.pdp.decide(forgedAdult, fixture.caller(), "pdp-5", "trace-5").reasonCode());

        PdpAuthorizationRequest forgedConsent = withPrincipal(allowedRequest, new PdpAuthorizationRequest.PrincipalContext(
                allowedRequest.principal().subject(), allowedRequest.principal().tenant(), allowedRequest.principal().roles(),
                allowedRequest.principal().permissions(), allowedRequest.principal().phase(), allowedRequest.principal().adultGate(),
                new PdpAuthorizationRequest.Consent(true, false, "b30-consent-v1", "ELIGIBLE",
                        List.of("ACCOUNT_TERMS", "PRIVACY_NOTICE"), List.of(), NOW, "b30-consent-v1",
                        allowedRequest.principal().consent().revalidation(), allowedRequest.principal().consent().provenance()),
                allowedRequest.principal().deviceTrust(), allowedRequest.principal().authorityProvenance()));
        assertEquals("CONSENT_REQUIRED", fixture.pdp.decide(forgedConsent, fixture.caller(), "pdp-6", "trace-6").reasonCode());

        PdpAuthorizationRequest expired = withPolicy(allowedRequest, new PdpAuthorizationRequest.PolicyContext(
                allowedRequest.policy().policy(), allowedRequest.policy().bundleVersion(), "EXPIRED", "CONFIRMED_NOT_REVOKED"));
        assertEquals("POLICY_VERSION_EXPIRED", fixture.pdp.decide(expired, fixture.caller(), "pdp-7", "trace-7").reasonCode());
    }

    @Test
    void pdpDenyOverridesAreOrderIndependentAndOptionalConsentDoesNotBlockBaseRule() {
        PdpFixture fixture = new PdpFixture(documentWithRules(List.of(
                rule("ALLOW", List.of()), rule("DENY", List.of()))));
        PdpDecision firstOrder = fixture.pdp.decide(fixture.request(fixture.optionalConsent()), fixture.caller(), "pdp-a", "trace-a");
        assertEquals("DENY", firstOrder.decision());
        assertEquals("POLICY_DENIED", firstOrder.reasonCode());

        fixture.activate(documentWithRules(List.of(rule("DENY", List.of()), rule("ALLOW", List.of()))));
        PdpDecision reverseOrder = fixture.pdp.decide(fixture.request(fixture.optionalConsent()), fixture.caller(), "pdp-b", "trace-b");
        assertEquals("DENY", reverseOrder.decision());
        assertEquals(firstOrder.reasonCode(), reverseOrder.reasonCode());

        fixture.activate(documentWithRules(List.of(rule("ALLOW", List.of()))));
        PdpDecision noOptionalBlock = fixture.pdp.decide(fixture.request(fixture.optionalConsent()), fixture.caller(), "pdp-c", "trace-c");
        assertTrue(noOptionalBlock.allowed(), "analytics/voice consent must not block a rule that does not request it");

        fixture.activate(documentWithRules(List.of(rule("ALLOW",
                List.of("ADULT_VOICE_RECORDING_REMOTE_STORAGE_AND_REPLAY")))));
        PdpDecision voiceWithoutDurableConsent = fixture.pdp.decide(
                fixture.request(fixture.consentFor(List.of("ADULT_VOICE_RECORDING_REMOTE_STORAGE_AND_REPLAY"))),
                fixture.caller(), "pdp-d", "trace-d");
        assertEquals("CONSENT_REQUIRED", voiceWithoutDurableConsent.reasonCode());
    }

    @Test
    void persistenceEnabledFallbackStoreNeverCreatesOrReadsPolicyFacts() {
        FailClosedPolicyStore store = new FailClosedPolicyStore();
        IamPolicyException failure = assertThrows(IamPolicyException.class,
                () -> store.find(UUID.randomUUID()));
        assertEquals(IamDecisionCode.IAM_PERSISTENCE_UNAVAILABLE, failure.code());
    }

    @Test
    void revokedPolicySnapshotWithoutOriginalActivationFactIsRejectedBeforeStoreMapping() {
        PrincipalId author = PrincipalId.random();
        assertThrows(IllegalArgumentException.class, () -> new PolicyVersionRecord(UUID.randomUUID(), "p1-corrupt",
                PolicyLifecycleStatus.REVOKED, 6, TenantScope.PLATFORM_TENANT, learningDocument(), hex('d'), NOW, NOW,
                author, Set.of(), author, PrincipalId.random(), PrincipalId.random(), PrincipalId.random(), null, NOW,
                PolicyCacheInvalidationReceipt.pendingRevocation(NOW)));
    }

    private static PolicyDocument learningDocument() {
        return documentWithRules(List.of(rule("ALLOW", List.of("ACCOUNT_TERMS", "PRIVACY_NOTICE"))));
    }

    private static PolicyDocument documentWithRules(List<PolicyDocument.PolicyRule> rules) {
        return new PolicyDocument("P1 learning access", "Declarative P1 policy only",
                List.of(new PolicyDocument.RoleBinding("learner", List.of("content.read"),
                        "SERVER_DERIVED_PLATFORM_TENANT")), rules);
    }

    private static PolicyDocument.PolicyRule rule(String effect, List<String> consentPurposes) {
        return new PolicyDocument.PolicyRule(effect, List.of("content.read"), List.of("content.read"), List.of("lesson"),
                new PolicyDocument.Conditions(List.of("P1"), true, consentPurposes, "REGISTERED",
                        List.of("VALID"), false, true));
    }

    private static AccountRecord account(PrincipalId id, String identifier, Set<String> roles, Set<String> permissions) {
        return new AccountRecord(id, identifier, "$2a$12$policyControlTestHashValue", roles, permissions,
                AccountStatus.ACTIVE, 0, null, NOW, NOW);
    }

    private static JwtAuthenticationToken token(String type, String subject, Set<String> permissions, List<String> authorities) {
        Jwt jwt = Jwt.withTokenValue("verified-test-jwt-" + UUID.randomUUID())
                .header("alg", "RS256").claim("typ", "JWT").subject(subject).issuedAt(NOW)
                .expiresAt(NOW.plusSeconds(300)).claim("jti", UUID.randomUUID().toString())
                .claim("token_type", type).claim("tenant_id", TenantScope.PLATFORM_TENANT)
                .claim("permissions", permissions).build();
        return new JwtAuthenticationToken(jwt, authorities.stream().map(SimpleGrantedAuthority::new).toList());
    }

    private static PdpAuthorizationRequest withPrincipal(PdpAuthorizationRequest source,
                                                          PdpAuthorizationRequest.PrincipalContext principal) {
        return new PdpAuthorizationRequest(source.invocationReason(), source.action(), principal, source.resource(),
                source.policy(), source.serviceIdentity());
    }

    private static PdpAuthorizationRequest withService(PdpAuthorizationRequest source,
                                                        PdpAuthorizationRequest.ServiceIdentityContext service) {
        return new PdpAuthorizationRequest(source.invocationReason(), source.action(), source.principal(), source.resource(),
                source.policy(), service);
    }

    private static PdpAuthorizationRequest withPolicy(PdpAuthorizationRequest source,
                                                       PdpAuthorizationRequest.PolicyContext policy) {
        return new PdpAuthorizationRequest(source.invocationReason(), source.action(), source.principal(), source.resource(),
                policy, source.serviceIdentity());
    }

    private static String hex(char digit) { return String.valueOf(digit).repeat(64); }

    private static final class ControlFixture {
        private final RecordingAudit audit = new RecordingAudit();
        private final InMemoryAccountStore accounts = new InMemoryAccountStore();
        private final InMemoryPolicyStore store = new InMemoryPolicyStore();
        private final SessionService sessions = new SessionService(new InMemorySessionStore(), audit, CLOCK, properties());
        private final PolicyAccessAuthenticationVerifier accessVerifier = new PolicyAccessAuthenticationVerifier(accounts, sessions, CLOCK);
        private final PolicyControlService policies = new PolicyControlService(store, audit, IamTransactionRunner.direct(),
                new IamRuntimeConfiguration().iamObjectMapper(), CLOCK);

        private PolicyActor operator() {
            return new PolicyActor(PrincipalId.random(), TenantScope.PLATFORM_TENANT,
                    PolicyBootstrapService.CONTROL_PERMISSIONS);
        }

        private JwtAuthenticationToken provisionAccess(PrincipalId principal, Set<String> permissions) {
            accounts.save(account(principal, "policy-access-" + principal + "@example.com", Set.of("policy-operator"), permissions));
            SessionRecord session = sessions.open(ServerPrincipalContext.forPlatform(principal, Set.of("policy-operator")),
                    new DeviceId("policy-access-" + UUID.randomUUID())).session();
            Jwt jwt = Jwt.withTokenValue("verified-policy-access-" + UUID.randomUUID())
                    .header("alg", "RS256").claim("typ", "JWT").subject(principal.toString()).issuedAt(NOW)
                    .expiresAt(NOW.plusSeconds(300)).claim("jti", UUID.randomUUID().toString())
                    .claim("token_type", "access").claim("tenant_id", TenantScope.PLATFORM_TENANT)
                    .claim("owner_id", principal.toString()).claim("session_id", session.sessionId().toString())
                    .claim("permissions", permissions).claim("scope", String.join(" ", permissions)).build();
            List<SimpleGrantedAuthority> authorities = new ArrayList<>();
            authorities.add(new SimpleGrantedAuthority("TOKEN_TYPE_access"));
            permissions.forEach(permission -> authorities.add(new SimpleGrantedAuthority("PERM_" + permission)));
            return new JwtAuthenticationToken(jwt, authorities);
        }
    }

    private static final class PdpFixture {
        private final RecordingAudit audit = new RecordingAudit();
        private final InMemoryAccountStore accounts = new InMemoryAccountStore();
        private final InMemoryAdultGateFactStore adults = new InMemoryAdultGateFactStore();
        private final InMemoryConsentStore consents = new InMemoryConsentStore();
        private final SessionService sessions = new SessionService(new InMemorySessionStore(), audit, CLOCK, properties());
        private final PolicyControlService policies = new PolicyControlService(new InMemoryPolicyStore(), audit,
                IamTransactionRunner.direct(), new IamRuntimeConfiguration().iamObjectMapper(), CLOCK);
        private final PdpDecisionService pdp = new PdpDecisionService(policies, accounts, sessions, adults, consents, audit, CLOCK);
        private final PrincipalId learner = PrincipalId.random();
        private final DeviceId device = new DeviceId("pdp-device-" + UUID.randomUUID());
        private PolicyVersionRecord active;

        private PdpFixture(PolicyDocument initialDocument) {
            accounts.save(account(learner, "pdp-learner-" + learner + "@example.com", Set.of("learner"),
                    Set.of("content.read")));
            adults.approve(learner, "b30-adult-v1", NOW);
            sessions.open(ServerPrincipalContext.forPlatform(learner, Set.of("learner")), device);
            consent(ConsentType.TERMS_OF_SERVICE);
            consent(ConsentType.PRIVACY_NOTICE);
            activate(initialDocument);
        }

        private void consent(ConsentType type) {
            consents.append(new ConsentRecord(learner, TenantScope.derive(learner), type,
                    new ConsentVersion("b30-consent-v1"), true, NOW));
        }

        private void activate(PolicyDocument document) {
            PolicyActor author = operator();
            PolicyMutation created = policies.create(author, document, "create", "policy-create", "trace-create");
            PolicyMutation submitted = policies.submit(created.policy().policyVersionId(), 1, "submit", author,
                    "policy-submit", "trace-submit");
            PolicyMutation approved = policies.approve(submitted.policy().policyVersionId(), 2, "approve", operator(),
                    "policy-approve", "trace-approve");
            active = policies.activate(approved.policy().policyVersionId(), 3, "activate", operator(),
                    "policy-activate", "trace-activate").policy();
        }

        private PolicyActor operator() {
            return new PolicyActor(PrincipalId.random(), TenantScope.PLATFORM_TENANT,
                    PolicyBootstrapService.CONTROL_PERMISSIONS);
        }

        private VerifiedServiceIdentity caller() {
            return new VerifiedServiceIdentity("content-service", Set.of("yuxuexing-api"), NOW);
        }

        private PdpAuthorizationRequest request(PdpAuthorizationRequest.Consent consent) {
            PdpAuthorizationRequest.PrincipalContext principal = new PdpAuthorizationRequest.PrincipalContext(
                    new PdpAuthorizationRequest.Subject(learner.toString(), "IAM_VALIDATED_JWT_AND_SESSION", NOW),
                    new PdpAuthorizationRequest.Tenant(TenantScope.PLATFORM_TENANT, "IAM_PLATFORM_TENANT", NOW),
                    List.of("learner"), List.of("content.read"),
                    new PdpAuthorizationRequest.Phase("P1", "ELIGIBLE", "IAM_SERVER_DERIVED_PHASE_GATE"),
                    adult(), consent,
                    new PdpAuthorizationRequest.DeviceTrust(device.value(), "REGISTERED", "ACTIVE",
                            "IAM_SERVER_OWNED_DEVICE_AND_SESSION", NOW),
                    new PdpAuthorizationRequest.AuthorityProvenance("IAM_SERVER_DERIVED", NOW,
                            "VALIDATED_IAM_RS256_JWT", "IAM_SERVER_DERIVED_TENANT",
                            "IAM_ROLE_PERMISSION_ASSIGNMENTS", "IAM_ACTIVE_VERSIONED_POLICY", "CONFIRMED_NOT_REVOKED"));
            PdpAuthorizationRequest.ResourceContext resource = new PdpAuthorizationRequest.ResourceContext("lesson", "lesson-1",
                    new PdpAuthorizationRequest.Owner("content-1", "RESOURCE_OWNER_SERVICE"),
                    new PdpAuthorizationRequest.Tenant(TenantScope.PLATFORM_TENANT, "IAM_PLATFORM_TENANT", NOW),
                    "P1", "VALID", new PdpAuthorizationRequest.ResourceProvenance("content-service", NOW, hex('a')));
            PdpAuthorizationRequest.PolicyContext policy = new PdpAuthorizationRequest.PolicyContext(
                    new PdpAuthorizationRequest.PolicyVersion(active.policyVersionId().toString(), active.version(), "ACTIVE",
                            active.activatedAt(), "NOT_REVOKED", "IAM_ACTIVE_POLICY_CONTROL_PLANE"), active.version(), "CURRENT",
                    "CONFIRMED_NOT_REVOKED");
            return new PdpAuthorizationRequest("HIGH_RISK_OPERATION", "content.read", principal, resource, policy,
                    new PdpAuthorizationRequest.ServiceIdentityContext("content-service",
                            "VALIDATED_SERVICE_JWT_BOUND_TO_PEP", "yuxuexing-api", NOW));
        }

        private PdpAuthorizationRequest.AdultGate adult() {
            return new PdpAuthorizationRequest.AdultGate("PASSED", "ELIGIBLE", NOW, "b30-adult-v1", NOW, 18,
                    hex('c'), "SERVER_VERIFIED", new PdpAuthorizationRequest.AdultProvenance("IAM_SERVER_DERIVED",
                    "iam-service", "SERVER_RECOGNIZED_EVIDENCE", NOW, false),
                    new PdpAuthorizationRequest.Revalidation("CURRENT", false, NOW, null, List.of()));
        }

        private PdpAuthorizationRequest.Consent requiredConsent() {
            return consentFor(List.of("ACCOUNT_TERMS", "PRIVACY_NOTICE"));
        }

        private PdpAuthorizationRequest.Consent consentFor(List<String> purposes) {
            return new PdpAuthorizationRequest.Consent(true, true, "b30-consent-v1", "ELIGIBLE", purposes, List.of(), NOW,
                    "b30-consent-v1", new PdpAuthorizationRequest.Revalidation("CURRENT", false, NOW, null, List.of()),
                    new PdpAuthorizationRequest.ConsentProvenance("IAM_SERVER_RECORDED_CONSENT", NOW,
                            "PUBLISHED_DOCUMENT_VERSION_AND_DIGEST", "IAM_ACTIVE_POLICY_CONTROL_PLANE"));
        }

        private PdpAuthorizationRequest.Consent optionalConsent() {
            return new PdpAuthorizationRequest.Consent(false, false, "b30-consent-v1", "ELIGIBLE", List.of(), List.of(), NOW,
                    "b30-consent-v1", new PdpAuthorizationRequest.Revalidation("CURRENT", false, NOW, null, List.of()),
                    new PdpAuthorizationRequest.ConsentProvenance("IAM_SERVER_RECORDED_CONSENT", NOW,
                            "PUBLISHED_DOCUMENT_VERSION_AND_DIGEST", "IAM_ACTIVE_POLICY_CONTROL_PLANE"));
        }
    }

    private static IamServiceProperties properties() {
        IamServiceProperties properties = new IamServiceProperties();
        properties.getIdempotency().setReplaySecret("policy-control-test-replay-secret-2026");
        return properties;
    }

    private static final class RecordingAudit implements AuditFactPort {
        private final List<AuditDecision> decisions = new ArrayList<>();
        @Override public void append(AuditDecision decision) { decisions.add(decision); }
        private Set<IamDecisionCode> codes() { return decisions.stream().map(AuditDecision::code).collect(java.util.stream.Collectors.toSet()); }
    }
}
