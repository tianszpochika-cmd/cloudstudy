package com.englishflow.notification.port;

import com.englishflow.notification.domain.RetryDispatchResult;
import com.englishflow.notification.domain.NotificationPrincipalContext;
import com.englishflow.notification.application.RequestMetadata;

/** Internal workflow worker seam for due notification delivery. */
public interface NotificationRetryPort {

    RetryDispatchResult dispatch(NotificationPrincipalContext worker, String taskId, RequestMetadata metadata);
}
