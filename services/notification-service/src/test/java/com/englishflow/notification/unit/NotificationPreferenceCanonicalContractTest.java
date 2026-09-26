package com.englishflow.notification.unit;

import com.englishflow.notification.adapter.memory.InMemoryDeliveryTransport;
import com.englishflow.notification.adapter.memory.InMemoryNotificationConsentStore;
import com.englishflow.notification.adapter.memory.InMemoryNotificationFactStore;
import com.englishflow.notification.adapter.memory.InMemoryNotificationIdGenerator;
import com.englishflow.notification.adapter.memory.InMemoryOutboxEventPort;
import com.englishflow.notification.adapter.memory.InMemoryWorkflowPort;
import com.englishflow.notification.application.NotificationApplicationService;
import com.englishflow.notification.application.RequestMetadata;
import com.englishflow.notification.application.UpdatePreferenceCommand;
import com.englishflow.notification.domain.IdempotencyKey;
import com.englishflow.notification.domain.NotificationAccessPolicy;
import com.englishflow.notification.domain.NotificationCategory;
import com.englishflow.notification.domain.NotificationChannel;
import com.englishflow.notification.domain.NotificationDomainException;
import com.englishflow.notification.domain.NotificationDndWindow;
import com.englishflow.notification.domain.NotificationFrequencyPolicy;
import org.junit.jupiter.api.Test;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class NotificationPreferenceCanonicalContractTest {

    private static final Instant NOW = Instant.parse("2026-09-25T12:00:00Z");

    @Test
    void purposeAliasesMustMatchTheirCanonicalCategoryAndSmsAllowlist() {
        var allowed = command("CRITICAL_ACCOUNT_PAYMENT", NotificationCategory.PAYMENT,
                NotificationChannel.SMS, 0);
        assertEquals(NotificationCategory.PAYMENT, allowed.category());

        assertThrows(NotificationDomainException.class, () -> command("CRITICAL_ACCOUNT_PAYMENT",
                NotificationCategory.ACCOUNT, NotificationChannel.SMS, 0));
        assertThrows(NotificationDomainException.class, () -> command("MARKETING", NotificationCategory.MARKETING,
                NotificationChannel.SMS, 0));
        assertThrows(NotificationDomainException.class, () -> command("learning.review.due",
                NotificationCategory.REVIEW, NotificationChannel.IN_APP, 0));
    }

    @Test
    void trustedProducerMessageTypesHaveExactPreferenceCategories() {
        assertEquals(java.util.Optional.of(NotificationCategory.EXAM),
                NotificationCategory.fromMessageType("assessment.result.ready"));
        assertEquals(java.util.Optional.of(NotificationCategory.LEARNING),
                NotificationCategory.fromMessageType("learning.mastery.updated"));
        assertEquals(java.util.Optional.of(NotificationCategory.REVIEW),
                NotificationCategory.fromMessageType("learning.review.due"));
        assertEquals(java.util.Optional.of(NotificationCategory.LEARNING),
                NotificationCategory.fromMessageType("learning.recovery.required"));
        assertEquals(java.util.Optional.of(NotificationCategory.SYSTEM),
                NotificationCategory.fromMessageType("sync.conflict.detected"));
        assertEquals(java.util.Optional.of(NotificationCategory.SYSTEM),
                NotificationCategory.fromMessageType("sync.recovered"));
        assertEquals(java.util.Optional.of(NotificationCategory.SYSTEM),
                NotificationCategory.fromMessageType("notification.recovery.completed"));
        assertEquals(java.util.Optional.empty(), NotificationCategory.fromMessageType("unknown.event"));
    }

    @Test
    void dndWindowHandlesOvernightAndEqualEndpoints() {
        var overnight = NotificationDndWindow.parse("23:00", "08:00");
        assertTrue(overnight.contains(java.time.LocalTime.of(23, 0)));
        assertTrue(overnight.contains(java.time.LocalTime.of(7, 59)));
        assertFalse(overnight.contains(java.time.LocalTime.of(8, 0)));
        assertFalse(overnight.contains(java.time.LocalTime.of(12, 0)));
        assertFalse(NotificationDndWindow.parse("08:00", "08:00")
                .contains(java.time.LocalTime.NOON));
    }

    @Test
    void updatePersistsCanonicalIntentButDoesNotGrantConsent() {
        var facts = new InMemoryNotificationFactStore();
        var consents = new InMemoryNotificationConsentStore();
        var service = new NotificationApplicationService(facts, new InMemoryWorkflowPort(),
                new InMemoryDeliveryTransport(), new InMemoryOutboxEventPort(), new InMemoryNotificationIdGenerator(),
                new NotificationAccessPolicy(), Clock.fixed(NOW, ZoneOffset.UTC), 3, Duration.ofSeconds(30),
                new com.englishflow.notification.adapter.memory.InMemoryNotificationAuditEventStore(), consents);
        var context = com.englishflow.notification.domain.NotificationPrincipalContext.authenticated("t", "p", "d");
        var command = new UpdatePreferenceCommand("REVIEW", NotificationCategory.REVIEW, NotificationChannel.PUSH,
                true, "zh-CN", 4, NotificationDndWindow.parse("22:00", "07:00"),
                NotificationFrequencyPolicy.WEEKLY_DIGEST, 0);

        var saved = service.updatePreference(context, command, new IdempotencyKey("canonical-pref-1"),
                new RequestMetadata("request-1", "trace-1"));
        var stored = facts.findPreference("t", "p", NotificationCategory.REVIEW, NotificationChannel.PUSH)
                .orElseThrow();

        assertEquals(NotificationCategory.REVIEW, saved.category());
        assertEquals(4, stored.consentVersion());
        assertEquals("22:00", stored.dndWindow().startWireValue());
        assertEquals("07:00", stored.dndWindow().endWireValue());
        assertEquals(NotificationFrequencyPolicy.WEEKLY_DIGEST, stored.frequencyPolicy());
        assertEquals(1, stored.version());
        assertTrue(consents.findConsent("t", "p", NotificationChannel.PUSH).isEmpty(),
                "consentVersion is stored as preference metadata and does not create a consent fact");

        var stale = assertThrows(NotificationDomainException.class, () -> service.updatePreference(context,
                command, new IdempotencyKey("canonical-pref-2"), new RequestMetadata("request-2", "trace-2")));
        assertEquals(NotificationDomainException.Code.VERSION_CONFLICT, stale.code());
    }

    @Test
    void v8MigrationArchivesLegacyRowsInsteadOfPromotingTheirOptIns() throws Exception {
        String migration = Files.readString(Path.of("src/main/resources/db/migration/"
                + "V8__canonicalize_m1016_notification_preferences.sql"));
        assertTrue(migration.contains("notification_preference_legacy"));
        assertTrue(migration.contains("RENAME TABLE notification_preference TO notification_preference_legacy"));
        assertTrue(migration.contains("consent_version INT NOT NULL"));
        assertTrue(migration.contains("frequency_policy VARCHAR(20) NOT NULL"));
        assertFalse(migration.contains("INSERT INTO notification_preference\n" +
                "SELECT"), "legacy enabled rows must not be promoted into canonical preference facts");
    }

    @Test
    void legacyReadWritePermissionsCannotReachCanonicalPreferenceOwner() {
        var service = new NotificationApplicationService(new InMemoryNotificationFactStore(),
                new InMemoryWorkflowPort(), new InMemoryDeliveryTransport(), new InMemoryOutboxEventPort(),
                new InMemoryNotificationIdGenerator(), new NotificationAccessPolicy(),
                Clock.fixed(NOW, ZoneOffset.UTC), 3, Duration.ofSeconds(30));
        var legacyPrincipal = new com.englishflow.notification.domain.NotificationPrincipalContext(
                "t", "p", "d", Set.of("learner"), Set.of("notification.read", "notification.write"));

        assertThrows(NotificationDomainException.class, () -> service.preferences(legacyPrincipal));
        assertThrows(NotificationDomainException.class, () -> service.updatePreference(legacyPrincipal,
                command("LEARNING", NotificationCategory.LEARNING, NotificationChannel.IN_APP, 0),
                new IdempotencyKey("legacy-permission"), new RequestMetadata("req-1", "trace-1")));
    }

    private static UpdatePreferenceCommand command(String pathType, NotificationCategory category,
            NotificationChannel channel, long expectedVersion) {
        return new UpdatePreferenceCommand(pathType, category, channel, true, "zh-CN", 1,
                NotificationDndWindow.parse("23:00", "08:00"), NotificationFrequencyPolicy.IMMEDIATE,
                expectedVersion);
    }
}
