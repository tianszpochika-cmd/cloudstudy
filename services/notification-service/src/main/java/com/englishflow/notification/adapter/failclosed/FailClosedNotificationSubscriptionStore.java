package com.englishflow.notification.adapter.failclosed;

import com.englishflow.notification.domain.NotificationChannel;
import com.englishflow.notification.domain.NotificationDomainException;
import com.englishflow.notification.domain.NotificationSubscription;
import com.englishflow.notification.port.NotificationSubscriptionStore;

import java.util.Optional;

/** Missing subscription storage is unavailable, never an implicit opt-in or opt-out. */
public final class FailClosedNotificationSubscriptionStore implements NotificationSubscriptionStore {

    @Override
    public Optional<NotificationSubscription> findSubscription(String tenantId, String principalId,
            String notificationType, NotificationChannel channel) {
        throw new NotificationDomainException(NotificationDomainException.Code.NETWORK_UNAVAILABLE,
                "notification subscription persistence is not configured");
    }

    @Override
    public NotificationSubscription saveSubscription(NotificationSubscription subscription) {
        throw new NotificationDomainException(NotificationDomainException.Code.NETWORK_UNAVAILABLE,
                "notification subscription persistence is not configured");
    }
}
