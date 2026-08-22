package com.englishflow.notification.domain;

public record RecoveryCommand(String taskId, RecoveryAction action, String reasonCode) {

    public RecoveryCommand {
        if (taskId == null || taskId.isBlank() || action == null
                || reasonCode == null || !reasonCode.matches("[A-Za-z0-9._:-]{1,100}")) {
            throw NotificationDomainException.invalid("recovery command is invalid");
        }
    }
}
