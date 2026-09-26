package com.englishflow.adminops.support;

/** Phase 1 support lifecycle. Legacy ticket states are intentionally excluded. */
public enum SupportWorkflowState {
    OPEN, ASSIGNED, WAITING_USER, WAITING_INTERNAL, RESOLVED, CLOSED, REOPENED
}
