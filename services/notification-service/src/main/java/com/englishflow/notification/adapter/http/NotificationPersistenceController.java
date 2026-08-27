package com.englishflow.notification.adapter.http;

import com.englishflow.notification.config.NotificationPersistenceProperties;
import com.englishflow.notification.domain.NotificationAccessPolicy;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.Map;

/** Authenticated diagnostic seam; it makes the active durable/fail-closed mode explicit. */
@RestController
@RequestMapping("/internal/v1/notifications")
public final class NotificationPersistenceController {

    private final NotificationPrincipalResolver principals;
    private final NotificationAccessPolicy access;
    private final NotificationPersistenceProperties properties;

    public NotificationPersistenceController(NotificationPrincipalResolver principals,
            NotificationAccessPolicy access, NotificationPersistenceProperties properties) {
        this.principals = principals;
        this.access = access;
        this.properties = properties;
    }

    @GetMapping("/persistence")
    public Map<String, Object> status(Authentication authentication) {
        access.requirePermission(principals.require(authentication), "notification.read");
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("mode", properties.getMode());
        result.put("durable", properties.isJdbc());
        result.put("schema", properties.getSchema());
        return result;
    }
}
