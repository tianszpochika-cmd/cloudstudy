package com.englishflow.notification.adapter.memory;

import com.englishflow.notification.domain.NotificationChannel;
import com.englishflow.notification.domain.NotificationDomainException;
import com.englishflow.notification.domain.NotificationSubscription;
import com.englishflow.notification.port.NotificationSubscriptionStore;

import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

/** Local/test subscription adapter with version-guarded writes. */
public final class InMemoryNotificationSubscriptionStore implements NotificationSubscriptionStore {

    private final Map<String, NotificationSubscription> rows = new ConcurrentHashMap<>();

    @Override
    public Optional<NotificationSubscription> findSubscription(String tenantId, String principalId,
            String notificationType, NotificationChannel channel) {
        return Optional.ofNullable(rows.get(key(tenantId, principalId, notificationType, channel)));
    }

    @Override
    public synchronized NotificationSubscription saveSubscription(NotificationSubscription subscription) {
        String key = key(subscription.tenantId(), subscription.principalId(),
                subscription.notificationType(), subscription.channel());
        NotificationSubscription current = rows.get(key);
        if (current == null) {
            if (subscription.version() != 1) {
                throw new NotificationDomainException(NotificationDomainException.Code.VERSION_CONFLICT,
                        "subscription does not exist at the requested version");
            }
            rows.put(key, subscription);
            return subscription;
        }
        if (current.version() != subscription.version() - 1 && current.version() != subscription.version()) {
            throw new NotificationDomainException(NotificationDomainException.Code.VERSION_CONFLICT,
                    "subscription version changed before commit");
        }
        rows.put(key, subscription);
        return subscription;
    }

    private static String key(String tenantId, String principalId, String notificationType,
            NotificationChannel channel) {
        return tenantId + '|' + principalId + '|' + notificationType + '|' + channel;
    }
}
