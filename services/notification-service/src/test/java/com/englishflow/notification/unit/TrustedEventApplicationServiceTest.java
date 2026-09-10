package com.englishflow.notification.unit;

import com.englishflow.notification.adapter.memory.InMemoryDeliveryTransport;
import com.englishflow.notification.adapter.memory.InMemoryNotificationAuditEventStore;
import com.englishflow.notification.adapter.memory.InMemoryNotificationConsentStore;
import com.englishflow.notification.adapter.memory.InMemoryNotificationFactStore;
import com.englishflow.notification.adapter.memory.InMemoryNotificationIdGenerator;
import com.englishflow.notification.adapter.memory.InMemoryOutboxEventPort;
import com.englishflow.notification.adapter.memory.InMemoryTrustedEventReceiptStore;
import com.englishflow.notification.adapter.memory.InMemoryWorkflowPort;
import com.englishflow.notification.application.NotificationApplicationService;
import com.englishflow.notification.application.RequestMetadata;
import com.englishflow.notification.application.TrustedEventApplicationService;
import com.englishflow.notification.domain.NotificationAccessPolicy;
import com.englishflow.notification.domain.NotificationChannel;
import com.englishflow.notification.domain.NotificationPreference;
import com.englishflow.notification.domain.NotificationPrincipalContext;
import com.englishflow.notification.domain.TrustedEventAllowlist;
import com.englishflow.notification.domain.TrustedEventEnvelope;
import com.englishflow.notification.domain.TrustedEventProcessingStatus;
import com.englishflow.notification.port.NotificationConsentPort;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Map;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

/** Trusted event consumer boundary: dedupe, allowlist, fail-closed filter/reject. */
class TrustedEventApplicationServiceTest {

    private static final Instant NOW = Instant.parse("2026-08-22T00:00:00Z");
    private final Clock clock = Clock.fixed(NOW, ZoneOffset.UTC);
    private final RequestMetadata meta = new RequestMetadata("req-1", "trace-1");
    private final NotificationPrincipalContext consumer =
            NotificationPrincipalContext.trustedService("t", "svc-learning");
    private final InMemoryNotificationConsentStore consents = new InMemoryNotificationConsentStore();
    private final InMemoryNotificationFactStore facts = new InMemoryNotificationFactStore();

    private TrustedEventApplicationService consumer() {
        var notifications = new NotificationApplicationService(facts, new InMemoryWorkflowPort(),
                new InMemoryDeliveryTransport(), new InMemoryOutboxEventPort(), new InMemoryNotificationIdGenerator(),
                new NotificationAccessPolicy(), clock, 3, Duration.ofSeconds(5),
                new InMemoryNotificationAuditEventStore(), consents);
        return new TrustedEventApplicationService(notifications, facts, new InMemoryTrustedEventReceiptStore(),
                consents, TrustedEventAllowlist.standard(), new NotificationAccessPolicy(),
                new InMemoryOutboxEventPort(), new InMemoryNotificationAuditEventStore(),
                new InMemoryNotificationIdGenerator(), new InMemoryWorkflowPort(), clock);
    }

    private TrustedEventEnvelope reviewEvent(String eventId, String dedupeKey, String principalId,
            Map<String, String> attrs, String locale) {
        return TrustedEventEnvelope.forNotification(eventId, "learning.review.scheduled.v1", "learning.event.v1",
                "learning_review_queue", "q-" + eventId, "learning-service", "trace-event", "req-event",
                dedupeKey, "t", principalId, null, locale, NotificationChannel.IN_APP, null, attrs);
    }

    @Test
    void allowedEventQueuesTemplateMessage() {
        consents.setConsent("t", "p", NotificationChannel.IN_APP, true);
        var svc = consumer();
        var env = reviewEvent("e1", "dk-1", "p", allowedAttrs(), "zh-CN");
        var result = svc.consume(consumer, env, meta);
        assertEquals(TrustedEventProcessingStatus.QUEUED, result.status());
        assertEquals("dk-1", result.dedupeKey());
        // replay is deduped
        var replay = svc.consume(consumer, env, meta);
        assertEquals(TrustedEventProcessingStatus.DUPLICATE, replay.status());
    }

    @Test
    void unknownEventIsRejectedByAllowlist() {
        var svc = consumer();
        var env = new TrustedEventEnvelope("evt-x", "client.fake.v1", "client.event.v1", 1, NOW,
                "fake", "fake-agg", "actor", "trace-x", "req-x", "client.event.v1", "dk-x",
                "t", "p", null, "zh-CN", NotificationChannel.IN_APP, null, Map.of());
        var result = svc.consume(consumer, env, meta);
        assertEquals(TrustedEventProcessingStatus.REJECTED, result.status());
        assertEquals("EVENT_NOT_ALLOWLISTED", result.reasonCode());
    }

    @Test
    void disallowedAttributeIsRejected() {
        var svc = consumer();
        var env = reviewEvent("e2", "dk-2", "p", Map.of("extraKey", "x"), "zh-CN");
        var result = svc.consume(consumer, env, meta);
        assertEquals(TrustedEventProcessingStatus.REJECTED, result.status());
        assertEquals("ATTRIBUTE_NOT_ALLOWLISTED", result.reasonCode());
    }

    @Test
    void disabledPreferenceProducesNoMessage() {
        var svc = consumer();
        facts.savePreference(new NotificationPreference("t", "p", "learning.review.due",
                NotificationChannel.IN_APP, false, "zh-CN", 1, NOW));
        var result = svc.consume(consumer, reviewEvent("e3", "dk-3", "p", allowedAttrs(), "zh-CN"), meta);
        assertEquals(TrustedEventProcessingStatus.FILTERED, result.status());
        assertEquals("PREFERENCE_DISABLED", result.reasonCode());
        assertNull(result.messageId());
    }

    @Test
    void missingConsentIsFiltered() {
        var svc = consumer();
        // principal p2 has no consent recorded -> opt-out by default
        var result = svc.consume(consumer, reviewEvent("e4", "dk-4", "p2", allowedAttrs(), "zh-CN"), meta);
        assertEquals(TrustedEventProcessingStatus.FILTERED, result.status());
        assertEquals("CONSENT_NOT_GRANTED", result.reasonCode());
    }

    @Test
    void disallowedLocaleIsRejected() {
        consents.setConsent("t", "p", NotificationChannel.IN_APP, true);
        var svc = consumer();
        var env = reviewEvent("e5", "dk-5", "p", allowedAttrs(), "fr-FR");
        var result = svc.consume(consumer, env, meta);
        assertEquals(TrustedEventProcessingStatus.REJECTED, result.status());
        assertEquals("TEMPLATE_NOT_ALLOWLISTED", result.reasonCode());
    }

    private static Map<String, String> allowedAttrs() {
        return Map.of("queueItemId", "q1", "itemId", "i1", "source", "REVIEW",
                "state", "REVIEW_QUEUE", "dueAt", NOW.toString(), "queueVersion", "1");
    }
}
