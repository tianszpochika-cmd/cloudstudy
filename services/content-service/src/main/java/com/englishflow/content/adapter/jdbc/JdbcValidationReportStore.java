package com.englishflow.content.adapter.jdbc;

import com.englishflow.content.domain.ContentAutoValidation;
import com.englishflow.content.domain.ContentOperationException;
import com.englishflow.content.domain.ValidationReport;
import com.englishflow.content.port.ValidationReportStore;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.springframework.dao.DataAccessException;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.JdbcTemplate;

import tools.jackson.databind.ObjectMapper;

/** Content-service-owned MySQL validation-report store. */
public final class JdbcValidationReportStore implements ValidationReportStore {

    private final JdbcTemplate jdbc;
    private final ObjectMapper objectMapper;

    public JdbcValidationReportStore(JdbcTemplate jdbc, ObjectMapper objectMapper) {
        this.jdbc = jdbc;
        this.objectMapper = objectMapper;
    }

    @Override
    public long nextReportVersion(long contentVersionId) {
        try {
            Long max = jdbc.queryForObject("""
                    SELECT COALESCE(MAX(report_version), 0)
                      FROM content_validation_report
                     WHERE content_version_id = ?
                    """, Long.class, contentVersionId);
            return (max == null ? 0L : max) + 1L;
        } catch (DataAccessException failure) {
            throw ContentOperationException.unavailable(
                    "CONTENT_PERSISTENCE_UNAVAILABLE", "validation report version could not be allocated");
        }
    }

    @Override
    public ValidationReport save(ValidationReport report) {
        try {
            jdbc.update("""
                    INSERT INTO content_validation_report
                        (report_id, report_version, content_version_id, payload_hash, rule_version, passed,
                         finding_count, blocker_count, findings_json, media_refs_json,
                         checked_by, checked_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON DUPLICATE KEY UPDATE
                        passed = VALUES(passed),
                        finding_count = VALUES(finding_count),
                        blocker_count = VALUES(blocker_count),
                        findings_json = VALUES(findings_json),
                        media_refs_json = VALUES(media_refs_json),
                        checked_by = VALUES(checked_by),
                        checked_at = VALUES(checked_at)
                    """,
                    report.reportId(), report.reportVersion(), report.contentVersionId(),
                    report.payloadHash().toLowerCase(),
                    report.ruleVersion(), report.passed(),
                    report.findings().size(), report.blockerCount(),
                    writeJson(findings(report)), writeJson(report.mediaRefs()),
                    report.checkedBy(), Timestamp.from(report.checkedAt()));
            return report;
        } catch (DuplicateKeyException conflict) {
            // Same binding, same rule: the stored fact wins, never overwritten
            // with a divergent identity. Re-read instead of failing the replay.
            return findLatest(report.contentVersionId(), report.payloadHash()).orElseThrow(() ->
                    ContentOperationException.unavailable(
                            "CONTENT_PERSISTENCE_UNAVAILABLE", "stored validation report could not be read"));
        } catch (DataAccessException failure) {
            throw ContentOperationException.unavailable(
                    "CONTENT_PERSISTENCE_UNAVAILABLE", "validation report could not be stored");
        }
    }

    @Override
    public Optional<ValidationReport> findLatest(long contentVersionId, String payloadHash) {
        if (payloadHash == null) {
            return Optional.empty();
        }
        try {
            List<ValidationReport> rows = jdbc.query("""
                    SELECT report_id, report_version, content_version_id, payload_hash, rule_version, passed,
                           finding_count, blocker_count, findings_json, media_refs_json,
                           checked_by, checked_at
                      FROM content_validation_report
                     WHERE content_version_id = ? AND payload_hash = ?
                     ORDER BY checked_at DESC, report_id DESC
                     LIMIT 1
                    """, this::mapRow, contentVersionId, payloadHash.toLowerCase());
            return rows.isEmpty() ? Optional.empty() : Optional.of(rows.get(0));
        } catch (DataAccessException failure) {
            throw ContentOperationException.unavailable(
                    "CONTENT_PERSISTENCE_UNAVAILABLE", "validation report could not be read");
        }
    }

    private ValidationReport mapRow(ResultSet resultSet, int row) throws SQLException {
        List<ContentAutoValidation.Finding> findings = new ArrayList<>();
        for (Map<String, Object> raw : readFindingList(resultSet.getString("findings_json"))) {
            findings.add(new ContentAutoValidation.Finding(
                    String.valueOf(raw.getOrDefault("code", "")),
                    String.valueOf(raw.getOrDefault("severity", "")),
                    String.valueOf(raw.getOrDefault("detail", ""))));
        }
        List<String> mediaRefs = new ArrayList<>();
        for (Object raw : readList(resultSet.getString("media_refs_json"))) {
            if (raw != null) {
                mediaRefs.add(String.valueOf(raw));
            }
        }
        Timestamp checkedAt = resultSet.getTimestamp("checked_at");
        return new ValidationReport(
                resultSet.getString("report_id"),
                resultSet.getLong("report_version"),
                resultSet.getLong("content_version_id"),
                resultSet.getString("payload_hash"),
                resultSet.getString("rule_version"),
                resultSet.getBoolean("passed"),
                List.copyOf(findings),
                List.copyOf(mediaRefs),
                resultSet.getString("checked_by"),
                checkedAt == null ? Instant.EPOCH : checkedAt.toInstant());
    }

    private List<Map<String, Object>> findings(ValidationReport report) {
        List<Map<String, Object>> result = new ArrayList<>();
        for (ContentAutoValidation.Finding finding : report.findings()) {
            Map<String, Object> entry = new LinkedHashMap<>();
            entry.put("code", finding.code());
            entry.put("severity", finding.severity());
            entry.put("detail", finding.detail());
            result.add(entry);
        }
        return result;
    }

    private String writeJson(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (Exception failure) {
            throw ContentOperationException.unavailable(
                    "CONTENT_PERSISTENCE_UNAVAILABLE", "validation report could not be serialized");
        }
    }

    @SuppressWarnings("unchecked")
    private List<Object> readList(String json) {
        if (json == null || json.isBlank()) {
            return List.of();
        }
        try {
            Object decoded = objectMapper.readValue(json, Object.class);
            return decoded instanceof List<?> list ? (List<Object>) list : List.of();
        } catch (Exception failure) {
            throw ContentOperationException.unavailable(
                    "CONTENT_PERSISTENCE_UNAVAILABLE", "stored validation report is unreadable");
        }
    }

    private List<Map<String, Object>> readFindingList(String json) {
        List<Map<String, Object>> result = new ArrayList<>();
        for (Object raw : readList(json)) {
            if (raw instanceof Map<?, ?> map) {
                Map<String, Object> entry = new LinkedHashMap<>();
                map.forEach((key, value) -> entry.put(String.valueOf(key), value));
                result.add(entry);
            }
        }
        return result;
    }
}
