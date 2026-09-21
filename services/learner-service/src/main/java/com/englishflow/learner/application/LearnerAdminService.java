package com.englishflow.learner.application;

import com.englishflow.learner.domain.CefrLevel;
import com.englishflow.learner.domain.DailyStudyMinutes;
import com.englishflow.learner.domain.GoalType;
import com.englishflow.learner.domain.IdempotencyKey;
import com.englishflow.learner.domain.IdempotencyRecord;
import com.englishflow.learner.domain.LearnerCommitResult;
import com.englishflow.learner.domain.LearnerDecisionCode;
import com.englishflow.learner.domain.LearnerDomainException;
import com.englishflow.learner.domain.LearnerMutation;
import com.englishflow.learner.domain.LearnerOutboxEvent;
import com.englishflow.learner.domain.LearnerPreferences;
import com.englishflow.learner.domain.LearnerProfile;
import com.englishflow.learner.domain.LearnerTenantScope;
import com.englishflow.learner.domain.LearningGoal;
import com.englishflow.learner.domain.ProfileSource;
import com.englishflow.learner.domain.ThemeMode;
import com.englishflow.learner.port.LearnerProfileStore;
import com.englishflow.learner.port.LearnerTargetIdGenerator;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

/**
 * Single-tenant control-plane operations on learner facts.
 *
 * <p>All calls require a verified tenant-admin JWT (checked at the web
 * boundary); the target subject comes from the path, never from client
 * authority fields. Writes mirror the learner-owned idempotency, version and
 * outbox semantics and additionally tag the audit actor.</p>
 */
public final class LearnerAdminService {

    private final LearnerProfileStore store;
    private final LearnerTargetIdGenerator targetIds;
    private final Clock clock;

    public LearnerAdminService(
            LearnerProfileStore store,
            LearnerTargetIdGenerator targetIds,
            Clock clock) {
        this.store = Objects.requireNonNull(store, "store is required");
        this.targetIds = Objects.requireNonNull(targetIds, "targetIds are required");
        this.clock = Objects.requireNonNull(clock, "clock is required");
    }

    public record AdminMutationResult(LearnerProfileView view, boolean replayed, String adminSubject) {
    }

    public List<LearnerTenantScope> search(String query, int limit) {
        return store.search(LearnerTenantScope.PLATFORM_TENANT, query, limit);
    }

    public LearnerProfileView profile(String subjectId) {
        LearnerTenantScope scope = scopeOf(subjectId);
        LearnerProfile profile = store.find(scope)
                .orElseThrow(() -> new LearnerDomainException(LearnerDecisionCode.PROFILE_NOT_FOUND,
                        "learner profile does not exist"));
        return LearnerProfileView.from(profile);
    }

    public java.util.Optional<FirstDayView> firstDay(String subjectId) {
        LearnerTenantScope scope = scopeOf(subjectId);
        return store.findFirstDay(scope).map(FirstDayView::from);
    }

    public AdminMutationResult setGoal(
            String subjectId,
            String goalType,
            int dailyMinutes,
            String targetDate,
            String startingLevel,
            String examName,
            String language,
            Long expectedVersion,
            String idempotencyKey,
            String requestId,
            String traceId,
            String adminSubject) {
        LearnerTenantScope scope = scopeOf(subjectId);
        GoalType type = parseGoalType(goalType);
        DailyStudyMinutes minutes = DailyStudyMinutes.from(dailyMinutes);
        LocalDate date = targetDate == null || targetDate.isBlank() ? null : LocalDate.parse(targetDate.trim());
        CefrLevel level = startingLevel == null || startingLevel.isBlank()
                ? CefrLevel.A1 : CefrLevel.valueOf(startingLevel.trim().toUpperCase());
        Map<String, Object> examFields = examFields(type, examName, language);
        String fingerprint = String.join("|", "admin-goal", type.name(), String.valueOf(minutes.minutes()),
                String.valueOf(date), level.name(), String.valueOf(examFields.get("examName")),
                String.valueOf(examFields.get("language")), String.valueOf(expectedVersion));
        return mutate(scope, "admin.goal", idempotencyKey, expectedVersion, fingerprint,
                "learner.target.updated.v1", requestId, traceId, adminSubject,
                profile -> {
                    LearningGoal goal = LearningGoal.create(targetIds.nextId(scope), type, minutes,
                            date, level, examFields, clock);
                    return profile.withGoal(goal, clock.instant());
                },
                profile -> {
                    LearningGoal goal = profile.goal().orElseThrow();
                    return Map.of(
                            "tenantId", profile.scope().tenantId(),
                            "principalId", profile.scope().subjectId(),
                            "targetId", goal.targetId(),
                            "targetVersion", profile.version(),
                            "adminSubject", adminSubject,
                            "updatedAt", goal.updatedAt().toString());
                });
    }

