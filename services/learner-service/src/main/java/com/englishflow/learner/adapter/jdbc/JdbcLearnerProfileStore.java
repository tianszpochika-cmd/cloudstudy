package com.englishflow.learner.adapter.jdbc;

import com.englishflow.learner.domain.AssessmentState;
import com.englishflow.learner.domain.CefrLevel;
import com.englishflow.learner.domain.DailyStudyMinutes;
import com.englishflow.learner.domain.FirstDayProjection;
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
import com.englishflow.learner.domain.OnboardingState;
import com.englishflow.learner.domain.ProfileSource;
import com.englishflow.learner.domain.ThemeMode;
import com.englishflow.learner.port.LearnerProfileStore;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.Objects;
import java.util.Optional;

import org.springframework.dao.DataAccessException;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.support.TransactionTemplate;

import tools.jackson.databind.ObjectMapper;

/**
 * Learner-owned MySQL adapter.
 *
 * <p>The adapter deliberately uses one local Spring transaction for the profile aggregate,
 * idempotency record, first-day projection and outbox event. It never reads or writes a table
 * outside the learner schema. The application layer supplies the already verified principal
 * scope; this adapter has no header, token or client-authority input.</p>
 */
public final class JdbcLearnerProfileStore implements LearnerProfileStore {

    private static final String PROFILE_COLUMNS = "profile_id, tenant_id, owner_id, onboarding_state, "
            + "assessment_state, current_level, resume_target, profile_version, created_at, updated_at";
    private static final String PROFILE_SELECT = "SELECT " + PROFILE_COLUMNS
            + " FROM learner_profile WHERE tenant_id = ? AND owner_id = ?";
    private static final String PROFILE_SELECT_FOR_UPDATE = PROFILE_SELECT + " FOR UPDATE";

    private static final String GOAL_SELECT = "SELECT target_id, goal_type, daily_study_minutes, "
            + "target_date, starting_level, updated_at FROM learner_goal "
            + "WHERE profile_id = ? AND tenant_id = ? AND owner_id = ?";
    private static final String PREFERENCE_SELECT = "SELECT ui_locale, content_locale, theme_mode, timezone, "
            + "reduced_motion, updated_at FROM learner_preference "
            + "WHERE profile_id = ? AND tenant_id = ? AND owner_id = ?";
    private static final String FIRST_DAY_SELECT = "SELECT profile_id, tenant_id, owner_id, today_new_items, "
            + "due_review_items, weak_items, completion_percent, next_action, resume_target, "
            + "profile_version, generated_at FROM learner_first_day_projection "
            + "WHERE tenant_id = ? AND owner_id = ?";

    private static final String IDEMPOTENCY_SELECT = "SELECT idempotency_key, tenant_id, owner_id, operation, "
            + "request_fingerprint, response_snapshot, recorded_at FROM learner_idempotency_record "
            + "WHERE idempotency_key = ?";
    private static final String IDEMPOTENCY_SELECT_FOR_UPDATE = IDEMPOTENCY_SELECT + " FOR UPDATE";

    private final JdbcTemplate jdbc;
    private final TransactionTemplate transactionTemplate;
    private final ObjectMapper objectMapper;

    public JdbcLearnerProfileStore(
            JdbcTemplate jdbc,
            TransactionTemplate transactionTemplate,
            ObjectMapper objectMapper) {
        this.jdbc = Objects.requireNonNull(jdbc, "jdbc is required");
        this.transactionTemplate = Objects.requireNonNull(transactionTemplate, "transactionTemplate is required");
        this.objectMapper = Objects.requireNonNull(objectMapper, "objectMapper is required");
    }

    @Override
    public Optional<LearnerProfile> find(LearnerTenantScope scope) {
        Objects.requireNonNull(scope, "scope is required");
        try {
            Optional<ProfileRow> row = selectProfile(scope, false);
            if (row.isEmpty()) {
                return Optional.empty();
            }
            ProfileRow profile = row.get();
            return Optional.of(toProfile(scope, profile,
                    selectGoal(profile.profileId(), scope),
                    selectPreferences(profile.profileId(), scope)));
        } catch (RuntimeException exception) {
            throw readFailure(exception);
        }
    }

