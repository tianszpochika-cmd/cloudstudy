package com.englishflow.adminops.risk;

import java.time.Instant;
import java.util.List;

/** Command result: the updated view, replay flag, and audit link. */
public record RiskDecisionResult(RiskCaseView kase, boolean replayed, String auditId) {
}