    public AdminMutationResult updatePreferences(
            String subjectId,
            String uiLocale,
            String contentLocale,
            String themeMode,
            String timezone,
            boolean reducedMotion,
            Long expectedVersion,
            String idempotencyKey,
            String requestId,
            String traceId,
            String adminSubject) {
        LearnerTenantScope scope = scopeOf(subjectId);
        ThemeMode mode = ThemeMode.valueOf(themeMode.trim().toUpperCase());
        String fingerprint = String.join("|", "admin-preferences", uiLocale, contentLocale, mode.name(),
                timezone, Boolean.toString(reducedMotion), String.valueOf(expectedVersion));
        return mutate(scope, "admin.preference", idempotencyKey, expectedVersion, fingerprint,
                "learner.profile.updated.v1", requestId, traceId, adminSubject,
                profile -> profile.withPreferences(
                        new LearnerPreferences(uiLocale, contentLocale, mode, timezone, reducedMotion,
                                clock.instant()),
                        clock.instant()),
                profile -> Map.of(
                        "tenantId", profile.scope().tenantId(),
                        "principalId", profile.scope().subjectId(),
                        "profileVersion", profile.version(),
                        "adminSubject", adminSubject,
                        "updatedAt", profile.updatedAt().toString()));
    }

    private AdminMutationResult mutate(
            LearnerTenantScope scope,
            String operation,
            String rawKey,
            Long requestedExpectedVersion,
            String fingerprint,
            String eventType,
            String requestId,
            String traceId,
            String adminSubject,
            java.util.function.UnaryOperator<LearnerProfile> updater,
            java.util.function.Function<LearnerProfile, Map<String, Object>> payloadFactory) {
        IdempotencyKey key = new IdempotencyKey(rawKey);
        var previous = store.findIdempotency(scope, operation, key);
        if (previous.isPresent()) {
            IdempotencyRecord record = previous.get();
            if (!record.fingerprint().equals(fingerprint)) {
                throw new LearnerDomainException(LearnerDecisionCode.IDEMPOTENCY_CONFLICT,
                        "idempotency key was already used for another mutation");
            }
            return new AdminMutationResult(LearnerProfileView.from(record.responseSnapshot()), true, adminSubject);
        }
        LearnerProfile loaded = store.find(scope)
                .orElseGet(() -> LearnerProfile.empty(scope, clock.instant()));
        long currentVersion = loaded.source() == ProfileSource.OWNED ? loaded.version() : 0;
        long expectedVersion = requestedExpectedVersion == null ? currentVersion : requestedExpectedVersion;
        LearnerProfile base = loaded.source() == ProfileSource.OWNED
                ? loaded : loaded.asOwned(clock.instant());
        LearnerProfile updated = updater.apply(base);
        IdempotencyRecord record = new IdempotencyRecord(scope, operation, key, fingerprint, updated, clock.instant());
        LearnerOutboxEvent event = new LearnerOutboxEvent(
                UUID.randomUUID(), scope, "learner_profile", updated.profileId(), eventType, "learner.event.v1",
                record.namespacedKey(), payloadFactory.apply(updated), requestId, traceId, clock.instant());
        LearnerCommitResult committed = store.commit(new LearnerMutation(scope, expectedVersion, updated, record, event));
        return new AdminMutationResult(LearnerProfileView.from(committed.profile()), committed.replayed(), adminSubject);
    }

    private static LearnerTenantScope scopeOf(String subjectId) {        if (subjectId == null || subjectId.isBlank()) {
            throw new LearnerDomainException(LearnerDecisionCode.INVALID_PROFILE, "subjectId is required");
        }
        try {
            return LearnerTenantScope.forPhaseOne(subjectId.trim());
        } catch (IllegalArgumentException invalid) {
            throw new LearnerDomainException(LearnerDecisionCode.INVALID_PROFILE, "subjectId has an unsafe format");
        }
    }

    /**
     * B4 converged exam fields. LANGUAGE_CERT goals carry examName + language;
     * every other goal type must arrive without exam inputs (LearningGoal
     * rejects stray exam fields so historical rows cannot be blurred).
     */
    private static Map<String, Object> examFields(GoalType type, String examName, String language) {
        boolean hasExamName = examName != null && !examName.isBlank();
        boolean hasLanguage = language != null && !language.isBlank();
        if (type != GoalType.LANGUAGE_CERT) {
            if (hasExamName || hasLanguage) {
                throw new LearnerDomainException(LearnerDecisionCode.INVALID_GOAL,
                        "examName/language are only accepted with goalType=LANGUAGE_CERT");
            }
            return Map.of();
        }
        if (!hasExamName || !hasLanguage) {
            throw new LearnerDomainException(LearnerDecisionCode.INVALID_GOAL,
                    "LANGUAGE_CERT goals require examName and language");
        }
        return Map.of("examName", examName.trim(), "language", language.trim());
    }

    private static GoalType parseGoalType(String raw) {
        if (raw == null || raw.isBlank()) {
            throw new LearnerDomainException(LearnerDecisionCode.INVALID_GOAL, "goalType is required");
        }
        try {
            return GoalType.valueOf(raw.trim().toUpperCase());
        } catch (IllegalArgumentException invalid) {
            throw new LearnerDomainException(LearnerDecisionCode.INVALID_GOAL, "goalType is invalid");
        }
    }
}
