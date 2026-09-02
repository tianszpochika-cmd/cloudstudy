package com.englishflow.iam.domain;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.ResponseEntity;

import java.security.MessageDigest;
import java.time.Duration;
import java.time.Instant;
import java.util.Arrays;
import java.util.Objects;
import java.util.function.Function;
import java.util.function.Supplier;

/**
 * Claims persistent writes before invoking business logic and stores the canonical response for
 * a safe retry. A completed retry never reaches refresh rotation or another domain mutation.
 */
public final class IdempotencyService {
    private final IdempotencyStore store;
    private final ObjectMapper objectMapper;
    private final IamTransactionRunner transactions;
    private final IdempotencyResponseCodec responseCodec;
    private final Duration retention;

    public IdempotencyService(IdempotencyStore store, ObjectMapper objectMapper) {
        this(store, objectMapper, IamTransactionRunner.direct(), testReplaySecret(), Duration.ofHours(24));
    }

    public IdempotencyService(IdempotencyStore store, ObjectMapper objectMapper,
                              IamTransactionRunner transactions) {
        this(store, objectMapper, transactions, testReplaySecret(), Duration.ofHours(24));
    }

    public IdempotencyService(IdempotencyStore store, ObjectMapper objectMapper,
                              IamTransactionRunner transactions, String replaySecret) {
        this(store, objectMapper, transactions, replaySecret, Duration.ofHours(24));
    }

    public IdempotencyService(IdempotencyStore store, ObjectMapper objectMapper,
                              IamTransactionRunner transactions, String replaySecret,
                              Duration retention) {
        this.store = Objects.requireNonNull(store, "store");
        this.objectMapper = Objects.requireNonNull(objectMapper, "objectMapper");
        this.transactions = Objects.requireNonNull(transactions, "transactions");
        this.responseCodec = new IdempotencyResponseCodec(objectMapper, replaySecret);
        this.retention = retention == null || retention.isNegative() || retention.isZero()
                ? Duration.ofHours(24) : retention;
    }

    public String fingerprint(Object... components) {
        try {
            return hex(MessageDigest.getInstance("SHA-256")
                    .digest(objectMapper.writeValueAsBytes(Arrays.asList(components))));
        } catch (JsonProcessingException | java.security.NoSuchAlgorithmException exception) {
            throw new IamPolicyException(IamDecisionCode.INVALID_REQUEST, "iam.idempotency.invalid");
        }
    }

    public <T> ResponseEntity<T> execute(String scope, String key, String requestHash,
                                         Supplier<Execution<T>> operation,
                                         Function<IdempotencyRecord, ResponseEntity<T>> replay) {
        return execute(scope, key, requestHash, null, operation, replay);
    }

    /**
     * Executes or safely replays a request with a response type token. The type token is needed
     * only to turn the decrypted JSON snapshot back into the generated envelope type; no token
     * or cookie is ever exposed to the persistence store.
     */
    public <T> ResponseEntity<T> execute(String scope, String key, String requestHash,
                                         TypeReference<T> responseType,
                                         Supplier<Execution<T>> operation,
                                         Function<IdempotencyRecord, ResponseEntity<T>> replay) {
        Outcome<T> outcome = transactions.execute(() ->
                executeWithinTransaction(scope, key, requestHash, responseType, operation, replay));
        if (outcome.failure() != null) throw outcome.failure();
        return outcome.response();
    }

    /**
     * The durable claim, business write and completion marker share one IAM transaction. This
     * removes the operation-to-complete crash window: a process crash rolls back both the domain
     * mutation and its IN_PROGRESS claim, allowing a safe retry rather than an unreplayable key.
     */
    private <T> Outcome<T> executeWithinTransaction(String scope, String key, String requestHash,
                                                    TypeReference<T> responseType,
                                                    Supplier<Execution<T>> operation,
                                                    Function<IdempotencyRecord, ResponseEntity<T>> replay) {
        String normalizedScope = normalize(scope, 128, "scope");
        String normalizedKey = normalize(key, 128, "key");
        store.purgeExpired(Instant.now(), retention);
        IdempotencyRecord claim = store.claim(normalizedScope, normalizedKey, requestHash);
        if (claim.rejected()) return Outcome.failure(replayRejection(claim));
        if (claim.completed()) {
            ResponseEntity<T> response = claim.hasResponseSnapshot() && responseType != null
                    ? responseCodec.restore(normalizedScope, normalizedKey, requestHash, claim, responseType)
                    : replay.apply(claim);
            return Outcome.success(Objects.requireNonNull(response, "idempotent replay response"));
        }

        Execution<T> execution;
        try {
            execution = Objects.requireNonNull(operation.get(), "idempotent response");
        } catch (IamPolicyException exception) {
            // Expected security/policy failures must commit their audit, lock or revoke side
            // effects. Persist a safe rejection while the transaction is still clean, then throw
            // only after the transaction callback has returned and committed.
            if (infrastructureFailure(exception.code())) throw exception;
            store.reject(normalizedScope, normalizedKey, requestHash, exception, rejectionStatus(exception.code()));
            return Outcome.failure(exception);
        } catch (RuntimeException exception) {
            try { store.abandon(normalizedScope, normalizedKey, requestHash); }
            catch (RuntimeException ignored) { /* preserve the original domain failure */ }
            throw exception;
        }

        ResponseEntity<T> response = Objects.requireNonNull(execution.response(), "idempotent response");
        IdempotencyRecord.ResponseSnapshot snapshot = responseCodec.capture(
                normalizedScope, normalizedKey, requestHash, response);
        store.complete(normalizedScope, normalizedKey, requestHash, response.getStatusCode().value(),
                safeResultReference(execution.resultReference()), snapshot);
        return Outcome.success(response);
    }

