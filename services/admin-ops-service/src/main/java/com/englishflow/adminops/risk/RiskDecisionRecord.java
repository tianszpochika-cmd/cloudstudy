package com.englishflow.adminops.risk;

import java.time.Instant;
import java.util.List;

/** Immutable decision fact embedded in a case; the audit trail for the case lifecycle. */
public record RiskDecisionRecord(
        String decisionId,
        RiskCommand command,
        String reason,
        String decidedBy,
        Instant decidedAt,
        String containmentRef,
        String escalationTarget,
        String escalationRef,
        String assigneeNote) {
}
