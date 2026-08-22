package com.englishflow.notification.adapter.http;

import com.englishflow.notification.application.DeliveryResult;
import com.englishflow.notification.application.NotificationApplicationService;
import com.englishflow.notification.application.QueueNotificationCommand;
import com.englishflow.notification.application.RequestMetadata;
import com.englishflow.notification.application.UpdatePreferenceCommand;
import com.englishflow.notification.domain.DeliveryAttempt;
import com.englishflow.notification.domain.IdempotencyKey;
import com.englishflow.notification.domain.NotificationChannel;
import com.englishflow.notification.domain.NotificationMessage;
import com.englishflow.notification.domain.NotificationPrincipalContext;
import com.englishflow.notification.domain.NotificationPreference;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.LinkedHashMap;
import java.util.Map;

@RestController
@RequestMapping("/internal/v1/notifications")
public final class NotificationController {

    private final NotificationApplicationService service;
    private final NotificationPrincipalResolver principals;

    public NotificationController(NotificationApplicationService service,
            NotificationPrincipalResolver principals) {
        this.service = service;
        this.principals = principals;
    }

    @GetMapping("/preferences")
    public List<Map<String, Object>> preferences(Authentication authentication) {
        return service.preferences(principals.require(authentication)).stream()
                .map(NotificationController::preferenceView).toList();
    }

    @PutMapping("/preferences/{notificationType}/{channel}")
    public NotificationPreference updatePreference(Authentication authentication,
            @PathVariable String notificationType,
            @PathVariable NotificationChannel channel,
            @Valid @RequestBody UpdatePreferenceRequest request,
            @RequestHeader("Idempotency-Key") String idempotencyKey,
            @RequestHeader(value = "X-Request-Id", required = false) String requestId,
            @RequestHeader(value = "traceparent", required = false) String traceparent) {
        NotificationPrincipalContext context = principals.require(authentication);
        return service.updatePreference(context,
                new UpdatePreferenceCommand(notificationType, channel, request.enabled(), request.locale(),
                        request.expectedVersion() == null ? -1 : request.expectedVersion()),
                new IdempotencyKey(idempotencyKey), metadata(requestId, traceparent));
    }

    @GetMapping("/messages")
    public List<Map<String, Object>> messages(Authentication authentication,
            @RequestParam(defaultValue = "50") int limit) {
        return service.messages(principals.require(authentication), limit).stream()
                .map(NotificationController::messageView).toList();
    }

    @PostMapping("/messages")
    public NotificationMessage queue(Authentication authentication,
            @Valid @RequestBody QueueNotificationRequest request,
            @RequestHeader("Idempotency-Key") String idempotencyKey,
            @RequestHeader(value = "X-Request-Id", required = false) String requestId,
            @RequestHeader(value = "traceparent", required = false) String traceparent) {
        NotificationPrincipalContext context = principals.require(authentication);
        return service.queue(context, new QueueNotificationCommand(request.notificationType(), request.channel(),
                request.templateKey(), request.templateVersion(), request.title(), request.safeBody(),
                request.contentVersion()), new IdempotencyKey(idempotencyKey), metadata(requestId, traceparent));
    }

    @PostMapping("/messages/{messageId}/delivery")
    public DeliveryResult deliver(Authentication authentication, @PathVariable String messageId,
            @RequestHeader("Idempotency-Key") String idempotencyKey,
            @RequestHeader(value = "X-Request-Id", required = false) String requestId,
            @RequestHeader(value = "traceparent", required = false) String traceparent) {
        return service.deliver(principals.require(authentication), messageId,
                new IdempotencyKey(idempotencyKey), metadata(requestId, traceparent));
    }

    @GetMapping("/messages/{messageId}/delivery-attempts")
    public List<DeliveryAttempt> deliveryAttempts(Authentication authentication, @PathVariable String messageId) {
        return service.deliveryAttempts(principals.require(authentication), messageId);
    }

    private static RequestMetadata metadata(String requestId, String traceparent) {
        RequestMetadata generated = RequestMetadata.generated();
        return new RequestMetadata(requestId == null || requestId.isBlank() ? generated.requestId() : requestId,
                traceparent == null || traceparent.isBlank() ? generated.traceId() : traceparent);
    }

    public record UpdatePreferenceRequest(
            @NotNull Boolean enabled,
            @NotBlank @Size(max = 20) String locale,
            Long expectedVersion) {
    }

    public record QueueNotificationRequest(
            @NotBlank @Size(max = 80) String notificationType,
            @NotNull NotificationChannel channel,
            @NotBlank @Size(max = 120) String templateKey,
            @NotBlank @Size(max = 40) String templateVersion,
            @NotBlank @Size(max = 160) String title,
            @NotBlank @Size(max = 4000) String safeBody,
            @NotBlank @Size(max = 80) String contentVersion) {
    }

    private static Map<String, Object> preferenceView(NotificationPreference preference) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("notificationType", preference.notificationType());
        result.put("channel", preference.channel());
        result.put("enabled", preference.enabled());
        result.put("locale", preference.locale());
        result.put("version", preference.version());
        result.put("updatedAt", preference.updatedAt());
        return result;
    }

    private static Map<String, Object> messageView(NotificationMessage message) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("messageId", message.messageId());
        result.put("notificationType", message.notificationType());
        result.put("channel", message.channel());
        result.put("title", message.title());
        result.put("safeBody", message.safeBody());
        result.put("contentVersion", message.contentVersion());
        result.put("createdAt", message.createdAt());
        return result;
    }
}
