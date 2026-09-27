package com.englishflow.adminops.risk;

import java.time.Instant;
import java.util.List;

/** Analyst filing draft. Tenant and filer come from the verified principal. */
public record RiskFileDraft(
        RiskCategory category,
        RiskSeverity severity,
        String title,
        String subjectRef,
        List<String> evidenceRefs,
        String note) {
}
