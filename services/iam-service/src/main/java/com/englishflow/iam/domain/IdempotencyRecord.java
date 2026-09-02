package com.englishflow.iam.domain;

import java.time.Instant;
import java.util.Objects;

/** Durable request claim and replayable response owned by IAM. */
public record IdempotencyRecord(
        String scope,
        String key,
        String requestHash,
        State state,
        Integer responseStatus,
        String resultReference,
        Instant createdAt,
        Instant completedAt,
        String responseCiphertext,
        String responseNonce,
        String responseKeyVersion,
        String errorCode,
        String errorMessageKey) {

    /** Compatibility constructor for local callers that only need claim metadata. */
    public IdempotencyRecord(String scope, String key, String requestHash, State state,
                             Integer responseStatus, String resultReference,
                             Instant createdAt, Instant completedAt) {
        this(scope, key, requestHash, state, responseStatus, resultReference, createdAt,
                completedAt, null, null, null, null, null);
    }

    public IdempotencyRecord {
        Objects.requireNonNull(scope, "scope");
        Objects.requireNonNull(key, "key");
        Objects.requireNonNull(requestHash, "requestHash");
        Objects.requireNonNull(state, "state");
        Objects.requireNonNull(createdAt, "createdAt");
    }

    public enum State { IN_PROGRESS, COMPLETED, REJECTED }

    public boolean completed() { return state == State.COMPLETED; }
    public boolean rejected() { return state == State.REJECTED; }
    public boolean hasResponseSnapshot() {
        return responseCiphertext != null && !responseCiphertext.isBlank()
                && responseNonce != null && !responseNonce.isBlank()
                && responseKeyVersion != null && !responseKeyVersion.isBlank();
    }

    public ResponseSnapshot responseSnapshot() {
        return hasResponseSnapshot()
                ? new ResponseSnapshot(responseCiphertext, responseNonce, responseKeyVersion)
                : null;
    }

    public record ResponseSnapshot(String ciphertext, String nonce, String keyVersion) {
        public ResponseSnapshot {
            Objects.requireNonNull(ciphertext, "ciphertext");
            Objects.requireNonNull(nonce, "nonce");
            Objects.requireNonNull(keyVersion, "keyVersion");
        }
    }
}
