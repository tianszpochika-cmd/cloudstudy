package com.englishflow.content.domain;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * M3-003 automatic validation: copyright/source/stage/answer-leak/structure.
 * Pure function over the draft fields plus the version rights; the caller decides
 * whether a failure blocks (submit/publish) or only reports (auto endpoint).
 */
public final class ContentAutoValidation {

    private static final Set<String> ALLOWED_LEVELS = Set.of("A1", "A2", "B1", "B2", "C1", "C2");
    private static final String RULE_VERSION = "P1_AUTO_VALIDATE_V1";

    private ContentAutoValidation() {
    }

    public record Finding(String code, String severity, String detail) {
    }

    public record Report(boolean passed, String ruleVersion, List<Finding> findings, Map<String, Object> summary) {
    }

    public static Report validate(Map<String, Object> draft, ContentRights rights, Instant now) {
        List<Finding> findings = new ArrayList<>();
        Map<String, Object> fields = draft == null ? Map.of() : draft;
        // 1. copyright / source / licence presence
        if (rights == null) {
            findings.add(new Finding("RIGHTS_MISSING", "BLOCKER", "version rights are missing"));
        } else {
            if (rights.sourceCode() == null || rights.sourceCode().isBlank()) {
                findings.add(new Finding("RIGHTS_SOURCE_MISSING", "BLOCKER", "rights sourceCode is required"));
            }
            if (rights.licenseCode() == null || rights.licenseCode().isBlank()) {
                findings.add(new Finding("RIGHTS_LICENSE_MISSING", "BLOCKER", "rights licenseCode is required"));
            }
            if (rights.authorizationEvidenceRef() == null || rights.authorizationEvidenceRef().isBlank()) {
                findings.add(new Finding("RIGHTS_EVIDENCE_MISSING", "BLOCKER", "authorization evidence ref is required"));
            }
            if (!rights.allowsLearning()) {
                findings.add(new Finding("RIGHTS_LEARNING_DENIED", "BLOCKER", "rights do not allow learning"));
            }
            if (rights.expiresAt() != null && !rights.expiresAt().isAfter(now)) {
                findings.add(new Finding("RIGHTS_EXPIRED", "BLOCKER", "rights window has expired"));
            }
            if (rights.startsAt() != null && rights.startsAt().isAfter(now)) {
                findings.add(new Finding("RIGHTS_NOT_YET_VALID", "BLOCKER", "rights window has not started"));
            }
        }
        // 2. stage / target level
        Object level = fields.get("targetLevel");
        if (level instanceof String text && !text.isBlank() && !ALLOWED_LEVELS.contains(text.trim().toUpperCase())) {
            findings.add(new Finding("STAGE_INVALID", "BLOCKER", "targetLevel must be one of A1..C2"));
        }
        // 3. answer-leak scan: public projection must never carry restricted keys
        if (containsRestrictedKey(fields)) {
            findings.add(new Finding("ANSWER_LEAK_DETECTED", "BLOCKER", "draft carries answer/solution keys that must stay assessment-only"));
        }
        // 4. structure: kind-present payload with at least a title/summary/items shape
        Object title = fields.get("title");
        Object items = fields.get("items");
        if ((title == null || title.toString().isBlank()) && !(items instanceof List<?> list && !list.isEmpty())) {
            findings.add(new Finding("STRUCTURE_INCOMPLETE", "BLOCKER", "draft needs a title or a non-empty items list"));
        }
        boolean passed = findings.stream().noneMatch(f -> "BLOCKER".equals(f.severity()));
        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("ruleVersion", RULE_VERSION);
        summary.put("checkedAt", now.toString());
        summary.put("findingCount", findings.size());
        summary.put("blockers", findings.stream().filter(f -> "BLOCKER".equals(f.severity())).count());
        return new Report(passed, RULE_VERSION, List.copyOf(findings), Map.copyOf(summary));
    }

    private static boolean containsRestrictedKey(Object value) {
        if (value instanceof Map<?, ?> map) {
            for (Map.Entry<?, ?> entry : map.entrySet()) {
                if (ContentProjectionPolicy.isAnswerRuleKey(String.valueOf(entry.getKey()))) {
                    return true;
                }
                if (containsRestrictedKey(entry.getValue())) {
                    return true;
                }
            }
            return false;
        }
        if (value instanceof List<?> list) {
            for (Object item : list) {
                if (containsRestrictedKey(item)) {
                    return true;
                }
            }
        }
        return false;
    }
}
