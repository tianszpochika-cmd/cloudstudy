package com.englishflow.notification.adapter.http;

import com.englishflow.notification.application.NotificationRecoveryApplicationService;
import com.englishflow.notification.application.RequestMetadata;
import com.englishflow.notification.domain.RecoveryAction;
import com.englishflow.notification.domain.RecoveryCommand;
import com.englishflow.notification.domain.RecoveryResult;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Authorized manual recovery entry; ordinary learners cannot invoke it. */
@RestController
@RequestMapping("/internal/v1/notifications")
public final class NotificationRecoveryController {

    private final NotificationRecoveryApplicationService service;
    private final NotificationPrincipalResolver principals;

    public NotificationRecoveryController(NotificationRecoveryApplicationService service,
            NotificationPrincipalResolver principals) {
        this.service = service;
        this.principals = principals;
    }

    @PostMapping("/recovery")
    public RecoveryResult recover(Authentication authentication,
            @Valid @RequestBody RecoveryRequest request,
            @RequestHeader(value = "X-Request-Id", required = false) String requestId,
            @RequestHeader(value = "traceparent", required = false) String traceparent) {
        return service.recover(principals.requireTrustedEventCaller(authentication),
                new RecoveryCommand(request.taskId(), request.action(), request.reasonCode()),
                new RequestMetadata(requestId == null || requestId.isBlank() ? "req-recovery" : requestId,
                        traceparent == null || traceparent.isBlank() ? "trace-recovery" : traceparent));
    }

    public record RecoveryRequest(
            @NotBlank @Size(max = 128) String taskId,
            @NotNull RecoveryAction action,
            @NotBlank @Size(max = 100) String reasonCode) {
    }
}
