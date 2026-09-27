package com.englishflow.adminops.risk;

import java.time.Instant;
import java.util.List;

/** Read projection for the governance risk section. Opaque refs only. */
public record RiskCaseView(
        String caseId,
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
