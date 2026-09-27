package com.englishflow.adminops.risk;

/** Risk case lifecycle. Forward-only except UNISOLATE, which returns containment to triage. */
public enum RiskStatus {
    OPEN,
    TRIAGED,
    ACTIONED,
    ESCALATED,
    CLOSED
}
