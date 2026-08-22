package com.englishflow.notification.port;

import com.englishflow.notification.application.RequestMetadata;
import com.englishflow.notification.domain.NotificationPrincipalContext;
import com.englishflow.notification.domain.TrustedEventEnvelope;
import com.englishflow.notification.domain.TrustedEventResult;

/** Internal trusted-event ingress seam for a Kafka/HTTP adapter. */
public interface TrustedEventPort {

    TrustedEventResult consume(NotificationPrincipalContext consumer, TrustedEventEnvelope event,
            RequestMetadata metadata);
}
