package com.englishflow.content.domain;

import java.time.Instant;
import java.util.List;
import java.util.Objects;

/**
 * Immutable server-side validation fact bound to one version payload.
 *
 * <p>A report never endorses anything but the exact (version, hash) it was
 * computed for: gates re-query by that key, so editing content after a PASS
 * honestly requires re-validation. {@code vr_} IDs follow the B9 contract.
 */
public record ValidationReport(
        String reportId,
        long reportVersion,
        long contentVersionId,
        String payloadHash,
        String ruleVersion,
        boolean passed,
        List<ContentAutoValidation.Finding> findings,
        List<String> mediaRefs,
        String checkedBy,
        Instant checkedAt) {

    public ValidationReport {
        if (reportId == null || !reportId.matches("vr_[A-Za-z0-9._:-]{15,127}")) {
            throw new IllegalArgumentException("reportId must be a vr_ server reference");
        }
        if (reportVersion < 1) {
            throw new IllegalArgumentException("report version must be positive");
        }
        if (contentVersionId < 1) {
            throw new IllegalArgumentException("content version id must be positive");
        }
        if (payloadHash == null || !payloadHash.matches("[a-fA-F0-9]{64}")) {
            throw new IllegalArgumentException("payload hash must be a 64-hex digest");
        }
        if (ruleVersion == null || ruleVersion.isBlank()) {
            throw new IllegalArgumentException("rule version is required");
        }
        findings = findings == null ? List.of() : List.copyOf(findings);
        mediaRefs = mediaRefs == null ? List.of() : List.copyOf(mediaRefs);
        if (checkedBy == null || checkedBy.isBlank()) {
            throw new IllegalArgumentException("checker identity is required");
        }
        Objects.requireNonNull(checkedAt, "check time is required");
    }

    public long blockerCount() {
        return findings.stream().filter(finding -> "BLOCKER".equals(finding.severity())).count();
    }
}
