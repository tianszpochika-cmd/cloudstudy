package com.englishflow.learner.application;

import com.englishflow.learner.adapter.shadow.LearnerProfileShadowAdapter;
import com.englishflow.learner.adapter.memory.InMemoryLearnerTargetIdGenerator;
import com.englishflow.learner.domain.AuthorizationDecision;
import com.englishflow.learner.domain.IdempotencyRecord;
import com.englishflow.learner.domain.LearnerAccessPolicy;
import com.englishflow.learner.domain.LearnerCommitResult;
import com.englishflow.learner.domain.LearnerMutation;
import com.englishflow.learner.domain.LearnerOutboxEvent;
import com.englishflow.learner.domain.LearnerPrincipalContext;
import com.englishflow.learner.domain.LearnerProfile;
import com.englishflow.learner.domain.LearnerTenantScope;
import com.englishflow.learner.domain.LearningGoal;
import com.englishflow.learner.domain.ProfileSource;
import com.englishflow.learner.port.LearnerProfileStore;
import com.englishflow.learner.port.LearnerTargetIdGenerator;

import java.time.Clock;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.function.Function;
import java.util.function.UnaryOperator;

/**
 * Idempotent learner write application service. It only receives a verified IAM context and
 * writes through the learner-owned atomic store port.
 */
public final class DefaultLearnerProfileCommandService implements LearnerProfileCommandPort {

    private final LearnerProfileStore store;
    private final LearnerProfileShadowAdapter shadowAdapter;
    private final LearnerAccessPolicy accessPolicy;
    private final LearnerTargetIdGenerator targetIdGenerator;
    private final Clock clock;

    public DefaultLearnerProfileCommandService(
            LearnerProfileStore store,
            LearnerProfileShadowAdapter shadowAdapter,
            LearnerAccessPolicy accessPolicy,
            Clock clock) {
        this(store, shadowAdapter, accessPolicy, clock, new InMemoryLearnerTargetIdGenerator());
    }

    public DefaultLearnerProfileCommandService(
            LearnerProfileStore store,
            LearnerProfileShadowAdapter shadowAdapter,
            LearnerAccessPolicy accessPolicy,
            Clock clock,
            LearnerTargetIdGenerator targetIdGenerator) {
        this.store = Objects.requireNonNull(store, "store is required");
        this.shadowAdapter = Objects.requireNonNull(shadowAdapter, "shadowAdapter is required");
        this.accessPolicy = Objects.requireNonNull(accessPolicy, "accessPolicy is required");
        this.clock = Objects.requireNonNull(clock, "clock is required");
        this.targetIdGenerator = Objects.requireNonNull(targetIdGenerator, "targetIdGenerator is required");
    }

    @Override
    public MutationResult<LearnerProfileView> updateProfile(
            LearnerPrincipalContext context,
            UpdateLearnerProfileCommand command,
            RequestMetadata metadata) {
        Objects.requireNonNull(command, "command is required");
        return mutate(context, metadata, "profile.update", "learner.profile.write", command.idempotencyKey(),
                command.expectedVersion(),
                command.fingerprint(), "learner.profile.updated.v1",
                profile -> profile.withProfile(command.onboardingState(), command.assessmentState(),
                        command.currentLevel(), command.resumeTarget(), clock.instant()),
                profile -> Map.of(
                        "tenantId", profile.scope().tenantId(),
                        "principalId", profile.scope().subjectId(),
                        "profileVersion", profile.version(),
                        "changedFieldCodes", java.util.List.of("onboardingState", "assessmentState", "currentLevel", "resumeTarget"),
                        "updatedAt", profile.updatedAt().toString()));
    }

    @Override
    public MutationResult<LearnerProfileView> setLearningGoal(
            LearnerPrincipalContext context,
            SetLearningGoalCommand command,
            RequestMetadata metadata) {
        Objects.requireNonNull(command, "command is required");
        return mutate(context, metadata, "onboarding.goal", "learner.goal.write", command.idempotencyKey(),
                command.expectedVersion(),
                command.fingerprint(), "learner.target.updated.v1",
                profile -> {
                    LearningGoal goal = LearningGoal.create(targetIdGenerator.nextId(context.scope()), command.goalType(),
                            command.dailyStudyMinutes(),
                            command.targetDate(), command.startingLevel(), clock);
                    return profile.withGoal(goal, clock.instant());
                },
                profile -> {
                    LearningGoal goal = profile.goal().orElseThrow();
                    return Map.of(
                            "tenantId", profile.scope().tenantId(),
                            "principalId", profile.scope().subjectId(),
                            "targetId", goal.targetId(),
                            "targetVersion", profile.version(),
                            "goalCode", goal.type().name().toLowerCase(java.util.Locale.ROOT),
                            "targetLevel", goal.startingLevel().name(),
                            "dailyQuotaMinutes", goal.dailyStudyMinutes().minutes(),
                            "updatedAt", goal.updatedAt().toString());
                });
    }

