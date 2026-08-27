package com.englishflow.notification.adapter.failclosed;

import com.englishflow.notification.domain.NotificationChannel;
import com.englishflow.notification.domain.NotificationDomainException;
import com.englishflow.notification.port.NotificationConsentPort;

import java.util.Optional;

/** Missing consent storage is unavailable, never an implicit grant. */
public final class FailClosedNotificationConsentStore implements NotificationConsentPort {

    @Override
    public Optional<Boolean> findConsent(String tenantId, String principalId, NotificationChannel channel) {
        throw new NotificationDomainException(NotificationDomainException.Code.NETWORK_UNAVAILABLE,
                "notification consent persistence is not configured");
    }
}
