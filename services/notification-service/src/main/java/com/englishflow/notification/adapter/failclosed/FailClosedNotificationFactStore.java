package com.englishflow.notification.adapter.failclosed;

import com.englishflow.notification.domain.DeliveryAttempt;
import com.englishflow.notification.domain.NotificationChannel;
import com.englishflow.notification.domain.NotificationCategory;
import com.englishflow.notification.domain.NotificationDomainException;
import com.englishflow.notification.domain.NotificationMessage;
import com.englishflow.notification.domain.NotificationPreference;
import com.englishflow.notification.port.NotificationFactStore;
import com.englishflow.notification.port.StoredIdempotency;

import java.util.List;
import java.util.Optional;

/** Prevents a deployable process from silently accepting notification facts in memory. */
public final class FailClosedNotificationFactStore implements NotificationFactStore {

    @Override
    public Optional<NotificationPreference> findPreference(String tenantId, String principalId,
            NotificationCategory category, NotificationChannel channel) {
        throw unavailable();
    }

    @Override
    public List<NotificationPreference> findPreferences(String tenantId, String principalId) {
        throw unavailable();
    }

    @Override
    public boolean compareAndSetPreference(NotificationPreference preference, long expectedVersion) {
        throw unavailable();
    }

    @Override
    public void saveMessage(NotificationMessage message) {
        throw unavailable();
    }

    @Override
    public Optional<NotificationMessage> findMessage(String tenantId, String principalId, String messageId) {
        throw unavailable();
    }

    @Override
    public List<NotificationMessage> findMessages(String tenantId, String principalId, int limit) {
        throw unavailable();
    }

    @Override
    public void appendDeliveryAttempt(DeliveryAttempt attempt) {
        throw unavailable();
    }

    @Override
    public List<DeliveryAttempt> findDeliveryAttempts(String messageId) {
        throw unavailable();
    }

    @Override
    public Optional<StoredIdempotency> findIdempotency(String scope, String key) {
        throw unavailable();
    }

    @Override
    public void saveIdempotency(String scope, String key, StoredIdempotency value) {
        throw unavailable();
    }

    private static NotificationDomainException unavailable() {
        return new NotificationDomainException(NotificationDomainException.Code.NETWORK_UNAVAILABLE,
                "notification durable persistence is not configured");
    }
}