    @Override
    public Optional<FirstDayProjection> findFirstDay(LearnerTenantScope scope) {
        Objects.requireNonNull(scope, "scope is required");
        try {
            Optional<FirstDayRow> row = jdbc.query(FIRST_DAY_SELECT,
                    (resultSet, rowNumber) -> new FirstDayRow(
                            resultSet.getString("profile_id"),
                            resultSet.getString("tenant_id"),
                            resultSet.getString("owner_id"),
                            resultSet.getInt("today_new_items"),
                            resultSet.getInt("due_review_items"),
                            resultSet.getInt("weak_items"),
                            resultSet.getInt("completion_percent"),
                            resultSet.getString("next_action"),
                            resultSet.getString("resume_target"),
                            resultSet.getLong("profile_version"),
                            resultSet.getTimestamp("generated_at")),
                    scope.tenantId(), scope.subjectId()).stream().findFirst();
            if (row.isEmpty()) {
                return Optional.empty();
            }

            FirstDayRow projection = row.get();
            requireStoredScope(scope, projection.tenantId(), projection.ownerId());
            LearnerProfile profile = find(scope).orElseThrow(() -> storeFailure(
                    "learner first-day projection has no profile aggregate", null));
            if (!profile.profileId().equals(projection.profileId())
                    || profile.version() != projection.profileVersion()) {
                throw storeFailure("learner first-day projection version does not match profile", null);
            }
            return Optional.of(new FirstDayProjection(
                    scope,
                    profile.profileId(),
                    profile.source(),
                    profile.onboardingState(),
                    profile.assessmentState(),
                    profile.goal(),
                    profile.preferences(),
                    projection.todayNewItems(),
                    projection.dueReviewItems(),
                    projection.weakItems(),
                    projection.completionPercent(),
                    projection.nextAction(),
                    Optional.ofNullable(projection.resumeTarget()),
                    projection.profileVersion(),
                    instant(projection.generatedAt(), "generated_at")));
        } catch (RuntimeException exception) {
            throw readFailure(exception);
        }
    }

    @Override
    public Optional<IdempotencyRecord> findIdempotency(
            LearnerTenantScope scope,
            String operation,
            IdempotencyKey key) {
        Objects.requireNonNull(scope, "scope is required");
        Objects.requireNonNull(operation, "operation is required");
        Objects.requireNonNull(key, "key is required");
        try {
            Optional<IdempotencyRow> row = selectIdempotency(key.namespaced(scope, operation), false);
            return row.map(value -> toIdempotency(scope, operation, key, value));
        } catch (RuntimeException exception) {
            throw readFailure(exception);
        }
    }

    @Override
    public LearnerCommitResult commit(LearnerMutation mutation) {
        Objects.requireNonNull(mutation, "mutation is required");
        try {
            LearnerCommitResult result = transactionTemplate.execute(status -> commitInTransaction(mutation));
            if (result == null) {
                throw storeFailure("learner transaction returned no result", null);
            }
            return result;
        } catch (LearnerDomainException exception) {
            throw exception;
        } catch (DuplicateKeyException exception) {
            return resolveDuplicate(mutation);
        } catch (DataAccessException exception) {
            throw storeFailure("learner durable commit failed", exception);
        } catch (RuntimeException exception) {
            throw storeFailure("learner durable commit failed", exception);
        }
    }

    private LearnerCommitResult commitInTransaction(LearnerMutation mutation) {
        LearnerTenantScope scope = mutation.scope();
        String namespacedKey = mutation.idempotencyRecord().namespacedKey();

        Optional<IdempotencyRow> existingIdempotency = selectIdempotency(namespacedKey, true);
        if (existingIdempotency.isPresent()) {
            IdempotencyRecord existing = toIdempotency(scope,
                    mutation.idempotencyRecord().operation(),
                    mutation.idempotencyRecord().key(),
                    existingIdempotency.get());
            if (!existing.fingerprint().equals(mutation.idempotencyRecord().fingerprint())) {
                throw new LearnerDomainException(LearnerDecisionCode.IDEMPOTENCY_CONFLICT,
                        "idempotency key was already used for another mutation");
            }
            return new LearnerCommitResult(existing.responseSnapshot(), true);
        }

        // Claim the key before touching the aggregate. A concurrent request with the same key
        // waits on this unique row and can replay the committed response after this transaction.
        insertIdempotency(mutation.idempotencyRecord());

        Optional<ProfileRow> existingProfile = selectProfile(scope, true);
        long currentVersion = existingProfile.map(ProfileRow::profileVersion).orElse(0L);
        if (currentVersion != mutation.expectedVersion()) {
            throw new LearnerDomainException(LearnerDecisionCode.CONCURRENT_UPDATE,
                    "profile version changed before durable commit", true);
        }
        if (existingProfile.isPresent()
                && !existingProfile.get().profileId().equals(mutation.updatedProfile().profileId())) {
            throw storeFailure("profile identity changed inside the verified learner scope", null);
        }

        writeProfile(mutation.updatedProfile(), existingProfile.isPresent(), mutation.expectedVersion());
        writeGoal(mutation.updatedProfile());
        writePreferences(mutation.updatedProfile());
        writeFirstDay(FirstDayProjection.from(
                mutation.updatedProfile(), mutation.updatedProfile().updatedAt()));
        insertOutbox(mutation.outboxEvent());
        return new LearnerCommitResult(mutation.updatedProfile(), false);
    }

