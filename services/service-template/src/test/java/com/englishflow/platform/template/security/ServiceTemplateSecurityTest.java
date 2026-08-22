package com.englishflow.platform.template.security;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Map;
import java.util.Set;

import org.junit.jupiter.api.Test;

class ServiceTemplateSecurityTest {

    private static final Instant NOW = Instant.parse("2026-01-01T00:00:00Z");
    private static final Clock CLOCK = Clock.fixed(NOW, ZoneOffset.UTC);
    private static final PolicyVersion POLICY = new PolicyVersion("b8-test-1", NOW.plusSeconds(60));

    @Test
    void localEvaluatorAllowsVerifiedFactsAndDerivesReplaySafeDecisionId() {
        LocalPolicyEvaluator evaluator = new LocalPolicyEvaluator(CLOCK);
        PolicySnapshot policy = PolicySnapshot.trusted(POLICY, Map.of("learner", Set.of("content:read")));
        AuthorizationContext context = context(ClientSecurityFacts.none());

        Decision first = evaluator.evaluate(context, policy);
        Decision second = evaluator.evaluate(context, policy);

        assertThat(first.allowed()).isTrue();
        assertThat(first.httpStatus()).isEqualTo(200);
        assertThat(first.decisionId()).isEqualTo(second.decisionId());
        assertThat(first.decisionId()).startsWith("dec_");
    }

    @Test
    void localEvaluatorDeniesTenantOwnerPhaseRightsConsentAndSpoofedFacts() {
        LocalPolicyEvaluator evaluator = new LocalPolicyEvaluator(CLOCK);
        PolicySnapshot policy = PolicySnapshot.trusted(POLICY, Map.of("learner", Set.of("content:read")));

        assertReason(evaluator.evaluate(copy("other", "usr_b8_001", "phase-1", Set.of("english.read"),
                ConsentState.GRANTED, ClientSecurityFacts.none()), policy), DecisionReason.TENANT_MISMATCH);
        assertReason(evaluator.evaluate(copy("platform", "usr_other", "phase-1", Set.of("english.read"),
                ConsentState.GRANTED, ClientSecurityFacts.none()), policy), DecisionReason.OWNER_MISMATCH);
        assertReason(evaluator.evaluate(copy("platform", "usr_b8_001", "phase-2", Set.of("english.read"),
                ConsentState.GRANTED, ClientSecurityFacts.none()), policy), DecisionReason.PHASE_MISMATCH);
        assertReason(evaluator.evaluate(copy("platform", "usr_b8_001", "phase-1", Set.of(),
                ConsentState.GRANTED, ClientSecurityFacts.none()), policy), DecisionReason.MISSING_CONTENT_RIGHTS);
        assertReason(evaluator.evaluate(copy("platform", "usr_b8_001", "phase-1", Set.of("english.read"),
                ConsentState.UNKNOWN, ClientSecurityFacts.none()), policy), DecisionReason.MISSING_CONSENT);
        assertReason(evaluator.evaluate(copy("platform", "usr_b8_001", "phase-1", Set.of("english.read"),
                ConsentState.GRANTED, new ClientSecurityFacts("admin", null, null, null)), policy),
                DecisionReason.UNTRUSTED_CLIENT_FACTS);
    }

    @Test
    void revocationAndPolicyFailuresFailClosed() {
        LocalPolicyEvaluator evaluator = new LocalPolicyEvaluator(CLOCK);
        VerifiedPrincipal revoked = principal("phase-1", Set.of("english.read"), ConsentState.GRANTED,
                RevocationStatus.UNKNOWN);
        AuthorizationContext context = new AuthorizationContext(revoked, "content:read", "content", "cnt_1",
                "platform", "usr_b8_001", "phase-1", Set.of("english.read"), ConsentState.GRANTED);
        assertReason(evaluator.evaluate(context, PolicySnapshot.trusted(POLICY,
                Map.of("learner", Set.of("content:read")))), DecisionReason.REVOCATION_UNKNOWN);

        PolicyVersion stale = new PolicyVersion("stale", NOW.minusSeconds(1));
        assertReason(evaluator.evaluate(context, PolicySnapshot.trusted(stale,
                Map.of("learner", Set.of("content:read")))), DecisionReason.REVOCATION_UNKNOWN);

        VerifiedPrincipal active = principal("phase-1", Set.of("english.read"), ConsentState.GRANTED,
                RevocationStatus.CONFIRMED_ACTIVE);
        AuthorizationContext activeContext = new AuthorizationContext(active, "content:read", "content", "cnt_1",
                "platform", "usr_b8_001", "phase-1", Set.of("english.read"), ConsentState.GRANTED);
        assertReason(evaluator.evaluate(activeContext, PolicySnapshot.trusted(stale,
                Map.of("learner", Set.of("content:read")))), DecisionReason.POLICY_STALE);
    }

    @Test
    void pepDeniesPdpTimeoutAndMissingPdp() {
        PolicyCache empty = new PolicyCache(CLOCK, Duration.ofSeconds(5));
        AuthorizationContext context = context(ClientSecurityFacts.none());
        PepGuard missing = new PepGuard(empty, new LocalPolicyEvaluator(CLOCK), null,
                Duration.ofMillis(20), CLOCK);
        assertReason(missing.authorize(context), DecisionReason.PDP_UNAVAILABLE);

        PepGuard timeout = new PepGuard(empty, new LocalPolicyEvaluator(CLOCK), (ignored, duration) -> {
            try {
                Thread.sleep(duration.toMillis() + 100);
            } catch (InterruptedException exception) {
                Thread.currentThread().interrupt();
            }
            return PdpDecision.unavailable();
        }, Duration.ofMillis(5), CLOCK);
        assertReason(timeout.authorize(context), DecisionReason.PDP_TIMEOUT);
    }

    private static AuthorizationContext context(ClientSecurityFacts facts) {
        return copy("platform", "usr_b8_001", "phase-1", Set.of("english.read"),
                ConsentState.GRANTED, facts);
    }

    private static AuthorizationContext copy(
            String tenant,
            String owner,
            String phase,
            Set<String> rights,
            ConsentState consent,
            ClientSecurityFacts facts) {
        return new AuthorizationContext(
                principal("phase-1", Set.of("english.read"), ConsentState.GRANTED,
                        RevocationStatus.CONFIRMED_ACTIVE),
                "content:read", "content", "cnt_1", tenant, owner, phase, rights, consent, facts, false);
    }

    private static VerifiedPrincipal principal(
            String phase,
            Set<String> rights,
            ConsentState consent,
            RevocationStatus revocationStatus) {
        VerifiedClaims claims = new VerifiedClaims(
                "usr_b8_001", "https://idp.example.test", NOW.minusSeconds(10), NOW.plusSeconds(300),
                "jti_b8_001", Set.of("learner"), Set.of(), phase, rights, consent, revocationStatus);
        return new VerifiedPrincipal("usr_b8_001",
                com.englishflow.platform.template.data.TenantScope.platform("usr_b8_001"), claims);
    }

    private static void assertReason(Decision decision, DecisionReason reason) {
        assertThat(decision.allowed()).isFalse();
        assertThat(decision.httpStatus()).isEqualTo(403);
        assertThat(decision.reason()).isEqualTo(reason);
    }
}
