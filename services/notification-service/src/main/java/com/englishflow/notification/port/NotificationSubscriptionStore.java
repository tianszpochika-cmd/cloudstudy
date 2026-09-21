package com.englishflow.notification.port;

import com.englishflow.notification.domain.NotificationSubscription;

import java.util.Optional;

/** Managed subscription facts (M6-001). Absent rows mean subscribed; explicit rows may opt out. */
public interface NotificationSubscriptionStore {

    Optional<NotificationSubscription> findSubscription(String tenantId, String principalId,
            String notificationType, com.englishflow.notification.domain.NotificationChannel channel);

    /**
     * Version-guarded upsert: creates at version 1 or advances exactly one version.
     * A stale version throws a version-conflict instead of silently overwriting.
     */
    NotificationSubscription saveSubscription(NotificationSubscription subscription);
}
