package com.englishflow.assessment.domain;

import java.time.Instant;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Immutable report snapshot; repeated reads return this same calculation, not a live recomputation. */
public record AssessmentReport(
        long reportId,
        String sessionId,
        String tenantId,
        String ownerSubjectId,
        String reportType,
        String status,
        double score,
        double maxScore,
        int completedCount,
        int totalCount,
        String calculationVersion,
        String scorePolicyVersion,
        Instant generatedAt,
        Map<String, Object> metrics,
        List<Map<String, Object>> evidence,
        List<Map<String, Object>> mistakes) {
    public AssessmentReport {
        if (reportId < 1 || sessionId == null || sessionId.isBlank()) throw AssessmentDomainException.invalid("ASM_REPORT_INVALID", "report identity is invalid");
        if (score < 0 || maxScore <= 0 || score > maxScore) throw AssessmentDomainException.invalid("ASM_REPORT_INVALID", "report score is invalid");
        status = status == null ? "READY" : status;
        calculationVersion = calculationVersion == null ? "ASM-REPORT-1" : calculationVersion;
        scorePolicyVersion = scorePolicyVersion == null ? "ASM-RULE-1" : scorePolicyVersion;
        generatedAt = generatedAt == null ? Instant.now() : generatedAt;
        metrics = Collections.unmodifiableMap(new LinkedHashMap<>(metrics == null ? Map.of() : metrics));
        evidence = List.copyOf(evidence == null ? List.of() : evidence);
        mistakes = List.copyOf(mistakes == null ? List.of() : mistakes);
    }

    public Map<String, Object> learnerView() {
        Map<String, Object> view = new LinkedHashMap<>();
        view.put("reportId", reportId);
        view.put("reportType", reportType);
        view.put("status", status);
        view.put("score", score);
        view.put("reportedMaxScore", maxScore);
        view.put("completedCount", completedCount);
        view.put("totalCount", totalCount);
        view.put("calculationVersion", calculationVersion);
        view.put("scorePolicyVersion", scorePolicyVersion);
        view.put("generatedAt", generatedAt.toString());
        view.put("metrics", metrics);
        view.put("evidence", evidence);
        view.put("mistakes", mistakes);
        return Collections.unmodifiableMap(view);
    }
}