    public record Execution<T>(ResponseEntity<T> response, String resultReference) {}

    private record Outcome<T>(ResponseEntity<T> response, IamPolicyException failure) {
        private static <T> Outcome<T> success(ResponseEntity<T> response) {
            return new Outcome<>(response, null);
        }

        private static <T> Outcome<T> failure(IamPolicyException exception) {
            return new Outcome<>(null, exception);
        }
    }

    private static IamPolicyException replayRejection(IdempotencyRecord record) {
        try {
            IamDecisionCode code = IamDecisionCode.valueOf(record.errorCode());
            if (record.errorMessageKey() == null || record.errorMessageKey().isBlank()) throw new IllegalArgumentException();
            return new IamPolicyException(code, record.errorMessageKey());
        } catch (RuntimeException exception) {
            return new IamPolicyException(IamDecisionCode.IDEMPOTENCY_RESULT_UNAVAILABLE,
                    "iam.idempotency.result_unavailable");
        }
    }

    private static int rejectionStatus(IamDecisionCode code) {
        return switch (code) {
            case ACCOUNT_LOCKED -> 423;
            case ACCOUNT_CONFLICT, IDEMPOTENCY_KEY_REUSED, IDEMPOTENCY_IN_PROGRESS,
                    CONSENT_VERSION_MISMATCH -> 409;
            case RATE_LIMITED -> 429;
            case INVALID_CREDENTIALS, PASSWORD_RESET_INVALID, SESSION_NOT_FOUND, SESSION_EXPIRED,
                    SESSION_REVOKED, SESSION_REPLAY, JWT_TOKEN_TYPE_INVALID -> 401;
            case ADULT_CONFIRMATION_REQUIRED, ADULT_AGE_EVIDENCE_MISSING, ADULT_AGE_EVIDENCE_INVALID,
                    ADULT_AGE_BELOW_MINIMUM, CLIENT_AUTHORITY_OVERRIDE -> 403;
            case AUDIT_UNAVAILABLE, IAM_PERSISTENCE_UNAVAILABLE, SESSION_STORE_UNAVAILABLE,
                    IDEMPOTENCY_RESULT_UNAVAILABLE, POLICY_UNAVAILABLE -> 503;
            default -> 400;
        };
    }

    private static boolean infrastructureFailure(IamDecisionCode code) {
        return switch (code) {
            case AUDIT_UNAVAILABLE, IAM_PERSISTENCE_UNAVAILABLE, SESSION_STORE_UNAVAILABLE,
                    IDEMPOTENCY_RESULT_UNAVAILABLE -> true;
            default -> false;
        };
    }

    private static String normalize(String value, int maxLength, String field) {
        if (value == null) throw new IamPolicyException(IamDecisionCode.INVALID_REQUEST,
                "iam.idempotency.invalid");
        String normalized = value.trim();
        if (normalized.isBlank() || normalized.length() > maxLength
                || normalized.chars().anyMatch(Character::isISOControl)) {
            throw new IamPolicyException(IamDecisionCode.INVALID_REQUEST,
                    "iam.idempotency.invalid");
        }
        return normalized;
    }

    private static String hex(byte[] bytes) { return java.util.HexFormat.of().formatHex(bytes); }

    private static String safeResultReference(String reference) {
        if (reference == null) return null;
        if (reference.length() > 512 || reference.chars().anyMatch(Character::isISOControl)) {
            throw new IamPolicyException(IamDecisionCode.INVALID_REQUEST, "iam.idempotency.invalid");
        }
        return reference;
    }

    private static String testReplaySecret() {
        return "test-only-idempotency-replay-secret";
    }
}
