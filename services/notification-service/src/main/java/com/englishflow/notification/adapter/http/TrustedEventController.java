package com.englishflow.notification.adapter.http;

import com.englishflow.notification.application.RequestMetadata;
import com.englishflow.notification.application.TrustedEventApplicationService;
import com.englishflow.notification.domain.NotificationChannel;
import com.englishflow.notification.domain.NotificationPrincipalContext;
import com.englishflow.notification.domain.TrustedEventEnvelope;
import com.englishflow.notification.domain.TrustedEventResult;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.Map;

/** Internal server-event ingress; no client-facing event publication is exposed. */
@RestController
@RequestMapping("/internal/v1/notifications")
public final class TrustedEventController {

    private final TrustedEventApplicationService service;
    private final NotificationPrincipalResolver principals;

    public TrustedEventController(TrustedEventApplicationService service,
            NotificationPrincipalResolver principals) {
        this.service = service;
        this.principals = principals;
    }

    @PostMapping("/trusted-events")
    public TrustedEventResult consume(Authentication authentication,
            @Valid @RequestBody TrustedEventRequest request,
            @RequestHeader(value = "X-Request-Id", required = false) String requestId,
            @RequestHeader(value = "traceparent", required = false) String traceparent) {
        NotificationPrincipalContext caller = principals.requireTrustedEventCaller(authentication);
        TrustedEventEnvelope event = new TrustedEventEnvelope(request.eventId(), request.eventName(), request.schema(),
                request.version(), request.occurredAt(), request.aggregateType(), request.aggregateId(),
                request.actorId(), request.traceId(), request.requestId(), request.schemaVersion(), request.dedupeKey(),
                caller.tenantId(), request.principalId(), request.templateId(), request.locale(), request.channel(),
                request.notBefore(), request.attributes());
        return service.consume(caller, event,
                metadata(requestId, traceparent));
    }

    private static RequestMetadata metadata(String requestId, String traceparent) {
        return new RequestMetadata(requestId == null || requestId.isBlank() ? "req-trusted-event" : requestId,
                traceparent == null || traceparent.isBlank() ? "trace-trusted-event" : traceparent);
    }

    public record TrustedEventRequest(
            @NotBlank @Size(max = 128) String eventId,
            @NotBlank @Size(max = 128) String eventName,
            @NotBlank @Size(max = 64) String schema,
            @Min(1) int version,
            @NotNull Instant occurredAt,
            @NotBlank @Size(max = 64) String aggregateType,
            @NotBlank @Size(max = 128) String aggregateId,
            @NotBlank @Size(max = 128) String actorId,
            @NotBlank @Size(max = 128) String traceId,
            @NotBlank @Size(max = 128) String requestId,
            @NotBlank @Size(max = 64) String schemaVersion,
            @NotBlank @Size(max = 255) String dedupeKey,
            @NotBlank @Size(max = 128) String principalId,
            @Size(max = 96) String templateId,
            @Size(max = 20) String locale,
            NotificationChannel channel,
            Instant notBefore,
            Map<String, String> attributes) {
    }
}
