package com.englishflow.notification.port;

import com.englishflow.notification.application.RequestMetadata;
import com.englishflow.notification.domain.NotificationPrincipalContext;
import com.englishflow.notification.domain.RecoveryCommand;
import com.englishflow.notification.domain.RecoveryResult;

/** Authorized manual recovery seam for workflow-service/admin operations. */
public interface NotificationRecoveryPort {

    RecoveryResult recover(NotificationPrincipalContext operator, RecoveryCommand command,
            RequestMetadata metadata);
}
