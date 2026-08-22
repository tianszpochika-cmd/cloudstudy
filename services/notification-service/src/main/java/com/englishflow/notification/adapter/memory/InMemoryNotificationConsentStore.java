package com.englishflow.notification.adapter.memory;

import com.englishflow.notification.domain.NotificationChannel;
import com.englishflow.notification.port.NotificationConsentPort;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;

/** Local/test consent adapter. Missing consent remains unknown and is fail-closed by the consumer. */
public final class InMemoryNotificationConsentStore implements NotificationConsentPort {

    private final Map<String, Boolean> consents = new LinkedHashMap<>();

    @Override
    public synchronized Optional<Boolean> findConsent(String tenantId, String principalId,
            NotificationChannel channel) {
        return Optional.ofNullable(consents.get(key(tenantId, principalId, channel)));
    }

    public synchronized void setConsent(String tenantId, String principalId, NotificationChannel channel,
            boolean granted) {
        consents.put(key(tenantId, principalId, channel), granted);
    }

    private static String key(String tenantId, String principalId, NotificationChannel channel) {
        return tenantId + '|' + principalId + '|' + channel;
    }
}
