package com.englishflow.content.adapter.failclosed;

import com.englishflow.content.domain.ContentOperationException;
import com.englishflow.content.domain.ValidationReport;
import com.englishflow.content.port.ValidationReportStore;

import java.util.Optional;

/** Fail-closed validation-report port: no stored report is ever claimed. */
public final class FailClosedValidationReportStore implements ValidationReportStore {

    @Override
    public long nextReportVersion(long contentVersionId) {
        return 1L;
    }

    @Override
    public ValidationReport save(ValidationReport report) {
        throw ContentOperationException.unavailable(
                "CONTENT_PERSISTENCE_UNAVAILABLE", "validation reports cannot be stored");
    }

    @Override
    public Optional<ValidationReport> findLatest(long contentVersionId, String payloadHash) {
        return Optional.empty();
    }
}
