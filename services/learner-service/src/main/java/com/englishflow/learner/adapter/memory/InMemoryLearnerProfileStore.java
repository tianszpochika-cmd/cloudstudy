package com.englishflow.learner.adapter.memory;

import com.englishflow.learner.domain.IdempotencyKey;
import com.englishflow.learner.domain.IdempotencyRecord;
import com.englishflow.learner.domain.FirstDayProjection;
import com.englishflow.learner.domain.LearnerCommitResult;
import com.englishflow.learner.domain.LearnerDecisionCode;
import com.englishflow.learner.domain.LearnerDomainException;
import com.englishflow.learner.domain.LearnerMutation;
import com.englishflow.learner.domain.LearnerOutboxEvent;
import com.englishflow.learner.domain.LearnerProfile;
import com.englishflow.learner.domain.LearnerTenantScope;
import com.englishflow.learner.port.LearnerProfileStore;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Deterministic test adapter only. It models the transaction/unique-key behavior expected from
 * the future learner-owned MySQL adapter and is never wired as a production default.
 */
public final class InMemoryLearnerProfileStore implements LearnerProfileStore {

    private final ConcurrentHashMap<String, LearnerProfile> profiles = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, FirstDayProjection> firstDayProjections = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, IdempotencyRecord> idempotency = new ConcurrentHashMap<>();
    private final List<LearnerOutboxEvent> outboxEvents = new ArrayList<>();

    @Override
    public List<LearnerTenantScope> search(String tenantId, String query, int limit, String afterSubjectId) {
        String needle = query == null ? "" : query.trim().toLowerCase();
        String after = afterSubjectId == null ? "" : afterSubjectId.trim();
        return profiles.values().stream()
                .map(LearnerProfile::scope)
                .filter(scope -> scope.tenantId().equals(tenantId))
                .filter(scope -> needle.isEmpty() || scope.subjectId().toLowerCase().contains(needle))
                .filter(scope -> after.isEmpty() || scope.subjectId().compareTo(after) > 0)
                .sorted(java.util.Comparator.comparing(LearnerTenantScope::subjectId))
                .limit(Math.max(1, Math.min(limit, 100)))
                .toList();
    }

    @Override
    public Optional<LearnerProfile> find(LearnerTenantScope scope) {
        return Optional.ofNullable(profiles.get(scope.storageKey()));
    }

    @Override
    public Optional<FirstDayProjection> findFirstDay(LearnerTenantScope scope) {
        return Optional.ofNullable(firstDayProjections.get(scope.storageKey()));
    }

    @Override
    public Optional<IdempotencyRecord> findIdempotency(
            LearnerTenantScope scope,
            String operation,
            IdempotencyKey key) {
        return Optional.ofNullable(idempotency.get(key.namespaced(scope, operation)));
    }

    @Override
    public synchronized LearnerCommitResult commit(LearnerMutation mutation) {
        String profileKey = mutation.scope().storageKey();
        String idempotencyKey = mutation.idempotencyRecord().namespacedKey();
        IdempotencyRecord existingIdempotency = idempotency.get(idempotencyKey);
        if (existingIdempotency != null) {
            if (!existingIdempotency.fingerprint().equals(mutation.idempotencyRecord().fingerprint())) {
                throw new LearnerDomainException(LearnerDecisionCode.IDEMPOTENCY_CONFLICT,
                        "idempotency key was already used for another mutation");
            }
            return new LearnerCommitResult(existingIdempotency.responseSnapshot(), true);
        }

        LearnerProfile existingProfile = profiles.get(profileKey);
        // A missing aggregate is the version-0 baseline used by the application port.
        long currentVersion = existingProfile == null ? 0 : existingProfile.version();
        if (currentVersion != mutation.expectedVersion()) {
            throw new LearnerDomainException(LearnerDecisionCode.CONCURRENT_UPDATE,
                    "profile version changed before commit", true);
        }

        profiles.put(profileKey, mutation.updatedProfile());
        firstDayProjections.put(profileKey,
                FirstDayProjection.from(mutation.updatedProfile(), mutation.updatedProfile().updatedAt()));
        idempotency.put(idempotencyKey, mutation.idempotencyRecord());
        outboxEvents.add(mutation.outboxEvent());
        return new LearnerCommitResult(mutation.updatedProfile(), false);
    }

    public synchronized List<LearnerOutboxEvent> outboxEvents() {
        return List.copyOf(outboxEvents);
    }
}
