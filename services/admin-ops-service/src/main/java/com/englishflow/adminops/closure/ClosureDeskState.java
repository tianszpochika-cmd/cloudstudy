package com.englishflow.adminops.closure;

import java.util.List;
import java.util.Map;

/**
 * Durable snapshot of the closure desk. Field names are the JSON document stored
 * in {@code it7_closure_desk.state_json}.
 */
public record ClosureDeskState(
        List<CaseRow> cases,
        List<TraceRow> traces,
        List<ExportRow> exports,
        List<DeletionRow> deletions,
        List<AuditRow> audits,
        List<String> outboxFacts,
        List<String> deadLetters,
        List<IdempotencyRow> idempotency,
        int isolationWrites) {

    public ClosureDeskState {
        cases = cases == null ? List.of() : List.copyOf(cases);
        traces = traces == null ? List.of() : List.copyOf(traces);
        exports = exports == null ? List.of() : List.copyOf(exports);
        deletions = deletions == null ? List.of() : List.copyOf(deletions);
        audits = audits == null ? List.of() : List.copyOf(audits);
        outboxFacts = outboxFacts == null ? List.of() : List.copyOf(outboxFacts);
        deadLetters = deadLetters == null ? List.of() : List.copyOf(deadLetters);
        idempotency = idempotency == null ? List.of() : List.copyOf(idempotency);
    }

    public static ClosureDeskState empty() {
        return new ClosureDeskState(List.of(), List.of(), List.of(), List.of(), List.of(),
                List.of(), List.of(), List.of(), 0);
    }

    public record CaseRow(String id, String owner, String sourceRef, String title, String updatedAt,
            String status, String disposition) {
        public CaseRow(String id, String owner, String sourceRef, String title, String updatedAt) {
            this(id, owner, sourceRef, title, updatedAt, "FILED", "NOT_STARTED");
        }
    }

    public record TraceRow(String id, String owner, String bodyHash) {
    }

    public record ExportRow(String id, String owner, String state) {
    }

    public record DeletionRow(String id, String owner) {
    }

    public record AuditRow(String id, String operation, String resourceRef, String occurredAt) {
    }

    public record IdempotencyRow(
            String key,
            String fingerprint,
            int status,
            Map<String, Object> data,
            Map<String, Object> error) {
    }
}
