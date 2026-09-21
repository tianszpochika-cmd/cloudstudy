package com.englishflow.notification.unit;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;

import org.junit.jupiter.api.Test;

import com.englishflow.notification.adapter.memory.InMemoryDeliveryTransport;
import com.englishflow.notification.adapter.memory.InMemoryNotificationAuditEventStore;
import com.englishflow.notification.adapter.memory.InMemoryNotificationConsentStore;
import com.englishflow.notification.adapter.memory.InMemoryNotificationConsentStore;
import com.englishflow.notification.adapter.memory.InMemoryNotificationFactStore;
import com.englishflow.notification.adapter.memory.InMemoryNotificationIdGenerator;
import com.englishflow.notification.adapter.memory.InMemoryNotificationSubscriptionStore;
import com.englishflow.notification.adapter.memory.InMemoryNotificationTemplateStore;
import com.englishflow.notification.adapter.memory.InMemoryOutboxEventPort;
import com.englishflow.notification.adapter.memory.InMemoryWorkflowPort;
import com.englishflow.notification.application.NotificationApplicationService;
import com.englishflow.notification.application.QueueNotificationCommand;
import com.englishflow.notification.application.RequestMetadata;
import com.englishflow.notification.application.TemplateNotificationCommand;
import com.englishflow.notification.domain.DeliveryStatus;
import com.englishflow.notification.domain.IdempotencyKey;
import com.englishflow.notification.domain.NotificationAccessPolicy;
import com.englishflow.notification.domain.NotificationChannel;
import com.englishflow.notification.domain.NotificationDomainException;
import com.englishflow.notification.domain.NotificationPrincipalContext;
import com.englishflow.notification.domain.NotificationSubscription;
import com.englishflow.notification.domain.NotificationTemplate;

/** M6-001 managed subscription and template gates on delivery. */
class NotificationSubscriptionTemplateTest {

    private static final Instant NOW = Instant.parse("2026-09-21T00:00:00Z");
    private final Clock clock = Clock.fixed(NOW, ZoneOffset.UTC);
    private final NotificationPrincipalContext ctx = NotificationPrincipalContext.authenticated("t", "p", "d");
    private final NotificationPrincipalContext trusted =
            NotificationPrincipalContext.trustedService("t", "w");
    private final RequestMetadata meta = new RequestMetadata("req-1", "trace-1");

    private final InMemoryNotificationConsentStore consents = new InMemoryNotificationConsentStore();
    private final InMemoryNotificationSubscriptionStore subscriptions = new InMemoryNotificationSubscriptionStore();
    private final InMemoryNotificationTemplateStore templates = new InMemoryNotificationTemplateStore();

    private NotificationApplicationService service() {
        consents.setConsent("t", "p", NotificationChannel.IN_APP, true);
        return new NotificationApplicationService(
                new InMemoryNotificationFactStore(), new InMemoryWorkflowPort(),
                new InMemoryDeliveryTransport(), new InMemoryOutboxEventPort(),
                new InMemoryNotificationIdGenerator(), new NotificationAccessPolicy(), clock, 3,
                Duration.ofSeconds(30),
                new InMemoryNotificationAuditEventStore(), consents, subscriptions, templates);
    }

    private static NotificationSubscription subscription(boolean subscribed, long version) {
        return new NotificationSubscription("t", "p", "nt", NotificationChannel.IN_APP, subscribed, version, NOW);
    }

    private static NotificationTemplate template(String locale,
            NotificationTemplate.TemplateStatus status) {
        return new NotificationTemplate("tmpl", "v1", locale, "Title", "Body {{name}}", status, NOW);
    }

    @Test
    void absentSubscriptionStaysSubscribed() {
        var svc = service();
        var msg = svc.queue(ctx, new QueueNotificationCommand("nt", NotificationChannel.IN_APP,
                "tmpl", "v1", "T", "B", "cv"), new IdempotencyKey("sub-1"), meta);
        var result = svc.deliver(ctx, msg.messageId(), new IdempotencyKey("sub-2"), meta);
        assertEquals(DeliveryStatus.DELIVERED, result.attempt().status());
    }

    @Test
    void explicitOptOutFiltersDelivery() {
        subscriptions.saveSubscription(subscription(true, 1));
        subscriptions.saveSubscription(
                new NotificationSubscription("t", "p", "nt", NotificationChannel.IN_APP, false, 2, NOW));
        var svc = service();
        var msg = svc.queue(ctx, new QueueNotificationCommand("nt", NotificationChannel.IN_APP,
                "tmpl", "v1", "T", "B", "cv"), new IdempotencyKey("sub-3"), meta);
        var result = svc.deliver(ctx, msg.messageId(), new IdempotencyKey("sub-4"), meta);
        assertEquals(DeliveryStatus.CANCELLED, result.attempt().status());
    }

    @Test
    void staleSubscriptionVersionIsRejected() {
        subscriptions.saveSubscription(subscription(true, 1));
        subscriptions.saveSubscription(
                new NotificationSubscription("t", "p", "nt", NotificationChannel.IN_APP, false, 2, NOW));
        var stale = assertThrows(NotificationDomainException.class, () -> subscriptions.saveSubscription(
                new NotificationSubscription("t", "p", "nt", NotificationChannel.IN_APP, true, 1, NOW)));
        assertEquals(NotificationDomainException.Code.VERSION_CONFLICT, stale.code());
    }

    @Test
    void templateOnlyRequiresActiveTemplate() {
        templates.saveTemplate(template("zh-CN", NotificationTemplate.TemplateStatus.ACTIVE));
        var svc = service();
        var msg = svc.queueTrusted(trusted, "t", "p",
                new TemplateNotificationCommand("nt", NotificationChannel.IN_APP, "tmpl", "v1", "zh-CN",
                        java.util.Map.of(), "cv", NOW),
                new IdempotencyKey("tpl-1"), meta);
        var result = svc.deliver(ctx, msg.messageId(), new IdempotencyKey("tpl-2"), meta);
        assertEquals(DeliveryStatus.DELIVERED, result.attempt().status());
    }

    @Test
    void retiredTemplateFiltersTemplateOnlyDelivery() {
        templates.saveTemplate(template("zh-CN", NotificationTemplate.TemplateStatus.RETIRED));
        var svc = service();
        var msg = svc.queueTrusted(trusted, "t", "p",
                new TemplateNotificationCommand("nt", NotificationChannel.IN_APP, "tmpl", "v1", "zh-CN",
                        java.util.Map.of(), "cv", NOW),
                new IdempotencyKey("tpl-3"), meta);
        var result = svc.deliver(ctx, msg.messageId(), new IdempotencyKey("tpl-4"), meta);
        assertEquals(DeliveryStatus.CANCELLED, result.attempt().status());
    }

    @Test
    void templateFallsBackToZhCn() {
        templates.saveTemplate(template("zh-CN", NotificationTemplate.TemplateStatus.ACTIVE));
        assertTrue(templates.findActive("tmpl", "v1", "fr-FR").isPresent());
        assertTrue(templates.findActive("tmpl", "v1", "xx").isPresent());
        templates.saveTemplate(template("zh-CN", NotificationTemplate.TemplateStatus.RETIRED));
        assertTrue(templates.findActive("tmpl", "v1", "fr-FR").isEmpty());
    }
}
