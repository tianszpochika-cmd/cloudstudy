package com.englishflow.notification.port;

import com.englishflow.notification.domain.DeliveryAttempt;
import com.englishflow.notification.domain.NotificationChannel;
import com.englishflow.notification.domain.NotificationCategory;
import com.englishflow.notification.domain.NotificationMessage;
import com.englishflow.notification.domain.NotificationPreference;

import java.util.List;
import java.util.Optional;

/** Port for notification-owned facts; implementations must not write another service schema. */
public interface NotificationFactStore {

    Optional<NotificationPreference> findPreference(String tenantId, String principalId,
            NotificationCategory category, NotificationChannel channel);

    List<NotificationPreference> findPreferences(String tenantId, String principalId);

    /** Persist a preference only when the caller's observed version is still current. */
    boolean compareAndSetPreference(NotificationPreference preference, long expectedVersion);

    void saveMessage(NotificationMessage message);

    Optional<NotificationMessage> findMessage(String tenantId, String principalId, String messageId);

    List<NotificationMessage> findMessages(String tenantId, String principalId, int limit);

    void appendDeliveryAttempt(DeliveryAttempt attempt);

    List<DeliveryAttempt> findDeliveryAttempts(String messageId);

    Optional<StoredIdempotency> findIdempotency(String scope, String key);

    void saveIdempotency(String scope, String key, StoredIdempotency value);
}
