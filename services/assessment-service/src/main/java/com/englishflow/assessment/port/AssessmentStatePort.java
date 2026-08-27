package com.englishflow.assessment.port;

import com.englishflow.assessment.domain.AssessmentAttempt;
import com.englishflow.assessment.domain.AssessmentCheckpoint;
import com.englishflow.assessment.domain.AssessmentMistake;
import com.englishflow.assessment.domain.AssessmentReport;
import com.englishflow.assessment.domain.AssessmentSession;
import com.englishflow.assessment.domain.AssessmentDomainException;
import com.englishflow.assessment.domain.SafePayloads;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;

/**
 * Durable state boundary for the assessment aggregate.
 *
 * <p>The domain/application layer remains transport neutral.  A production runtime must provide
 * an implementation backed by the assessment schema; the dependency-free smoke test uses an
 * explicit no-op adapter only through the legacy constructor.</p>
 */
public interface AssessmentStatePort {

    RestoredState load();

    void saveSession(AssessmentSession session);

    void saveAttempt(AssessmentSession session, AssessmentAttempt attempt);

    void saveCheckpoint(String sessionId, AssessmentCheckpoint checkpoint);

    void saveReport(AssessmentReport report);

    void saveMistake(AssessmentMistake mistake);

    Optional<IdempotencyRecord> findIdempotency(String tenantId, String subjectId,
                                                 String operation, String idempotencyKey);

    /** Returns the canonical record already stored by another writer, if a race won the insert. */
    IdempotencyRecord saveIdempotency(IdempotencyRecord record);

    record RestoredState(
            List<AssessmentSession> sessions,
            List<AssessmentReport> reports,
            List<AssessmentMistake> mistakes) {
        public RestoredState {
            sessions = List.copyOf(sessions == null ? List.of() : sessions);
            reports = List.copyOf(reports == null ? List.of() : reports);
            mistakes = List.copyOf(mistakes == null ? List.of() : mistakes);
        }

        public static RestoredState empty() {
            return new RestoredState(List.of(), List.of(), List.of());
        }
    }

    record IdempotencyRecord(
            String tenantId,
            String subjectId,
            String operation,
            String idempotencyKey,
            String requestDigest,
            Map<String, Object> response,
            Instant createdAt) {
        public IdempotencyRecord {
            tenantId = token(tenantId, "tenantId");
            subjectId = token(subjectId, "subjectId");
            operation = token(operation, "operation");
            idempotencyKey = token(idempotencyKey, "idempotencyKey");
            requestDigest = token(requestDigest, "requestDigest");
            response = SafePayloads.freeze(response == null ? Map.of() : response);
            createdAt = Objects.requireNonNull(createdAt, "createdAt is required");
        }

        private static String token(String value, String field) {
            if (value == null || value.isBlank() || value.length() > 256 || value.contains("\n")) {
                throw AssessmentDomainException.invalid("ASM_IDEMPOTENCY_INVALID", field + " is invalid");
            }
            return value;
        }
    }
}
