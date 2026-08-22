package com.englishflow.adminops.domain;

import java.time.Instant;

public record CommandResult(
        String commandId,
        String state,
        boolean replayed,
        String targetService,
        String auditId,
        String decisionId,
        String resourceRef,
        Instant acceptedAt) {

    public CommandResult {
        if (commandId == null || commandId.isBlank() || state == null || state.isBlank()
                || targetService == null || targetService.isBlank() || auditId == null || auditId.isBlank()
                || decisionId == null || decisionId.isBlank() || resourceRef == null || resourceRef.isBlank()
                || acceptedAt == null) {
            throw AdminOpsException.invalid("ADMIN_COMMAND_RESULT_INVALID", "command result is incomplete");
        }
    }
}
