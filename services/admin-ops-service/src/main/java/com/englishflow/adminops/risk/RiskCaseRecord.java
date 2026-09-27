package com.englishflow.adminops.risk;

import java.time.Instant;
import java.util.List;

/** Stored risk case fact. Mutable only through versioned decisions. */
public record RiskCaseRecord(
        String caseId,
        String tenantId,
        RiskCategory category,
        RiskSeverity severity,
        RiskStatus status,
        RiskSource source,
        String ruleId,
        String ruleVersion,
        String title,
        String subjectRef,
        List<String> evidenceRefs,
        String assigneeNote,
        String containmentRef,
        String escalationTarget,
        String escalationRef,
        String closedReason,
        List<RiskDecisionRecord> decisions,
        String lastAuditId,
        long version,
        Instant createdAt,
        Instant updatedAt) {
}