    private void writeProfile(LearnerProfile profile, boolean existing, long expectedVersion) {
        if (!existing) {
            jdbc.update("""
                    INSERT INTO learner_profile
                    (profile_id, tenant_id, owner_id, onboarding_state, assessment_state, current_level,
                     resume_target, profile_version, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """, profile.profileId(), profile.scope().tenantId(), profile.scope().ownerId(),
                    profile.onboardingState().name(), profile.assessmentState().name(),
                    enumName(profile.currentLevel().orElse(null)), profile.resumeTarget(), profile.version(),
                    Timestamp.from(profile.createdAt()), Timestamp.from(profile.updatedAt()));
            return;
        }

        int updated = jdbc.update("""
                UPDATE learner_profile
                SET onboarding_state = ?, assessment_state = ?, current_level = ?, resume_target = ?,
                    profile_version = ?, updated_at = ?
                WHERE profile_id = ? AND tenant_id = ? AND owner_id = ? AND profile_version = ?
                """, profile.onboardingState().name(), profile.assessmentState().name(),
                enumName(profile.currentLevel().orElse(null)), profile.resumeTarget(), profile.version(),
                Timestamp.from(profile.updatedAt()), profile.profileId(), profile.scope().tenantId(),
                profile.scope().ownerId(), expectedVersion);
        if (updated != 1) {
            throw new LearnerDomainException(LearnerDecisionCode.CONCURRENT_UPDATE,
                    "profile version changed during durable commit", true);
        }
    }

