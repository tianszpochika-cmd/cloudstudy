package com.englishflow.adminops.risk;

/** Analyst-assessed severity. Rule hits propose it; analysts may raise it, never silently lower it on file. */
public enum RiskSeverity {
    LOW,
    MEDIUM,
    HIGH,
    CRITICAL
}
