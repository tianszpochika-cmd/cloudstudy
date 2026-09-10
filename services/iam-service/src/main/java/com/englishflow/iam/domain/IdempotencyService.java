package com.englishflow.iam.domain;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.ResponseEntity;

import java.time.Duration;
import java.time.Instant;
import java.util.Objects;
import java.util.function.Function;
import java.util.function.Supplier;

/**
 * Claims persistent writes before invoking business logic and selects a safe replay path.
 * Non-credential responses may use an encrypted snapshot; credential responses must be rebuilt
 * only after their supplied replay callback validates current session and rotation facts.
 */
public final class IdempotencyService {
    private final IdempotencyStore store;
    private final ObjectMapper objectMapper;
    private final IamTransactionRunner transactions;
    private final IdempotencyResponseCodec responseCodec;
    private final IdempotencyRequestFingerprint requestFingerprint;
    private final IdempotencyReplayPolicy replayPolicy;
    private final Duration retention;

    public IdempotencyService(IdempotencyStore store, ObjectMapper objectMapper,
                              IamTransactionRunner transactions, String replaySecret,
                              String fingerprintSecret, Duration retention) {
        this(store, objectMapper, transactions, replaySecret, fingerprintSecret, retention,
                IdempotencyReplayPolicy.failClosedDefaults());
    }

    public IdempotencyService(IdempotencyStore store, ObjectMapper objectMapper,
                              IamTransactionRunner transactions, String replaySecret,
                              String fingerprintSecret, Duration retention,
                              IdempotencyReplayPolicy replayPolicy) {
        this.store = Objects.requireNonNull(store, "store");
        this.objectMapper = Objects.requireNonNull(objectMapper, "objectMapper");
        this.transactions = Objects.requireNonNull(transactions, "transactions");
        this.responseCodec = new IdempotencyResponseCodec(objectMapper, replaySecret);
        this.requestFingerprint = new IdempotencyRequestFingerprint(fingerprintSecret);
        if (Objects.equals(replaySecret, fingerprintSecret)) {
            throw new IllegalStateException("IAM idempotency replay and fingerprint secrets must be independent");
        }
        this.replayPolicy = Objects.requireNonNull(replayPolicy, "replayPolicy");
        this.retention = retention == null || retention.isNegative() || retention.isZero()
                ? Duration.ofHours(24) : retention;
    }

    public String fingerprint(Object... components) {
        return requestFingerprint.fingerprint(objectMapper, components);
    }

    /** Returns a non-secret binding for a credential-producing replay reference. */
    public String credentialBinding(AccountRecord account, SessionRecord session) {
        return requestFingerprint.credentialBinding(objectMapper, account, session);
    }

    /** Recomputes and compares the current credential/session generation in constant time. */
    public boolean credentialBindingMatches(AccountRecord account, SessionRecord session,
                                            String presented) {
        return requestFingerprint.credentialBindingMatches(objectMapper, account, session, presented);
    }

    public <T> ResponseEntity<T> execute(String scope, String key, String requestHash,
                                         Supplier<Execution<T>> operation,
                                         Function<IdempotencyRecord, ResponseEntity<T>> replay) {
        return execute(scope, key, requestHash, null, operation, replay);
    }

    /**
     * Executes or safely replays a request with a response type token. The type token is used only
     * when the scope policy permits an encrypted JSON snapshot. Credential scopes ignore the
     * snapshot path and always invoke their current-facts replay callback.
     */
    public <T> ResponseEntity<T> execute(String scope, String key, String requestHash,
                                         TypeReference<T> responseType,
                                         Supplier<Execution<T>> operation,
                                         Function<IdempotencyRecord, ResponseEntity<T>> replay) {
        String normalizedScope = normalize(scope, 128, "scope");
        String normalizedKey = normalize(key, 128, "key");
        String validatedFingerprint;
        try {
            validatedFingerprint = IdempotencyRequestFingerprint.requireCurrent(requestHash);
        } catch (IllegalArgumentException exception) {
            throw new IamPolicyException(IamDecisionCode.INVALID_REQUEST, "iam.idempotency.invalid");
        }
        IdempotencyReplayPolicy.ReplayMode replayMode = Objects.requireNonNull(
                replayPolicy.modeFor(normalizedScope), "idempotency replay mode");
        Outcome<T> outcome = transactions.execute(() ->
                executeWithinTransaction(normalizedScope, normalizedKey, validatedFingerprint,
                        replayMode, responseType, operation, replay));
        if (outcome.failure() != null) throw outcome.failure();
        return outcome.response();
    }