    @Override
    public MutationResult<LearnerProfileView> updatePreferences(
            LearnerPrincipalContext context,
            UpdateLearnerPreferencesCommand command,
            RequestMetadata metadata) {
        Objects.requireNonNull(command, "command is required");
        return mutate(context, metadata, "preference.update", "learner.preference.write",
                command.idempotencyKey(), command.expectedVersion(), command.fingerprint(),
                "learner.profile.updated.v1",
                profile -> profile.withPreferences(command.toPreferences(clock.instant()), clock.instant()),
                profile -> Map.of(
                        "tenantId", profile.scope().tenantId(),
                        "principalId", profile.scope().subjectId(),
                        "profileVersion", profile.version(),
                        "changedFieldCodes", java.util.List.of("uiLocale", "contentLocale", "timezone", "themeMode"),
                        "updatedAt", profile.updatedAt().toString()));
    }

    private MutationResult<LearnerProfileView> mutate(
            LearnerPrincipalContext context,
            RequestMetadata requestedMetadata,
            String operation,
            String permission,
            com.englishflow.learner.domain.IdempotencyKey idempotencyKey,
            Long requestedExpectedVersion,
            String fingerprint,
            String eventType,
            UnaryOperator<LearnerProfile> updater,
            Function<LearnerProfile, Map<String, Object>> payloadFactory) {
        RequestMetadata metadata = requestedMetadata == null ? RequestMetadata.none() : requestedMetadata;
        AuthorizationDecision decision = authorize(context, permission);
        decision.requireAllowed();

        LearnerTenantScope scope = context.scope();
        scope.rejectClientAuthority(context.clientAuthorityClaims());
        var previous = store.findIdempotency(scope, operation, idempotencyKey);
        if (previous.isPresent()) {
            IdempotencyRecord record = previous.get();
            if (!record.fingerprint().equals(fingerprint)) {
                throw new com.englishflow.learner.domain.LearnerDomainException(
                        com.englishflow.learner.domain.LearnerDecisionCode.IDEMPOTENCY_CONFLICT,
                        "idempotency key was already used for another mutation");
            }
            return result(record.responseSnapshot(), true, metadata);
        }

        LearnerProfile loaded = store.find(scope)
                .orElseGet(() -> shadowAdapter.readShadow(scope)
                        .orElseGet(() -> LearnerProfile.empty(scope, clock.instant())));
        // Empty and legacy-shadow reads establish a non-persisted version-0 baseline. The first
        // learner-owned write therefore commits version 1 against expected version 0.
        long currentVersion = loaded.source() == ProfileSource.OWNED ? loaded.version() : 0;
        long expectedVersion = requestedExpectedVersion == null ? currentVersion : requestedExpectedVersion;
        LearnerProfile base = loaded.source() == ProfileSource.OWNED
                ? loaded
                : loaded.asOwned(clock.instant());
        LearnerProfile updated = updater.apply(base);
        IdempotencyRecord idempotency = new IdempotencyRecord(
                scope, operation, idempotencyKey, fingerprint, updated, clock.instant());
        boolean targetEvent = "learner.target.updated.v1".equals(eventType);
        LearnerOutboxEvent event = new LearnerOutboxEvent(
                UUID.randomUUID(), scope, targetEvent ? "learner_target" : "learner_profile",
                targetEvent ? Long.toString(updated.goal().orElseThrow().targetId()) : updated.profileId(), eventType, "learner.event.v1",
                idempotency.namespacedKey(), payloadFactory.apply(updated), metadata.requestId(),
                metadata.traceId(), clock.instant());
        LearnerCommitResult committed = store.commit(
                new LearnerMutation(scope, expectedVersion, updated, idempotency, event));
        return result(committed.profile(), committed.replayed(), metadata);
    }

    private AuthorizationDecision authorize(LearnerPrincipalContext context, String permission) {
        LearnerTenantScope scope = context == null ? null : context.scope();
        return accessPolicy.authorize(context, permission, "learner-profile",
                scope == null ? null : scope.subjectId(),
                scope == null ? null : scope.tenantId(),
                scope == null ? null : scope.subjectId());
    }

    private static MutationResult<LearnerProfileView> result(
            LearnerProfile profile,
            boolean replayed,
            RequestMetadata metadata) {
        return new MutationResult<>(LearnerProfileView.from(profile), replayed, profile.version(),
                metadata.requestId(), metadata.traceId());
    }
}
