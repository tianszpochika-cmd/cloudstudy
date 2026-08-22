package com.englishflow.notification.adapter.http;

import com.englishflow.notification.application.OfflineSyncApplicationService;
import com.englishflow.notification.application.RequestMetadata;
import com.englishflow.notification.domain.OfflineChange;
import com.englishflow.notification.domain.OfflineSyncResult;
import com.englishflow.notification.domain.NotificationPrincipalContext;
import com.englishflow.notification.domain.RecoveryAction;
import com.englishflow.notification.domain.RecoveryCommand;
import com.englishflow.notification.domain.RecoveryResult;
import com.englishflow.notification.domain.SyncCursor;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.Map;

@RestController
@RequestMapping("/internal/v1/sync")
public final class OfflineSyncController {

    private final OfflineSyncApplicationService service;
    private final NotificationPrincipalResolver principals;

    public OfflineSyncController(OfflineSyncApplicationService service,
            NotificationPrincipalResolver principals) {
        this.service = service;
        this.principals = principals;
    }

    @GetMapping("/cursor")
    public SyncCursor cursor(Authentication authentication) {
        return service.cursor(principals.require(authentication));
    }

    @PostMapping("/changes")
    public OfflineSyncResult sync(Authentication authentication,
            @Valid @RequestBody OfflineChangeRequest request,
            @RequestHeader(value = "X-Request-Id", required = false) String requestId,
            @RequestHeader(value = "traceparent", required = false) String traceparent) {
        NotificationPrincipalContext context = principals.require(authentication);
        return service.sync(context, new OfflineChange(context.tenantId(), context.principalId(), context.deviceId(),
                request.clientEventId(), request.clientSeq(), request.entityType(), request.entityId(),
                request.operation(), request.baseVersion(),
                new com.englishflow.notification.domain.OfflineVector(request.vector()),
                request.payloadDigest(), request.occurredAt() == null ? Instant.now() : request.occurredAt()),
                metadata(requestId, traceparent));
    }

    @PostMapping("/recovery")
    public RecoveryResult recover(Authentication authentication,
            @Valid @RequestBody RecoveryRequest request,
            @RequestHeader(value = "X-Request-Id", required = false) String requestId,
            @RequestHeader(value = "traceparent", required = false) String traceparent) {
        return service.recover(principals.require(authentication),
                new RecoveryCommand(request.taskId(), request.action(), request.reasonCode()),
                metadata(requestId, traceparent));
    }

    private static RequestMetadata metadata(String requestId, String traceparent) {
        RequestMetadata generated = RequestMetadata.generated();
        return new RequestMetadata(requestId == null || requestId.isBlank() ? generated.requestId() : requestId,
                traceparent == null || traceparent.isBlank() ? generated.traceId() : traceparent);
    }

    public record OfflineChangeRequest(
            @NotBlank @Size(max = 120) String clientEventId,
            @Min(1) long clientSeq,
            @NotBlank @Size(max = 80) String entityType,
            @NotBlank @Size(max = 160) String entityId,
            @NotBlank @Size(max = 40) String operation,
            @Min(0) long baseVersion,
            @NotNull Map<String, Long> vector,
            @NotBlank @Size(min = 64, max = 64) String payloadDigest,
            Instant occurredAt) {
    }

    public record RecoveryRequest(
            @NotBlank @Size(max = 120) String taskId,
            @NotNull RecoveryAction action,
            @NotBlank @Size(max = 100) String reasonCode) {
    }
}
