package com.englishflow.notification.config;

import com.englishflow.notification.adapter.memory.InMemoryDeliveryTransport;
import com.englishflow.notification.adapter.memory.InMemoryNotificationAuditEventStore;
import com.englishflow.notification.adapter.memory.InMemoryNotificationConsentStore;
import com.englishflow.notification.adapter.memory.InMemoryNotificationFactStore;
import com.englishflow.notification.adapter.memory.InMemoryNotificationIdGenerator;
import com.englishflow.notification.adapter.memory.InMemoryOfflineSyncStore;
import com.englishflow.notification.adapter.memory.InMemoryOutboxEventPort;
import com.englishflow.notification.adapter.memory.InMemoryTrustedEventReceiptStore;
import com.englishflow.notification.adapter.memory.InMemoryWorkflowPort;
import com.englishflow.notification.application.NotificationApplicationService;
import com.englishflow.notification.application.OfflineSyncApplicationService;
import com.englishflow.notification.application.NotificationRecoveryApplicationService;
import com.englishflow.notification.application.NotificationRetryApplicationService;
import com.englishflow.notification.application.TrustedEventApplicationService;
import com.englishflow.notification.domain.NotificationAccessPolicy;
import com.englishflow.notification.domain.TrustedEventAllowlist;
import com.englishflow.notification.port.NotificationAuditEventPort;
import com.englishflow.notification.port.NotificationConsentPort;
import com.englishflow.notification.port.DeliveryTransport;
import com.englishflow.notification.port.NotificationFactStore;
import com.englishflow.notification.port.NotificationIdGenerator;
import com.englishflow.notification.port.OfflineSyncStore;
import com.englishflow.notification.port.OutboxEventPort;
import com.englishflow.notification.port.TrustedEventReceiptPort;
import com.englishflow.notification.port.WorkflowPort;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Clock;
import java.time.Duration;

/** Wiring keeps the memory adapters replaceable by durable service-owned adapters. */
@Configuration
public class NotificationServiceConfiguration {

    @Bean
    Clock notificationClock() {
        return Clock.systemUTC();
    }

    @Bean
    NotificationAccessPolicy notificationAccessPolicy() {
        return new NotificationAccessPolicy();
    }

    @Bean
    InMemoryNotificationFactStore notificationFactStore() {
        return new InMemoryNotificationFactStore();
    }

    @Bean
    InMemoryOfflineSyncStore offlineSyncStore() {
        return new InMemoryOfflineSyncStore();
    }

    @Bean
    InMemoryWorkflowPort workflowPort() {
        return new InMemoryWorkflowPort();
    }

    @Bean
    InMemoryDeliveryTransport deliveryTransport() {
        return new InMemoryDeliveryTransport();
    }

    @Bean
    InMemoryOutboxEventPort outboxEventPort() {
        return new InMemoryOutboxEventPort();
    }

    @Bean
    InMemoryNotificationConsentStore notificationConsentStore() {
        return new InMemoryNotificationConsentStore();
    }

    @Bean
    InMemoryTrustedEventReceiptStore trustedEventReceiptStore() {
        return new InMemoryTrustedEventReceiptStore();
    }

    @Bean
    InMemoryNotificationAuditEventStore notificationAuditEventStore() {
        return new InMemoryNotificationAuditEventStore();
    }

    @Bean
    TrustedEventAllowlist trustedEventAllowlist() {
        return TrustedEventAllowlist.standard();
    }

    @Bean
    InMemoryNotificationIdGenerator notificationIdGenerator() {
        return new InMemoryNotificationIdGenerator();
    }

    @Bean
    NotificationApplicationService notificationApplicationService(
            NotificationFactStore store,
            WorkflowPort workflow,
            DeliveryTransport transport,
            OutboxEventPort events,
            NotificationIdGenerator ids,
            NotificationAccessPolicy access,
            Clock clock,
            @Value("${notification.max-delivery-attempts:5}") int maxAttempts,
            @Value("${notification.retry-backoff:PT30S}") Duration retryBackoff,
            NotificationAuditEventPort audit,
            NotificationConsentPort consents) {
        return new NotificationApplicationService(store, workflow, transport, events, ids, access,
                clock, maxAttempts, retryBackoff, audit, consents);
    }

    @Bean
    OfflineSyncApplicationService offlineSyncApplicationService(
            OfflineSyncStore store,
            WorkflowPort workflow,
            OutboxEventPort events,
            NotificationIdGenerator ids,
            NotificationAccessPolicy access,
            Clock clock) {
        return new OfflineSyncApplicationService(store, workflow, events, ids, access, clock);
    }

    @Bean
    TrustedEventApplicationService trustedEventApplicationService(
            NotificationApplicationService notifications,
            NotificationFactStore store,
            TrustedEventReceiptPort receipts,
            NotificationConsentPort consents,
            TrustedEventAllowlist allowlist,
            NotificationAccessPolicy access,
            OutboxEventPort events,
            NotificationAuditEventPort audit,
            NotificationIdGenerator ids,
            WorkflowPort workflow,
            Clock clock) {
        return new TrustedEventApplicationService(notifications, store, receipts, consents, allowlist, access,
                events, audit, ids, workflow, clock);
    }

    @Bean
    NotificationRetryApplicationService notificationRetryApplicationService(
            NotificationApplicationService notifications,
            NotificationFactStore store,
            WorkflowPort workflow,
            NotificationAccessPolicy access,
            OutboxEventPort events,
            NotificationAuditEventPort audit,
            NotificationIdGenerator ids,
            Clock clock) {
        return new NotificationRetryApplicationService(notifications, store, workflow, access, events, audit, ids,
                clock);
    }

    @Bean
    NotificationRecoveryApplicationService notificationRecoveryApplicationService(
            NotificationApplicationService notifications,
            NotificationFactStore store,
            NotificationConsentPort consents,
            WorkflowPort workflow,
            NotificationAccessPolicy access,
            OutboxEventPort events,
            NotificationAuditEventPort audit,
            NotificationIdGenerator ids,
            Clock clock) {
        return new NotificationRecoveryApplicationService(notifications, store, consents, workflow, access, events,
                audit, ids, clock);
    }
}
