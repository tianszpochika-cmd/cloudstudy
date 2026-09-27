package com.englishflow.content.adapter.memory;

import com.englishflow.content.domain.ValidationReport;
import com.englishflow.content.port.ValidationReportStore;

import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

/** Test-only validation-report double keyed by the immutable version binding. */
public final class InMemoryValidationReportStore implements ValidationReportStore {

    private final Map<String, ValidationReport> reports = new ConcurrentHashMap<>();
    private final Map<Long, Long> versions = new ConcurrentHashMap<>();

    @Override
    public long nextReportVersion(long contentVersionId) {
        return versions.merge(contentVersionId, 1L, Long::sum);
    }

    @Override
    public ValidationReport save(ValidationReport report) {
        reports.put(key(report.contentVersionId(), report.payloadHash()), report);
        return report;
    }

    @Override
    public Optional<ValidationReport> findLatest(long contentVersionId, String payloadHash) {
        return Optional.ofNullable(reports.get(key(contentVersionId, payloadHash)));
    }

    private static String key(long contentVersionId, String payloadHash) {
        return contentVersionId + ":" + String.valueOf(payloadHash).toLowerCase();
    }
}
