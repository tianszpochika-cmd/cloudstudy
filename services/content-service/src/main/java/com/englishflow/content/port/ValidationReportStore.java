package com.englishflow.content.port;

import com.englishflow.content.domain.ValidationReport;

import java.util.Optional;

/** Version-bound validation-report store; content-service-owned facts only. */
public interface ValidationReportStore {

    /** Next monotonic report version for a content version (advisory; binding is authoritative). */
    long nextReportVersion(long contentVersionId);

    /** Persists a report idempotently by its (version, hash, rule) binding. */
    ValidationReport save(ValidationReport report);

    /** Latest stored report for an exact (version, hash) binding, if any. */
    Optional<ValidationReport> findLatest(long contentVersionId, String payloadHash);
}
