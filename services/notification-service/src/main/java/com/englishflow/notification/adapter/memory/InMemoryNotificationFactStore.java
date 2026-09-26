package com.englishflow.notification.adapter.memory;

import com.englishflow.notification.domain.DeliveryAttempt;
import com.englishflow.notification.domain.NotificationChannel;
import com.englishflow.notification.domain.NotificationCategory;
import com.englishflow.notification.domain.NotificationMessage;
import com.englishflow.notification.domain.NotificationPreference;
import com.englishflow.notification.port.NotificationFactStore;
import com.englishflow.notification.port.StoredIdempotency;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/** Test/local adapter. Production replaces this with service-owned persistence. */
public final class InMemoryNotificationFactStore implements NotificationFactStore {

    private final Map<String, NotificationPreference> preferences = new LinkedHashMap<>();
    private final Map<String, NotificationMessage> messages = new LinkedHashMap<>();
    private final Map<String, List<DeliveryAttempt>> attempts = new LinkedHashMap<>();
    private final Map<String, StoredIdempotency> idempotency = new LinkedHashMap<>();

    @Override
    public synchronized Optional<NotificationPreference> findPreference(String tenantId, String principalId,
            NotificationCategory category, NotificationChannel channel) {
        return Optional.ofNullable(preferences.get(preferenceKey(tenantId, principalId, category, channel)));
    }

    @Override
    public synchronized List<NotificationPreference> findPreferences(String tenantId, String principalId) {
        return preferences.values().stream()
                .filter(value -> value.tenantId().equals(tenantId) && value.principalId().equals(principalId))
                .toList();
    }

    @Override
    public synchronized boolean compareAndSetPreference(NotificationPreference preference, long expectedVersion) {
        String key = preferenceKey(preference.tenantId(), preference.principalId(),
                preference.category(), preference.channel());
        NotificationPreference current = preferences.get(key);
        long currentVersion = current == null ? 0 : current.version();
        if (expectedVersion < 0 || currentVersion != expectedVersion
                || preference.version() != expectedVersion + 1) {
            return false;
        }
        preferences.put(key, preference);
        return true;
    }

    @Override
    public synchronized void saveMessage(NotificationMessage message) {
        messages.put(messageKey(message.tenantId(), message.principalId(), message.messageId()), message);
    }

    @Override
    public synchronized Optional<NotificationMessage> findMessage(String tenantId, String principalId,
            String messageId) {
        return Optional.ofNullable(messages.get(messageKey(tenantId, principalId, messageId)));
    }

    @Override
    public synchronized List<NotificationMessage> findMessages(String tenantId, String principalId, int limit) {
        int boundedLimit = Math.max(1, Math.min(limit, 100));
        return messages.values().stream()
                .filter(value -> value.tenantId().equals(tenantId) && value.principalId().equals(principalId))
                .sorted((left, right) -> right.createdAt().compareTo(left.createdAt()))
                .limit(boundedLimit)
                .toList();
    }

    @Override
    public synchronized void appendDeliveryAttempt(DeliveryAttempt attempt) {
        attempts.computeIfAbsent(attempt.messageId(), ignored -> new ArrayList<>()).add(attempt);
    }

    @Override
    public synchronized List<DeliveryAttempt> findDeliveryAttempts(String messageId) {
        return List.copyOf(attempts.getOrDefault(messageId, List.of()));
    }

    @Override
    public synchronized Optional<StoredIdempotency> findIdempotency(String scope, String key) {
        return Optional.ofNullable(idempotency.get(idempotencyKey(scope, key)));
    }

    @Override
    public synchronized void saveIdempotency(String scope, String key, StoredIdempotency value) {
        idempotency.put(idempotencyKey(scope, key), value);
    }

    private static String preferenceKey(String tenantId, String principalId, NotificationCategory category,
            NotificationChannel channel) {
        return tenantId + '|' + principalId + '|' + category + '|' + channel;
    }

    private static String messageKey(String tenantId, String principalId, String messageId) {
        return tenantId + '|' + principalId + '|' + messageId;
    }

    private static String idempotencyKey(String scope, String key) {
        return scope + '|' + key;
    }
}
