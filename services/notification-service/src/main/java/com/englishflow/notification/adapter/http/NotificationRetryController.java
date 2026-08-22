package com.englishflow.notification.adapter.http;

import com.englishflow.notification.application.NotificationRetryApplicationService;
import com.englishflow.notification.application.RequestMetadata;
import com.englishflow.notification.domain.RetryDispatchResult;
import com.englishflow.notification.domain.WorkflowTask;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.Map;

/** Internal worker entry for due delivery tasks; delay is enforced in the application layer. */
@RestController
@RequestMapping("/internal/v1/notifications")
public final class NotificationRetryController {

    private final NotificationRetryApplicationService service;
    private final NotificationPrincipalResolver principals;

    public NotificationRetryController(NotificationRetryApplicationService service,
            NotificationPrincipalResolver principals) {
        this.service = service;
        this.principals = principals;
    }

    @PostMapping("/retry")
    public Map<String, Object> dispatch(Authentication authentication,
            @Valid @RequestBody RetryRequest request,
            @RequestHeader(value = "X-Request-Id", required = false) String requestId,
            @RequestHeader(value = "traceparent", required = false) String traceparent) {
        RetryDispatchResult result = service.dispatch(principals.requireTrustedEventCaller(authentication), request.taskId(),
                new RequestMetadata(requestId == null || requestId.isBlank() ? "req-retry" : requestId,
                        traceparent == null || traceparent.isBlank() ? "trace-retry" : traceparent));
        return safeView(result);
    }

    private static Map<String, Object> safeView(RetryDispatchResult result) {
        WorkflowTask task = result.workflow();
        Map<String, Object> workflow = new LinkedHashMap<>();
        workflow.put("taskId", task.taskId());
        workflow.put("action", task.action());
        workflow.put("aggregateType", task.aggregateType());
        workflow.put("aggregateId", task.aggregateId());
        workflow.put("state", task.state().name());
        workflow.put("attempt", task.attempt());
        workflow.put("maxAttempts", task.maxAttempts());
        workflow.put("reasonCode", task.reasonCode());
        workflow.put("nextRunAt", task.nextRunAt());
        workflow.put("updatedAt", task.updatedAt());

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("taskId", result.taskId());
        response.put("status", result.status().name());
        if (result.delivery() != null) {
            // DeliveryAttempt contains recipient/channel details; B12 exposes only its existence.
            response.put("delivery", Map.of());
        }
        response.put("workflow", workflow);
        response.put("reasonCode", result.reasonCode());
        response.put("nextAttemptAt", result.nextAttemptAt());
        return response;
    }

    public record RetryRequest(@NotBlank @Size(max = 128) String taskId) {
    }
}
