package com.englishflow.notification.domain;

public enum WorkflowState {
    QUEUED,
    RUNNING,
    RETRY_SCHEDULED,
    SUCCEEDED,
    CONFLICT,
    FAILED,
    DEAD_LETTER,
    MANUAL_RECOVERY
}
