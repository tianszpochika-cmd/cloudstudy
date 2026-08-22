package com.englishflow.notification.port;

import com.englishflow.notification.domain.NotificationAuditEvent;

import java.util.List;

/** Append-only audit boundary; implementations must not expose mutation or deletion. */
public interface NotificationAuditEventPort {

    void append(NotificationAuditEvent event);

    List<NotificationAuditEvent> events();
}
