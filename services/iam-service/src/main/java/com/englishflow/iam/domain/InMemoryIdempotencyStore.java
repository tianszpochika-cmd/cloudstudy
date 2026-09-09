package com.englishflow.iam.domain;

import java.time.Instant;
import java.time.Duration;
import java.util.HashMap;
import java.util.Map;

/** Explicitly local-only idempotency store used when IAM persistence is disabled. */
public final class InMemoryIdempotencyStore implements IdempotencyStore {
    private final Map<String, IdempotencyRecord> records = new HashMap<>();

    @Override
    public synchronized IdempotencyRecord claim(String scope, String key, String requestHash) {
        String recordKey = recordKey(scope, key);
        IdempotencyRecord existing = records.get(recordKey);
        if (existing == null) {
            IdempotencyRecord created = new IdempotencyRecord(scope, key, requestHash,
                    IdempotencyRecord.State.IN_PROGRESS, null, null, Instant.now(), null);
            records.put(recordKey, created);
            return created;
        }
        verifyHash(existing, requestHash);
        if (existing.state() == IdempotencyRecord.State.IN_PROGRESS) {
            throw inProgress();
        }
        return existing;
    }

    @Override
    public synchronized IdempotencyRecord complete(String scope, String key, String requestHash,
                                                    int responseStatus, String resultReference) {
        return complete(scope, key, requestHash, responseStatus, resultReference, null);
    }

    @Override
    public synchronized IdempotencyRecord complete(String scope, String key, String requestHash,
                                                    int responseStatus, String resultReference,
                                                    IdempotencyRecord.ResponseSnapshot snapshot) {
        String recordKey = recordKey(scope, key);
        IdempotencyRecord existing = records.get(recordKey);
        if (existing == null) throw unavailable();
        verifyHash(existing, requestHash);
        if (existing.completed() || existing.rejected()) return existing;
        IdempotencyRecord completed = new IdempotencyRecord(scope, key, requestHash,
                IdempotencyRecord.State.COMPLETED, responseStatus, resultReference,
                existing.createdAt(), Instant.now(),
                snapshot == null ? null : snapshot.ciphertext(),
                snapshot == null ? null : snapshot.nonce(),
                snapshot == null ? null : snapshot.keyVersion(), null, null);
        records.put(recordKey, completed);
        return completed;
    }

    @Override
    public synchronized IdempotencyRecord reject(String scope, String key, String requestHash,
                                                  IamPolicyException exception) {
        return reject(scope, key, requestHash, exception, 400);
    }

    @Override
    public synchronized IdempotencyRecord reject(String scope, String key, String requestHash,
                                                  IamPolicyException exception, int responseStatus) {
        String recordKey = recordKey(scope, key);
        IdempotencyRecord existing = records.get(recordKey);
        if (existing == null) throw unavailable();
        verifyHash(existing, requestHash);
        if (existing.completed() || existing.rejected()) return existing;
        IdempotencyRecord rejected = new IdempotencyRecord(scope, key, requestHash,
                IdempotencyRecord.State.REJECTED, responseStatus, null, existing.createdAt(), Instant.now(),
                null, null, null, exception.code().name(), exception.messageKey());
        records.put(recordKey, rejected);
        return rejected;
    }

    @Override
    public synchronized void abandon(String scope, String key, String requestHash) {
        String recordKey = recordKey(scope, key);
        IdempotencyRecord existing = records.get(recordKey);
        if (existing != null && !existing.completed() && !existing.rejected()
                && IdempotencyRequestFingerprint.matchesCurrent(existing.requestHash(), requestHash)) {
            records.remove(recordKey);
        }
    }

    @Override
    public synchronized void purgeExpired(Instant now, Duration retention) {
        if (now == null || retention == null || retention.isNegative() || retention.isZero()) return;
        Instant cutoff = now.minus(retention);
        records.entrySet().removeIf(entry -> entry.getValue().createdAt().isBefore(cutoff));
    }

    private static void verifyHash(IdempotencyRecord existing, String requestHash) {
        if (!IdempotencyRequestFingerprint.matchesCurrent(existing.requestHash(), requestHash)) {
            throw new IamPolicyException(IamDecisionCode.IDEMPOTENCY_KEY_REUSED,
                    "iam.idempotency.key_reused");
        }
    }

    private static String recordKey(String scope, String key) { return scope + "\u0000" + key; }

    private static IamPolicyException inProgress() {
        return new IamPolicyException(IamDecisionCode.IDEMPOTENCY_IN_PROGRESS,
                "iam.idempotency.in_progress");
    }

    private static IamPolicyException unavailable() {
        return new IamPolicyException(IamDecisionCode.IAM_PERSISTENCE_UNAVAILABLE,
                "iam.persistence.unavailable");
    }
}
