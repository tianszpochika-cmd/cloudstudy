package com.englishflow.iam.web;

import com.englishflow.iam.domain.AccountRecord;
import com.englishflow.iam.domain.AccountStatus;
import com.englishflow.iam.domain.PrincipalId;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class IamLearnerPermissionGateTest {
    private static final Set<String> NOTIFICATION_PREFERENCE_SCOPES = Set.of(
            "notification.preference.read.self",
            "notification.preference.write.self");
    private static final Set<String> B12_LEARNER_SCOPES = Set.of(
            "gamification.read.self",
            "gamification.ledger.read.self",
            "gamification.reward.read.self",
            "gamification.reward.claim.self",
            "gamification.game.read.self",
            "gamification.game.play.self",
            "social.room.read",
            "social.room.write.self",
            "social.focus.write.self",
            "social.interaction.write.self",
            "social.leaderboard.read",
            "social.visibility.write.self",
            "social.report.create.self",
            "social.report.read.self");

    @Test
    void canonicalB12ScopesAreStrippedUntilBothAdultGateAndRequiredConsentPass() {
        Instant now = Instant.parse("2026-09-25T00:00:00Z");
        Set<String> permissions = new java.util.HashSet<>(B12_LEARNER_SCOPES);
        permissions.addAll(Set.of("iam.self.read", "learner.profile.read", "social.room.write",
                "gamification.trusted-event.write", "social.trusted-event.write"));
        AccountRecord account = new AccountRecord(PrincipalId.random(), "learner@example.com",
                "$2a$12$learnerGateTestHashValue0123456789", Set.of("learner"), permissions,
                AccountStatus.ACTIVE, 0, null, now, now);

        AccountRecord restricted = IamAuthenticationController.applyLearningEligibilityGate(account, false, true);

        assertTrue(java.util.Collections.disjoint(restricted.permissions(), B12_LEARNER_SCOPES));
        assertFalse(restricted.permissions().contains("social.room.write"));
        assertFalse(restricted.permissions().contains("gamification.trusted-event.write"));
        assertFalse(restricted.permissions().contains("social.trusted-event.write"));
        assertTrue(restricted.permissions().containsAll(Set.of("iam.self.read", "learner.profile.read")));

        AccountRecord missingConsent = IamAuthenticationController.applyLearningEligibilityGate(account, true, false);
        assertTrue(java.util.Collections.disjoint(missingConsent.permissions(), B12_LEARNER_SCOPES));
    }

    @Test
    void canonicalB12ScopesRemainAvailableAfterAdultGateAndRequiredConsentPass() {
        Instant now = Instant.parse("2026-09-25T00:00:00Z");
        AccountRecord account = new AccountRecord(PrincipalId.random(), "learner@example.com",
                "$2a$12$learnerGateTestHashValue0123456789", Set.of("learner"),
                B12_LEARNER_SCOPES, AccountStatus.ACTIVE, 0, null, now, now);

        AccountRecord eligible = IamAuthenticationController.applyLearningEligibilityGate(account, true, true);

        assertEquals(B12_LEARNER_SCOPES, eligible.permissions());
    }

    @Test
    void canonicalNotificationPreferenceScopesAreStrippedUntilGateAndConsentPass() {
        Instant now = Instant.parse("2026-09-25T00:00:00Z");
        Set<String> permissions = new java.util.HashSet<>(NOTIFICATION_PREFERENCE_SCOPES);
        permissions.addAll(Set.of("iam.self.read", "notification.trusted-event.write"));
        AccountRecord account = new AccountRecord(PrincipalId.random(), "learner@example.com",
                "$2a$12$learnerGateTestHashValue0123456789", Set.of("learner"), permissions,
                AccountStatus.ACTIVE, 0, null, now, now);

        AccountRecord beforeAdultGate = IamAuthenticationController.applyLearningEligibilityGate(account, false, true);
        assertTrue(java.util.Collections.disjoint(beforeAdultGate.permissions(), NOTIFICATION_PREFERENCE_SCOPES));
        assertFalse(beforeAdultGate.permissions().contains("notification.trusted-event.write"));
        assertTrue(beforeAdultGate.permissions().contains("iam.self.read"));

        AccountRecord withoutConsent = IamAuthenticationController.applyLearningEligibilityGate(account, true, false);
        assertTrue(java.util.Collections.disjoint(withoutConsent.permissions(), NOTIFICATION_PREFERENCE_SCOPES));
    }

    @Test
    void canonicalNotificationPreferenceScopesRemainAvailableAfterGateAndConsentPass() {
        Instant now = Instant.parse("2026-09-25T00:00:00Z");
        AccountRecord account = new AccountRecord(PrincipalId.random(), "learner@example.com",
                "$2a$12$learnerGateTestHashValue0123456789", Set.of("learner"),
                NOTIFICATION_PREFERENCE_SCOPES, AccountStatus.ACTIVE, 0, null, now, now);

        AccountRecord eligible = IamAuthenticationController.applyLearningEligibilityGate(account, true, true);

        assertEquals(NOTIFICATION_PREFERENCE_SCOPES, eligible.permissions());
    }
}