    private void writeGoal(LearnerProfile profile) {
        Optional<ScopeRow> existing = selectChildScope("learner_goal", profile.profileId(), true);
        if (profile.goal().isEmpty()) {
            deleteChild("learner_goal", profile, existing);
            return;
        }
        LearningGoal goal = profile.goal().orElseThrow();
        if (existing.isPresent()) {
            requireStoredScope(profile.scope(), existing.get().tenantId(), existing.get().ownerId());
            jdbc.update("""
                    UPDATE learner_goal
                    SET target_id = ?, goal_type = ?, daily_study_minutes = ?, target_date = ?,
                        starting_level = ?, updated_at = ?
                    WHERE profile_id = ? AND tenant_id = ? AND owner_id = ?
                    """, storedTargetId(goal), goal.type().name(), goal.dailyStudyMinutes().minutes(),
                    goal.targetDate(), goal.startingLevel().name(), Timestamp.from(goal.updatedAt()),
                    profile.profileId(), profile.scope().tenantId(), profile.scope().ownerId());
            return;
        }
        jdbc.update("""
                INSERT INTO learner_goal
                (profile_id, tenant_id, owner_id, target_id, goal_type, daily_study_minutes,
                 target_date, starting_level, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, profile.profileId(), profile.scope().tenantId(), profile.scope().ownerId(),
                storedTargetId(goal), goal.type().name(), goal.dailyStudyMinutes().minutes(), goal.targetDate(),
                goal.startingLevel().name(), Timestamp.from(goal.updatedAt()));
    }

    private void writePreferences(LearnerProfile profile) {
        Optional<ScopeRow> existing = selectChildScope("learner_preference", profile.profileId(), true);
        if (profile.preferences().isEmpty()) {
            deleteChild("learner_preference", profile, existing);
            return;
        }
        LearnerPreferences preferences = profile.preferences().orElseThrow();
        if (existing.isPresent()) {
            requireStoredScope(profile.scope(), existing.get().tenantId(), existing.get().ownerId());
            jdbc.update("""
                    UPDATE learner_preference
                    SET ui_locale = ?, content_locale = ?, theme_mode = ?, timezone = ?,
                        reduced_motion = ?, updated_at = ?
                    WHERE profile_id = ? AND tenant_id = ? AND owner_id = ?
                    """, preferences.uiLocale(), preferences.contentLocale(), preferences.themeMode().name(),
                    preferences.timezone(), preferences.reducedMotion(), Timestamp.from(preferences.updatedAt()),
                    profile.profileId(), profile.scope().tenantId(), profile.scope().ownerId());
            return;
        }
        jdbc.update("""
                INSERT INTO learner_preference
                (profile_id, tenant_id, owner_id, ui_locale, content_locale, theme_mode, timezone,
                 reduced_motion, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, profile.profileId(), profile.scope().tenantId(), profile.scope().ownerId(),
                preferences.uiLocale(), preferences.contentLocale(), preferences.themeMode().name(),
                preferences.timezone(), preferences.reducedMotion(), Timestamp.from(preferences.updatedAt()));
    }

    private void writeFirstDay(FirstDayProjection projection) {
        Optional<ScopeRow> existing = selectChildScope("learner_first_day_projection", projection.profileId(), true);
        if (existing.isPresent()) {
            requireStoredScope(projection.scope(), existing.get().tenantId(), existing.get().ownerId());
            jdbc.update("""
                    UPDATE learner_first_day_projection
                    SET today_new_items = ?, due_review_items = ?, weak_items = ?, completion_percent = ?,
                        next_action = ?, resume_target = ?, profile_version = ?, generated_at = ?
                    WHERE profile_id = ? AND tenant_id = ? AND owner_id = ?
                    """, projection.todayNewItems(), projection.dueReviewItems(), projection.weakItems(),
                    projection.completionPercent(), projection.nextAction(),
                    projection.resumeTarget().orElse(null), projection.profileVersion(),
                    Timestamp.from(projection.generatedAt()), projection.profileId(), projection.scope().tenantId(),
                    projection.scope().ownerId());
            return;
        }
        jdbc.update("""
                INSERT INTO learner_first_day_projection
                (profile_id, tenant_id, owner_id, today_new_items, due_review_items, weak_items,
                 completion_percent, next_action, resume_target, profile_version, generated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, projection.profileId(), projection.scope().tenantId(), projection.scope().ownerId(),
                projection.todayNewItems(), projection.dueReviewItems(), projection.weakItems(),
                projection.completionPercent(), projection.nextAction(), projection.resumeTarget().orElse(null),
                projection.profileVersion(), Timestamp.from(projection.generatedAt()));
    }

    private void insertIdempotency(IdempotencyRecord record) {
        jdbc.update("""
                INSERT INTO learner_idempotency_record
                (idempotency_key, tenant_id, owner_id, operation, request_fingerprint, response_snapshot, recorded_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """, record.namespacedKey(), record.scope().tenantId(), record.scope().ownerId(),
                record.operation(), record.fingerprint(), json(toStoredProfile(record.responseSnapshot())),
                Timestamp.from(record.recordedAt()));
    }

    private void insertOutbox(LearnerOutboxEvent event) {
        // P1-LIVE-002: the E2 outbox-shape migration added NOT NULL event_name /
        // payload_json without defaults; the old 12-column write rolled back every
        // learner mutation. Both JSON columns carry the same envelope payload.
        jdbc.update("""
                INSERT INTO learner_outbox_event
                (event_id, tenant_id, owner_id, aggregate_type, aggregate_id, event_type, schema_version,
                 dedupe_key, payload, event_name, payload_json, request_id, trace_id, occurred_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, event.eventId().toString(), event.scope().tenantId(), event.scope().ownerId(),
                event.aggregateType(), event.aggregateId(), event.eventType(), event.schemaVersion(),
                event.dedupeKey(), json(event.payload()), event.eventName(), json(event.payload()),
                event.requestId(), event.traceId(),
                Timestamp.from(event.occurredAt()));
    }

    private Optional<ProfileRow> selectProfile(LearnerTenantScope scope, boolean forUpdate) {
        return jdbc.query(forUpdate ? PROFILE_SELECT_FOR_UPDATE : PROFILE_SELECT,
                (resultSet, rowNumber) -> new ProfileRow(
                        resultSet.getString("profile_id"),
                        resultSet.getString("tenant_id"),
                        resultSet.getString("owner_id"),
                        resultSet.getString("onboarding_state"),
                        resultSet.getString("assessment_state"),
                        resultSet.getString("current_level"),
                        resultSet.getString("resume_target"),
                        resultSet.getLong("profile_version"),
                        resultSet.getTimestamp("created_at"),
                        resultSet.getTimestamp("updated_at")),
                scope.tenantId(), scope.subjectId()).stream().findFirst();
    }

    private Optional<GoalRow> selectGoal(String profileId, LearnerTenantScope scope) {
        return jdbc.query(GOAL_SELECT,
                (resultSet, rowNumber) -> new GoalRow(
                        resultSet.getObject("target_id", Long.class),
                        resultSet.getString("goal_type"),
                        resultSet.getInt("daily_study_minutes"),
                        resultSet.getDate("target_date") == null
                                ? null : resultSet.getDate("target_date").toLocalDate(),
                        resultSet.getString("starting_level"),
                        resultSet.getTimestamp("updated_at")),
                profileId, scope.tenantId(), scope.ownerId()).stream().findFirst();
    }

    private Optional<PreferenceRow> selectPreferences(String profileId, LearnerTenantScope scope) {
        return jdbc.query(PREFERENCE_SELECT,
                (resultSet, rowNumber) -> new PreferenceRow(
                        resultSet.getString("ui_locale"),
                        resultSet.getString("content_locale"),
                        resultSet.getString("theme_mode"),
                        resultSet.getString("timezone"),
                        resultSet.getBoolean("reduced_motion"),
                        resultSet.getTimestamp("updated_at")),
                profileId, scope.tenantId(), scope.ownerId()).stream().findFirst();
    }

    private Optional<IdempotencyRow> selectIdempotency(String key, boolean forUpdate) {
        return jdbc.query(forUpdate ? IDEMPOTENCY_SELECT_FOR_UPDATE : IDEMPOTENCY_SELECT,
                (resultSet, rowNumber) -> new IdempotencyRow(
                        resultSet.getString("idempotency_key"),
                        resultSet.getString("tenant_id"),
                        resultSet.getString("owner_id"),
                        resultSet.getString("operation"),
                        resultSet.getString("request_fingerprint"),
                        resultSet.getString("response_snapshot"),
                        resultSet.getTimestamp("recorded_at")), key).stream().findFirst();
    }

    private Optional<ScopeRow> selectChildScope(String table, String profileId, boolean forUpdate) {
        String sql = "SELECT tenant_id, owner_id FROM " + table + " WHERE profile_id = ?"
                + (forUpdate ? " FOR UPDATE" : "");
        return jdbc.query(sql,
                (resultSet, rowNumber) -> new ScopeRow(
                        resultSet.getString("tenant_id"), resultSet.getString("owner_id")),
                profileId).stream().findFirst();
    }

    private void deleteChild(String table, LearnerProfile profile, Optional<ScopeRow> existing) {
        if (existing.isPresent()) {
            requireStoredScope(profile.scope(), existing.get().tenantId(), existing.get().ownerId());
            jdbc.update("DELETE FROM " + table + " WHERE profile_id = ? AND tenant_id = ? AND owner_id = ?",
                    profile.profileId(), profile.scope().tenantId(), profile.scope().ownerId());
        }
    }

    private LearnerProfile toProfile(
            LearnerTenantScope scope,
            ProfileRow profile,
            Optional<GoalRow> goalRow,
            Optional<PreferenceRow> preferenceRow) {
        requireStoredScope(scope, profile.tenantId(), profile.ownerId());
        try {
            Optional<LearningGoal> goal = goalRow.map(value -> new LearningGoal(
                    value.targetId() == null ? 0L : value.targetId(),
                    GoalType.valueOf(value.goalType()),
                    DailyStudyMinutes.from(value.dailyStudyMinutes()),
                    value.targetDate(),
                    CefrLevel.valueOf(value.startingLevel()),
                    instant(value.updatedAt(), "goal.updated_at")));
            Optional<LearnerPreferences> preferences = preferenceRow.map(value -> new LearnerPreferences(
                    value.uiLocale(), value.contentLocale(), ThemeMode.valueOf(value.themeMode()),
                    value.timezone(), value.reducedMotion(), instant(value.updatedAt(), "preference.updated_at")));
            return new LearnerProfile(
                    scope,
                    profile.profileId(),
                    ProfileSource.OWNED,
                    OnboardingState.valueOf(profile.onboardingState()),
                    AssessmentState.valueOf(profile.assessmentState()),
                    Optional.ofNullable(enumValue(CefrLevel.class, profile.currentLevel())),
                    goal,
                    preferences,
                    profile.resumeTarget(),
                    profile.profileVersion(),
                    instant(profile.createdAt(), "profile.created_at"),
                    instant(profile.updatedAt(), "profile.updated_at"));
        } catch (RuntimeException exception) {
            throw storeFailure("learner profile contains invalid durable data", exception);
        }
    }

    private IdempotencyRecord toIdempotency(
            LearnerTenantScope scope,
            String operation,
            IdempotencyKey key,
            IdempotencyRow row) {
        requireStoredScope(scope, row.tenantId(), row.ownerId());
        if (!operation.equals(row.operation()) || !key.namespaced(scope, operation).equals(row.idempotencyKey())) {
            throw storeFailure("learner idempotency record is outside the requested scope", null);
        }
        return new IdempotencyRecord(scope, operation, key, row.requestFingerprint(),
                fromStoredProfile(scope, row.responseSnapshot()), instant(row.recordedAt(), "recorded_at"));
    }

    private LearnerCommitResult resolveDuplicate(LearnerMutation mutation) {
        Optional<IdempotencyRecord> existing = findIdempotency(
                mutation.scope(), mutation.idempotencyRecord().operation(), mutation.idempotencyRecord().key());
        if (existing.isPresent()) {
            if (!existing.get().fingerprint().equals(mutation.idempotencyRecord().fingerprint())) {
                throw new LearnerDomainException(LearnerDecisionCode.IDEMPOTENCY_CONFLICT,
                        "idempotency key was already used for another mutation");
            }
            return new LearnerCommitResult(existing.get().responseSnapshot(), true);
        }
        throw new LearnerDomainException(LearnerDecisionCode.CONCURRENT_UPDATE,
                "another learner commit won the durable uniqueness race", true);
    }

    private String json(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (Exception exception) {
            throw storeFailure("learner durable JSON serialization failed", exception);
        }
    }

    private LearnerProfile fromStoredProfile(LearnerTenantScope expectedScope, String value) {
        try {
            StoredProfile stored = objectMapper.readValue(value, StoredProfile.class);
            if (!expectedScope.tenantId().equals(stored.tenantId())
                    || !expectedScope.subjectId().equals(stored.subjectId())
                    || !ProfileSource.OWNED.name().equals(stored.source())) {
                throw storeFailure("learner idempotency snapshot is outside the verified scope", null);
            }
            Optional<LearningGoal> goal = stored.goal() == null ? Optional.empty() : Optional.of(new LearningGoal(
                    stored.goal().targetId() == null ? 0L : stored.goal().targetId(),
                    GoalType.valueOf(stored.goal().goalType()),
                    DailyStudyMinutes.from(stored.goal().dailyStudyMinutes()),
                    stored.goal().targetDate(),
                    CefrLevel.valueOf(stored.goal().startingLevel()),
                    Instant.parse(stored.goal().updatedAt())));
            Optional<LearnerPreferences> preferences = stored.preferences() == null
                    ? Optional.empty()
                    : Optional.of(new LearnerPreferences(
                            stored.preferences().uiLocale(), stored.preferences().contentLocale(),
                            ThemeMode.valueOf(stored.preferences().themeMode()), stored.preferences().timezone(),
                            stored.preferences().reducedMotion(), Instant.parse(stored.preferences().updatedAt())));
            return new LearnerProfile(
                    expectedScope,
                    stored.profileId(),
                    ProfileSource.OWNED,
                    OnboardingState.valueOf(stored.onboardingState()),
                    AssessmentState.valueOf(stored.assessmentState()),
                    Optional.ofNullable(enumValue(CefrLevel.class, stored.currentLevel())),
                    goal,
                    preferences,
                    stored.resumeTarget(),
                    stored.version(),
                    Instant.parse(stored.createdAt()),
                    Instant.parse(stored.updatedAt()));
        } catch (LearnerDomainException exception) {
            throw exception;
        } catch (Exception exception) {
            throw storeFailure("learner idempotency snapshot could not be decoded", exception);
        }
    }

    private static StoredProfile toStoredProfile(LearnerProfile profile) {
        return new StoredProfile(
                profile.scope().tenantId(),
                profile.scope().subjectId(),
                profile.profileId(),
                profile.source().name(),
                profile.onboardingState().name(),
                profile.assessmentState().name(),
                enumName(profile.currentLevel().orElse(null)),
                profile.goal().map(JdbcLearnerProfileStore::toStoredGoal).orElse(null),
                profile.preferences().map(JdbcLearnerProfileStore::toStoredPreferences).orElse(null),
                profile.resumeTarget(),
                profile.version(),
                profile.createdAt().toString(),
                profile.updatedAt().toString());
    }

    private static StoredGoal toStoredGoal(LearningGoal goal) {
        return new StoredGoal(goal.targetId() == 0 ? null : goal.targetId(), goal.type().name(),
                goal.dailyStudyMinutes().minutes(), goal.targetDate(), goal.startingLevel().name(),
                goal.updatedAt().toString());
    }

    private static StoredPreferences toStoredPreferences(LearnerPreferences preferences) {
        return new StoredPreferences(preferences.uiLocale(), preferences.contentLocale(),
                preferences.themeMode().name(), preferences.timezone(), preferences.reducedMotion(),
                preferences.updatedAt().toString());
    }

    private static Long storedTargetId(LearningGoal goal) {
        return goal.targetId() == 0 ? null : goal.targetId();
    }

    private static String enumName(Enum<?> value) {
        return value == null ? null : value.name();
    }

    private static <E extends Enum<E>> E enumValue(Class<E> type, String value) {
        return value == null ? null : Enum.valueOf(type, value);
    }

    private static Instant instant(Timestamp value, String field) {
        if (value == null) {
            throw storeFailure("learner durable field is null: " + field, null);
        }
        return value.toInstant();
    }

    private static void requireStoredScope(LearnerTenantScope expected, String tenantId, String ownerId) {
        if (!expected.tenantId().equals(tenantId) || !expected.ownerId().equals(ownerId)) {
            throw storeFailure("durable learner row is outside the verified tenant/owner scope", null);
        }
    }

    private static LearnerDomainException readFailure(RuntimeException exception) {
        if (exception instanceof LearnerDomainException domainException
                && domainException.code() == LearnerDecisionCode.STORE_FAILURE) {
            return domainException;
        }
        return storeFailure("learner durable read failed", exception);
    }

    private static LearnerDomainException storeFailure(String message, Throwable cause) {
        return new LearnerDomainException(LearnerDecisionCode.STORE_FAILURE, message, true);
    }

    private record ProfileRow(
            String profileId,
            String tenantId,
            String ownerId,
            String onboardingState,
            String assessmentState,
            String currentLevel,
            String resumeTarget,
            long profileVersion,
            Timestamp createdAt,
            Timestamp updatedAt) {
    }

    private record GoalRow(
            Long targetId,
            String goalType,
            int dailyStudyMinutes,
            java.time.LocalDate targetDate,
            String startingLevel,
            Timestamp updatedAt) {
    }

    private record PreferenceRow(
            String uiLocale,
            String contentLocale,
            String themeMode,
            String timezone,
            boolean reducedMotion,
            Timestamp updatedAt) {
    }

    private record FirstDayRow(
            String profileId,
            String tenantId,
            String ownerId,
            int todayNewItems,
            int dueReviewItems,
            int weakItems,
            int completionPercent,
            String nextAction,
            String resumeTarget,
            long profileVersion,
            Timestamp generatedAt) {
    }

    private record ScopeRow(String tenantId, String ownerId) {
    }

    private record IdempotencyRow(
            String idempotencyKey,
            String tenantId,
            String ownerId,
            String operation,
            String requestFingerprint,
            String responseSnapshot,
            Timestamp recordedAt) {
    }

    private record StoredProfile(
            String tenantId,
            String subjectId,
            String profileId,
            String source,
            String onboardingState,
            String assessmentState,
            String currentLevel,
            StoredGoal goal,
            StoredPreferences preferences,
            String resumeTarget,
            long version,
            String createdAt,
            String updatedAt) {
    }

    private record StoredGoal(
            Long targetId,
            String goalType,
            int dailyStudyMinutes,
            java.time.LocalDate targetDate,
            String startingLevel,
            String updatedAt) {
    }

    private record StoredPreferences(
            String uiLocale,
            String contentLocale,
            String themeMode,
            String timezone,
            boolean reducedMotion,
            String updatedAt) {
    }
}
