package com.englishflow.iam.web;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.Set;

import com.englishflow.iam.domain.AccountRecord;
import com.englishflow.iam.domain.AccountStatus;
import com.englishflow.iam.domain.ClientAuthorityClaims;
import com.englishflow.iam.domain.ConsentCommand;
import com.englishflow.iam.domain.ConsentHistoryEntry;
import com.englishflow.iam.domain.ConsentPolicyDescriptor;
import com.englishflow.iam.domain.ConsentRecord;
import com.englishflow.iam.domain.ConsentService;
import com.englishflow.iam.domain.ConsentType;
import com.englishflow.iam.domain.InMemoryAccountStore;
import com.englishflow.iam.domain.InMemoryConsentStore;
import com.englishflow.iam.domain.InMemorySessionStore;
import com.englishflow.iam.domain.IamTransactionRunner;
import com.englishflow.iam.domain.PrincipalId;
import com.englishflow.iam.domain.ServerPrincipalContext;
import com.englishflow.iam.domain.SessionService;
import com.englishflow.iam.domain.SessionStatus;
import com.englishflow.iam.domain.StaticConsentPolicy;
import com.englishflow.iam.config.IamServiceProperties;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.server.ResponseStatusException;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class IamLearningConsentControllerTest {

    private static final Instant NOW = Instant.parse("2026-10-09T00:00:00Z");
    private static final Clock CLOCK = Clock.fixed(NOW, ZoneOffset.UTC);

    @Test
    void snapshotUsesStoreFactNotCallerClaims() {
        Map<String, Object> granted = IamLearningConsentController.snapshot(
                "3f8b1c42-9d2e-4a7b-8c1d-5e6f7a8b9c0d", true);
        @SuppressWarnings("unchecked")
        Map<String, Object> grantedData = (Map<String, Object>) granted.get("data");
        assertEquals("GRANTED", grantedData.get("learningConsent"));
        assertEquals("ELIGIBLE", grantedData.get("learningAccess"));

        Map<String, Object> withdrawn = IamLearningConsentController.snapshot(
                "3f8b1c42-9d2e-4a7b-8c1d-5e6f7a8b9c0d", false);
        @SuppressWarnings("unchecked")
        Map<String, Object> withdrawnData = (Map<String, Object>) withdrawn.get("data");
        assertEquals("WITHDRAWN", withdrawnData.get("learningConsent"));
        assertEquals("RESTRICTED", withdrawnData.get("learningAccess"));
    }

    @Test
    void readerRequiresServiceTokenPermission() {
        Jwt reader = jwt("service", List.of("iam.consent.read"));
        IamLearningConsentController.requireReader(new JwtAuthenticationToken(reader,
                List.of(new org.springframework.security.core.authority.SimpleGrantedAuthority("TOKEN_TYPE_service")),
                reader.getSubject()));

        Jwt other = jwt("service", List.of("audit.ingest"));
        ResponseStatusException denied = assertThrows(ResponseStatusException.class, () ->
                IamLearningConsentController.requireReader(new JwtAuthenticationToken(other,
                        List.of(new org.springframework.security.core.authority.SimpleGrantedAuthority("TOKEN_TYPE_service")),
                        other.getSubject())));
        assertEquals(HttpStatus.FORBIDDEN, denied.getStatusCode());
    }

    @Test
    void withdrawalAppendsFactKeepsAccountAndPublishesReceipt() {
        InMemoryConsentStore store = new InMemoryConsentStore();
        InMemoryAccountStore accounts = new InMemoryAccountStore();
        StaticConsentPolicy policy = StaticConsentPolicy.localCandidate(true);
        SessionService sessions = new SessionService(new InMemorySessionStore(), decision -> { }, CLOCK,
                new IamServiceProperties());
        ConsentService consents = new ConsentService(store, policy, decision -> { }, CLOCK, sessions,
                IamTransactionRunner.direct());
        PrincipalId principal = PrincipalId.random();
        accounts.save(new AccountRecord(principal, "withdraw-keep@example.com", "hash-value-not-a-real-secret",
                Set.of("learner"), Set.of("iam.self.read", "learner.profile.read"), AccountStatus.ACTIVE,
                0, null, NOW, NOW));
        ServerPrincipalContext context = ServerPrincipalContext.forPlatform(principal, Set.of("learner"));
        sessions.open(context, new com.englishflow.iam.domain.DeviceId("learning-consent-device"));
        IamLearningConsentController controller = new IamLearningConsentController(consents);
        Authentication reader = reader();

        Map<String, Object> before = data(controller.current(principal.toString(), reader));
        assertEquals("WITHDRAWN", before.get("learningConsent"));
        assertEquals("RESTRICTED", before.get("learningAccess"));

        for (ConsentType type : ConsentType.values()) accept(consents, context, policy, type);
        Map<String, Object> granted = data(controller.current(principal.toString(), reader));
        assertEquals("GRANTED", granted.get("learningConsent"));
        assertEquals("ELIGIBLE", granted.get("learningAccess"));
        assertEquals(List.of("LEARNING"), consents.capabilitiesRestrictedBy(ConsentType.ADULT_LEARNING));
        assertEquals(List.of(), consents.capabilitiesRestrictedBy(ConsentType.PRODUCT_ANALYTICS));
        assertTrue(consents.capabilitiesRestrictedBy(ConsentType.TERMS_OF_SERVICE).contains("LEARNING"));
        assertFalse(consents.capabilitiesRestrictedBy(ConsentType.VOICE_RECORDING).contains("LEARNING"));

        ConsentPolicyDescriptor analytics = policy.descriptor(ConsentType.PRODUCT_ANALYTICS);
        ConsentRecord analyticsWithdrawn = consents.withdraw(context, ConsentType.PRODUCT_ANALYTICS,
                analytics.documentVersion(), analytics.documentDigest());
        IamAuthenticationController.ConsentWithdrawalEffect analyticsReceipt =
                IamAuthenticationController.withdrawalEffect(analyticsWithdrawn, analytics, List.of());
        assertEquals("RESTRICT_PROTECTED_CAPABILITY", analyticsReceipt.effect());
        assertEquals(List.of(), analyticsReceipt.affectedCapabilities());
        assertEquals("UNCHANGED", analyticsReceipt.sessionEffect());
        assertEquals("RETAINED", analyticsReceipt.accountEffect());
        assertEquals("RETAINED", analyticsReceipt.historyEffect());
        assertTrue(sessions.findByPrincipal(principal).stream()
                .allMatch(session -> session.status() == SessionStatus.ACTIVE));
        assertEquals("GRANTED", data(controller.current(principal.toString(), reader)).get("learningConsent"));

        ConsentPolicyDescriptor voice = policy.descriptor(ConsentType.VOICE_RECORDING);
        ConsentRecord voiceWithdrawn = consents.withdraw(context, ConsentType.VOICE_RECORDING,
                voice.documentVersion(), voice.documentDigest());
        assertEquals(List.of("VOICE_REMOTE_PROCESS", "VOICE_REMOTE_RECORD", "VOICE_REMOTE_REPLAY",
                        "VOICE_REMOTE_UPLOAD"),
                IamAuthenticationController.withdrawalEffect(voiceWithdrawn, voice,
                        consents.capabilitiesRestrictedBy(ConsentType.VOICE_RECORDING)).affectedCapabilities());
        assertEquals("UNCHANGED", IamAuthenticationController.withdrawalEffect(voiceWithdrawn, voice,
                consents.capabilitiesRestrictedBy(ConsentType.VOICE_RECORDING)).sessionEffect());
        assertTrue(sessions.findByPrincipal(principal).stream()
                .allMatch(session -> session.status() == SessionStatus.ACTIVE));

        ConsentPolicyDescriptor adult = policy.descriptor(ConsentType.ADULT_LEARNING);
        ConsentRecord withdrawn = consents.withdraw(context, ConsentType.ADULT_LEARNING,
                adult.documentVersion(), adult.documentDigest());
        ConsentRecord repeated = consents.withdraw(context, ConsentType.ADULT_LEARNING,
                adult.documentVersion(), adult.documentDigest());
        assertEquals(withdrawn, repeated);
        List<ConsentHistoryEntry> history = store.history(principal, ConsentType.ADULT_LEARNING);
        assertEquals(2, history.size());
        assertEquals(1, history.stream().filter(ConsentHistoryEntry::accepted).count());
        assertEquals(1, history.stream().filter(entry -> !entry.accepted()).count());
        assertNotEquals(history.get(0).consentId(), history.get(1).consentId());
        IamAuthenticationController.ConsentWithdrawalEffect receipt =
                IamAuthenticationController.withdrawalEffect(withdrawn, adult,
                        consents.capabilitiesRestrictedBy(ConsentType.ADULT_LEARNING));
        assertEquals("RESTRICT_ALL_LEARNING_ACCESS", receipt.effect());
        assertEquals(List.of("LEARNING"), receipt.affectedCapabilities());
        assertEquals("REVOKE_ALL_SESSIONS", receipt.sessionEffect());
        assertEquals("RETAINED", receipt.accountEffect());
        assertEquals("RETAINED", receipt.historyEffect());
        assertEquals(withdrawn.recordedAt(), receipt.appliesAt());
        assertTrue(receipt.cacheInvalidationRequired());
        assertTrue(history.stream().anyMatch(entry -> entry.consentId().equals(withdrawn.consentId())
                && !entry.accepted()));
        Map<String, Object> after = data(controller.current(principal.toString(), reader));
        assertEquals("WITHDRAWN", after.get("learningConsent"));
        assertEquals("RESTRICTED", after.get("learningAccess"));
        assertEquals(AccountStatus.ACTIVE, accounts.findByPrincipalId(principal).orElseThrow().status());
        assertTrue(sessions.findByPrincipal(principal).stream()
                .allMatch(session -> session.status() == SessionStatus.REVOKED));
    }

    @Test
    void learningConsentReadRejectsMissingServiceAuthorityAndBadPrincipal() {
        ConsentService consents = new ConsentService(new InMemoryConsentStore(),
                StaticConsentPolicy.localCandidate(true), decision -> { }, CLOCK);
        IamLearningConsentController controller = new IamLearningConsentController(consents);
        String principalId = PrincipalId.random().toString();
        ResponseStatusException anonymous = assertThrows(ResponseStatusException.class,
                () -> controller.current(principalId, null));
        assertEquals(HttpStatus.UNAUTHORIZED, anonymous.getStatusCode());

        Jwt access = jwt("access", List.of("iam.consent.read"));
        ResponseStatusException user = assertThrows(ResponseStatusException.class, () -> controller.current(
                principalId, new JwtAuthenticationToken(access, List.of(), access.getSubject())));
        assertEquals(HttpStatus.FORBIDDEN, user.getStatusCode());

        ResponseStatusException badPrincipal = assertThrows(ResponseStatusException.class,
                () -> controller.current("not-a-principal", reader()));
        assertEquals(HttpStatus.BAD_REQUEST, badPrincipal.getStatusCode());
    }

    private static Authentication reader() {
        Jwt reader = jwt("service", List.of("iam.consent.read"));
        return new JwtAuthenticationToken(reader,
                List.of(new org.springframework.security.core.authority.SimpleGrantedAuthority("TOKEN_TYPE_service")),
                reader.getSubject());
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> data(Map<String, Object> body) {
        return (Map<String, Object>) body.get("data");
    }

    private static void accept(ConsentService consents, ServerPrincipalContext context,
                               StaticConsentPolicy policy, ConsentType type) {
        ConsentPolicyDescriptor descriptor = policy.descriptor(type);
        consents.record(context, new ConsentCommand(type, descriptor.documentVersion(), true,
                ClientAuthorityClaims.none(), descriptor.documentDigest()));
    }

    private static Jwt jwt(String tokenType, List<String> permissions) {
        return Jwt.withTokenValue("token")
                .header("alg", "RS256")
                .subject("learner-service")
                .issuedAt(Instant.parse("2026-10-09T00:00:00Z"))
                .expiresAt(Instant.parse("2026-10-09T00:05:00Z"))
                .claim("token_type", tokenType)
                .claim("permissions", permissions)
                .claim("scope", String.join(" ", permissions))
                .build();
    }
}
