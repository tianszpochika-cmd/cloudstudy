package com.englishflow.notification.port;

import com.englishflow.notification.domain.NotificationChannel;

import java.util.Optional;

/** Read-only consent boundary; consent facts remain owned by the notification/IAM policy layer. */
public interface NotificationConsentPort {

    Optional<Boolean> findConsent(String tenantId, String principalId, NotificationChannel channel);
}