    /**
     * The durable claim, business write and completion marker share one IAM transaction. This
     * removes the operation-to-complete crash window: a process crash rolls back both the domain
     * mutation and its IN_PROGRESS claim, allowing a safe retry rather than an unreplayable key.
     */
    private <T> Outcome<T> executeWithinTransaction(String normalizedScope, String normalizedKey,
                                                    String requestHash,
                                                    IdempotencyReplayPolicy.ReplayMode replayMode,
                                                    TypeReference<T> responseType,
                                                    Supplier<Execution<T>> operation,
                                                    Function<IdempotencyRecord, ResponseEntity<T>> replay) {
        store.purgeExpired(Instant.now(), retention);
        IdempotencyRecord claim = store.claim(normalizedScope, normalizedKey, requestHash);
        if (claim.rejected()) return Outcome.failure(replayRejection(claim));
        if (claim.completed()) {
            ResponseEntity<T> response = replayMode == IdempotencyReplayPolicy.ReplayMode.REQUIRE_CURRENT_FACTS_CALLBACK
                    ? replay.apply(claim)
                    : claim.hasResponseSnapshot() && responseType != null
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
        IdempotencyRecord.ResponseSnapshot snapshot =
                replayMode == IdempotencyReplayPolicy.ReplayMode.ENCRYPTED_SNAPSHOT
                        ? responseCodec.capture(normalizedScope, normalizedKey, requestHash, response)
                        : null;
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
                    CONSENT_VERSION_MISMATCH, POLICY_REVISION_CONFLICT, POLICY_LIFECYCLE_INVALID -> 409;
            case RATE_LIMITED -> 429;
            case INVALID_CREDENTIALS, PASSWORD_RESET_INVALID, SESSION_NOT_FOUND, SESSION_EXPIRED,
                    SESSION_REVOKED, SESSION_REPLAY, JWT_TOKEN_TYPE_INVALID, JWT_ISSUER_INVALID,
                    JWT_AUDIENCE_INVALID, JWT_SIGNATURE_INVALID, JWT_ALGORITHM_INVALID, JWT_TIME_INVALID,
                    JWT_SCOPE_INVALID -> 401;
            case ADULT_CONFIRMATION_REQUIRED, ADULT_AGE_EVIDENCE_MISSING, ADULT_AGE_EVIDENCE_INVALID,
                    ADULT_AGE_BELOW_MINIMUM, CLIENT_AUTHORITY_OVERRIDE, CLIENT_TRUSTED_INPUT_REJECTED,
                    CONSENT_REQUIRES_EXPLICIT_ACCEPTANCE, POLICY_PERMISSION_DENIED,
                    POLICY_SEPARATION_OF_DUTIES, PDP_INVALID_SERVICE_IDENTITY -> 403;
            case POLICY_NOT_FOUND, DEVICE_NOT_FOUND, PRINCIPAL_NOT_FOUND -> 404;
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

    private static String safeResultReference(String reference) {
        if (reference == null) return null;
        if (reference.length() > 512 || reference.chars().anyMatch(Character::isISOControl)) {
            throw new IamPolicyException(IamDecisionCode.INVALID_REQUEST, "iam.idempotency.invalid");
        }
        return reference;
    }

}
