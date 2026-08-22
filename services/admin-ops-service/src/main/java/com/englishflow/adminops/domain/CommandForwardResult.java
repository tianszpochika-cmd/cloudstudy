package com.englishflow.adminops.domain;

import java.time.Instant;

public record CommandForwardResult(
        String commandId,
        String targetService,
        String dispatchState,
        Instant acceptedAt) {

    public CommandForwardResult {
        if (commandId == null || commandId.isBlank() || targetService == null || targetService.isBlank()
                || dispatchState == null || dispatchState.isBlank() || acceptedAt == null) {
            throw AdminOpsException.invalid("ADMIN_FORWARD_RESULT_INVALID", "forward result is incomplete");
        }
    }
}
