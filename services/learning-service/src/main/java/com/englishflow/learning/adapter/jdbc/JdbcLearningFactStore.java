package com.englishflow.learning.adapter.jdbc;

import java.sql.Date;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.function.Supplier;

import com.englishflow.learning.domain.IdempotencyKey;
import com.englishflow.learning.domain.LearningDomainException;
import com.englishflow.learning.domain.LearningDecisionCode;
import com.englishflow.learning.domain.LearningItemType;
import com.englishflow.learning.domain.LearningOutboxEvent;
import com.englishflow.learning.domain.LearningPlan;
import com.englishflow.learning.domain.LearningPlanStatus;
import com.englishflow.learning.domain.LearningProgress;
import com.englishflow.learning.domain.LearningSchema;
import com.englishflow.learning.domain.LearningTask;
import com.englishflow.learning.domain.LearningTaskStatus;
import com.englishflow.learning.domain.LearningTaskType;
import com.englishflow.learning.domain.LearningTenantScope;
import com.englishflow.learning.domain.MasteryProjection;
import com.englishflow.learning.domain.MasteryStage;
import com.englishflow.learning.domain.PlanningKey;
import com.englishflow.learning.domain.ReviewConfidence;
import com.englishflow.learning.domain.ReviewEvent;
import com.englishflow.learning.domain.ReviewQueueSnapshot;
import com.englishflow.learning.domain.SrsStage;
import com.englishflow.learning.domain.SrsState;
import com.englishflow.learning.domain.VerificationStage;
import com.englishflow.learning.application.LearningReviewService;
import com.englishflow.learning.port.IdempotentExecution;
import com.englishflow.learning.port.LearningFactStore;

import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.support.TransactionTemplate;

import tools.jackson.databind.ObjectMapper;

/**
 * MySQL adapter for learning-owned facts. The application service invokes all save methods inside
 * executeIdempotently; the transaction template therefore commits the idempotency row, fact rows
 * and outbox append together on the same local connection.
 */
public final class JdbcLearningFactStore implements LearningFactStore {

    private final JdbcTemplate jdbc;
    private final TransactionTemplate transactionTemplate;
    private final ObjectMapper objectMapper;

    public JdbcLearningFactStore(JdbcTemplate jdbc, TransactionTemplate transactionTemplate,
            ObjectMapper objectMapper) {
        this.jdbc = Objects.requireNonNull(jdbc, "jdbc is required");
        this.transactionTemplate = Objects.requireNonNull(transactionTemplate, "transactionTemplate is required");
        this.objectMapper = Objects.requireNonNull(objectMapper, "objectMapper is required");
    }

    @Override
    public Optional<LearningPlan> findPlan(LearningTenantScope scope, PlanningKey key) {
        requireScope(scope, key.scope());
        List<LearningPlan> plans = jdbc.query("""
                SELECT plan_id, tenant_id, principal_id, user_id, target_id, goal_code,
                       content_version_id, content_epoch, time_zone_id, daily_quota_minutes,
                       status, plan_version, created_at, updated_at
                  FROM learning_runtime_plan
                 WHERE tenant_id = ? AND principal_id = ? AND user_id = ?
                   AND target_id = ? AND content_version_id = ? AND content_epoch = ?
                """, this::mapPlan,
                scope.tenantId(), scope.principalId(), scope.userId(), key.targetId(),
                key.contentVersionId(), key.contentEpoch());
        return plans.stream().findFirst().map(plan -> loadTasks(scope, plan));
    }

    @Override
    public Optional<LearningPlan> findPlanById(LearningTenantScope scope, long planId) {
        if (planId < 1) {
            throw new IllegalArgumentException("planId must be positive");
        }
        List<LearningPlan> plans = jdbc.query("""
                SELECT plan_id, tenant_id, principal_id, user_id, target_id, goal_code,
                       content_version_id, content_epoch, time_zone_id, daily_quota_minutes,
                       status, plan_version, created_at, updated_at
                  FROM learning_runtime_plan
                 WHERE plan_id = ? AND tenant_id = ? AND principal_id = ? AND user_id = ?
                """, this::mapPlan, planId, scope.tenantId(), scope.principalId(), scope.userId());
        return plans.stream().findFirst().map(plan -> loadTasks(scope, plan));
    }

    @Override
    public Optional<SrsState> findSrsState(LearningTenantScope scope, LearningItemType itemType, long itemId) {
        return jdbc.query("""
                SELECT srs_state_id, tenant_id, principal_id, user_id, item_type, target_id,
                       item_id, content_version_id, stage, easiness_factor, repetitions,
                       interval_days, lapse_count, time_zone_id, due_at, last_reviewed_at,
                       state_version
                  FROM learning_runtime_srs_state
                 WHERE tenant_id = ? AND principal_id = ? AND user_id = ?
                   AND item_type = ? AND item_id = ?
                """, this::mapSrsState, scope.tenantId(), scope.principalId(), scope.userId(),
                itemType.name(), itemId).stream().findFirst();
    }

    @Override
    public Optional<MasteryProjection> findMastery(LearningTenantScope scope,
            LearningItemType itemType, long itemId) {
        return jdbc.query("""
                SELECT tenant_id, principal_id, user_id, item_type, item_id, content_version_id,
                       stage, score, attempt_count, correct_count, projection_version,
                       verification_stage, rule_version, last_evidence_at, applied_evidence_ids_json
                  FROM learning_runtime_mastery_projection
                 WHERE tenant_id = ? AND principal_id = ? AND user_id = ?
                   AND item_type = ? AND item_id = ?
                """, this::mapMastery, scope.tenantId(), scope.principalId(), scope.userId(),
                itemType.name(), itemId).stream().findFirst();
    }

    @Override
    public Optional<LearningProgress> findProgress(LearningTenantScope scope, long planId, long taskId) {
        return jdbc.query("""
                SELECT tenant_id, principal_id, user_id, plan_id, task_id, completed_units,
                       total_units, study_seconds, progress_version, last_activity_at
                 FROM learning_runtime_progress
                 WHERE tenant_id = ? AND principal_id = ? AND user_id = ?
                   AND plan_id = ? AND task_id = ?
                """, this::mapProgress, scope.tenantId(), scope.principalId(), scope.userId(), planId, taskId)
                .stream().findFirst();
    }

    @Override
    public List<SrsState> dueSrsStates(LearningTenantScope scope, Instant dueBy) {
        return jdbc.query("""
                SELECT srs_state_id, tenant_id, principal_id, user_id, item_type, target_id,
                       item_id, content_version_id, stage, easiness_factor, repetitions,
                       interval_days, lapse_count, time_zone_id, due_at, last_reviewed_at,
                       state_version
                  FROM learning_runtime_srs_state
                 WHERE tenant_id = ? AND principal_id = ? AND user_id = ? AND due_at <= ?
                 ORDER BY due_at, srs_state_id
                """, this::mapSrsState, scope.tenantId(), scope.principalId(), scope.userId(),
                timestamp(dueBy));
    }

    @Override
    public <T> IdempotentExecution<T> executeIdempotently(LearningTenantScope scope, String operation,
            IdempotencyKey key, String requestFingerprint, Supplier<T> action) {
        Objects.requireNonNull(scope, "scope is required");
        Objects.requireNonNull(key, "idempotency key is required");
        Objects.requireNonNull(requestFingerprint, "request fingerprint is required");
        Objects.requireNonNull(action, "action is required");
        String namespacedOperation = key.namespaced(scope, operation);
        return Objects.requireNonNull(transactionTemplate.execute(status -> {
            List<IdempotencyRow> rows = jdbc.query("""
                    SELECT request_fingerprint, response_type, response_json
                      FROM learning_runtime_idempotency_record
                     WHERE tenant_id = ? AND principal_id = ? AND user_id = ?
                       AND operation = ? AND idempotency_key = ?
                     FOR UPDATE
                    """, (rs, rowNum) -> new IdempotencyRow(
                            rs.getString("request_fingerprint"),
                            rs.getString("response_type"),
                            rs.getString("response_json")),
                    scope.tenantId(), scope.principalId(), scope.userId(), operation, key.value());
            if (!rows.isEmpty()) {
                IdempotencyRow existing = rows.getFirst();
                if (!existing.requestFingerprint().equals(requestFingerprint)) {
                    throw new LearningDomainException(LearningDecisionCode.IDEMPOTENCY_CONFLICT,
                            "Idempotency-Key cannot be reused for another payload");
                }
                @SuppressWarnings("unchecked")
                T replayed = (T) deserialize(existing.responseType(), existing.responseJson());
                return new IdempotentExecution<>(replayed, true);
            }

            T value = action.get();
            String responseType = responseType(operation);
            String responseJson = serialize(value);
            try {
                jdbc.update("""
                        INSERT INTO learning_runtime_idempotency_record
                            (tenant_id, principal_id, user_id, operation, idempotency_key,
                             request_fingerprint, response_type, response_json, created_at, updated_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        """, scope.tenantId(), scope.principalId(), scope.userId(), operation, key.value(),
                        requestFingerprint, responseType, responseJson, timestamp(Instant.now()), timestamp(Instant.now()));
            } catch (DuplicateKeyException exception) {
                throw new JdbcLearningPersistenceException(
                        "concurrent idempotency claim could not be resolved safely", exception);
            }
            return new IdempotentExecution<>(value, false);
        }), "idempotent learning transaction returned no result");
    }

    @Override
    public void savePlan(LearningPlan plan) {
        LearningSchema.requireOwnedFact("learning_plan");
        LearningTenantScope scope = plan.scope();
        Optional<OwnerRow> existing = ownerForPlan(plan.planId());
        if (existing.isPresent()) {
            requireOwner(scope, existing.get());
            jdbc.update("""
                    UPDATE learning_runtime_plan
                       SET target_id = ?, goal_code = ?, content_version_id = ?, content_epoch = ?,
                           time_zone_id = ?, daily_quota_minutes = ?, status = ?, plan_version = ?,
                           created_at = ?, updated_at = ?
                     WHERE plan_id = ? AND tenant_id = ? AND principal_id = ? AND user_id = ?
                    """, plan.targetId(), plan.goalCode(), plan.contentVersionId(), plan.contentEpoch(),
                    plan.timeZoneId(), plan.dailyQuotaMinutes(), plan.status().name(), plan.version(),
                    timestamp(plan.createdAt()), timestamp(plan.updatedAt()), plan.planId(), scope.tenantId(),
                    scope.principalId(), scope.userId());
        } else {
            jdbc.update("""
                    INSERT INTO learning_runtime_plan
                        (plan_id, tenant_id, principal_id, user_id, target_id, goal_code,
                         content_version_id, content_epoch, time_zone_id, daily_quota_minutes,
                         status, plan_version, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """, plan.planId(), scope.tenantId(), scope.principalId(), scope.userId(), plan.targetId(),
                    plan.goalCode(), plan.contentVersionId(), plan.contentEpoch(), plan.timeZoneId(),
                    plan.dailyQuotaMinutes(), plan.status().name(), plan.version(), timestamp(plan.createdAt()),
                    timestamp(plan.updatedAt()));
        }
        for (LearningTask task : plan.tasks()) {
            saveTask(scope, plan.planId(), task);
        }
    }

    @Override
    public void saveSrsState(SrsState state) {
        LearningSchema.requireOwnedFact("srs_state");
        LearningTenantScope scope = state.scope();
        Optional<SrsState> current = findSrsState(scope, state.itemType(), state.itemId());
        if (current.isEmpty()) {
            jdbc.update("""
                    INSERT INTO learning_runtime_srs_state
                        (srs_state_id, tenant_id, principal_id, user_id, item_type, target_id, item_id,
                         content_version_id, stage, easiness_factor, repetitions, interval_days,
                         lapse_count, time_zone_id, due_at, last_reviewed_at, state_version)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """, state.srsStateId(), scope.tenantId(), scope.principalId(), scope.userId(),
                    state.itemType().name(), state.targetId(), state.itemId(), state.contentVersionId(),
                    state.stage().name(), state.easinessFactor(), state.repetitions(), state.intervalDays(),
                    state.lapseCount(), state.timeZoneId(), timestamp(state.dueAt()), timestamp(state.lastReviewedAt()),
                    state.stateVersion());
            return;
        }
        requireOwner(scope, current.get().scope());
        if (current.get().srsStateId() != state.srsStateId()
                || current.get().stateVersion() + 1 != state.stateVersion()) {
            throw new LearningDomainException(LearningDecisionCode.VERSION_CONFLICT,
                    "SRS state version does not advance the durable fact");
        }
        jdbc.update("""
                UPDATE learning_runtime_srs_state
                   SET target_id = ?, content_version_id = ?, stage = ?, easiness_factor = ?,
                       repetitions = ?, interval_days = ?, lapse_count = ?, time_zone_id = ?,
                       due_at = ?, last_reviewed_at = ?, state_version = ?
                 WHERE tenant_id = ? AND principal_id = ? AND user_id = ?
                   AND item_type = ? AND item_id = ? AND state_version = ?
                """, state.targetId(), state.contentVersionId(), state.stage().name(), state.easinessFactor(),
                state.repetitions(), state.intervalDays(), state.lapseCount(), state.timeZoneId(),
                timestamp(state.dueAt()), timestamp(state.lastReviewedAt()), state.stateVersion(),
                scope.tenantId(), scope.principalId(), scope.userId(), state.itemType().name(), state.itemId(),
                current.get().stateVersion());
    }

    @Override
    public void saveReviewEvent(ReviewEvent event) {
        LearningSchema.requireOwnedFact("review_event");
        LearningTenantScope scope = event.scope();
        List<ReviewEvent> existing = jdbc.query("""
                SELECT review_event_id, tenant_id, principal_id, user_id, item_type, target_id, item_id,
                       content_version_id, algorithm_version, srs_state_id, state_version, raw_quality,
                       effective_quality, confidence, reviewed_at, client_event_id
                  FROM learning_runtime_review_event
                 WHERE tenant_id = ? AND principal_id = ? AND user_id = ? AND client_event_id = ?
                """, this::mapReviewEvent, scope.tenantId(), scope.principalId(), scope.userId(),
                event.clientEventId());
        if (!existing.isEmpty()) {
            ReviewEvent previous = existing.getFirst();
            if (sameReview(previous, event)) {
                return;
            }
            throw new LearningDomainException(LearningDecisionCode.IDEMPOTENCY_CONFLICT,
                    "review client event already belongs to another review");
        }
        jdbc.update("""
                INSERT INTO learning_runtime_review_event
                    (review_event_id, tenant_id, principal_id, user_id, item_type, target_id, item_id,
                     content_version_id, algorithm_version, srs_state_id, state_version, raw_quality,
                     effective_quality, confidence, reviewed_at, client_event_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, event.reviewEventId(), scope.tenantId(), scope.principalId(), scope.userId(),
                event.itemType().name(), event.targetId(), event.itemId(), event.contentVersionId(),
                event.algorithmVersion(), event.srsStateId(), event.stateVersion(), event.rawQuality(),
                event.effectiveQuality(), event.confidence().name(), timestamp(event.reviewedAt()), event.clientEventId());
    }

    @Override
    public void saveMastery(MasteryProjection projection) {
        LearningSchema.requireOwnedFact("mastery_projection");
        LearningTenantScope scope = projection.scope();
        Optional<MasteryProjection> current = findMastery(scope, projection.itemType(), projection.itemId());
        String evidenceJson = serialize(projection.appliedEvidenceIds());
        if (current.isEmpty()) {
            jdbc.update("""
                    INSERT INTO learning_runtime_mastery_projection
                        (tenant_id, principal_id, user_id, item_type, item_id, content_version_id,
                         stage, score, attempt_count, correct_count, projection_version,
                         verification_stage, rule_version, last_evidence_at, applied_evidence_ids_json)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """, scope.tenantId(), scope.principalId(), scope.userId(), projection.itemType().name(),
                    projection.itemId(), projection.contentVersionId(), projection.stage().name(), projection.score(),
                    projection.attemptCount(), projection.correctCount(), projection.version(),
                    projection.verificationStage().name(), projection.ruleVersion(), timestamp(projection.lastEvidenceAt()),
                    evidenceJson);
            return;
        }
        requireOwner(scope, current.get().scope());
        if (current.get().version() + 1 != projection.version()) {
            throw new LearningDomainException(LearningDecisionCode.VERSION_CONFLICT,
                    "mastery projection version does not advance the durable fact");
        }
        jdbc.update("""
                UPDATE learning_runtime_mastery_projection
                   SET content_version_id = ?, stage = ?, score = ?, attempt_count = ?, correct_count = ?,
                       projection_version = ?, verification_stage = ?, rule_version = ?,
                       last_evidence_at = ?, applied_evidence_ids_json = ?
                 WHERE tenant_id = ? AND principal_id = ? AND user_id = ? AND item_type = ? AND item_id = ?
                   AND projection_version = ?
                """, projection.contentVersionId(), projection.stage().name(), projection.score(),
                projection.attemptCount(), projection.correctCount(), projection.version(),
                projection.verificationStage().name(), projection.ruleVersion(), timestamp(projection.lastEvidenceAt()),
                evidenceJson, scope.tenantId(), scope.principalId(), scope.userId(), projection.itemType().name(),
                projection.itemId(), current.get().version());
    }

    @Override
    public void saveProgress(LearningProgress progress) {
        LearningSchema.requireOwnedFact("learning_progress");
        LearningTenantScope scope = progress.scope();
        Optional<LearningProgress> current = findProgress(scope, progress.planId(), progress.taskId());
        if (current.isEmpty()) {
            if (progress.version() != 1) {
                throw new LearningDomainException(LearningDecisionCode.VERSION_CONFLICT,
                        "new durable progress must start at version one");
            }
            jdbc.update("""
                    INSERT INTO learning_runtime_progress
                        (tenant_id, principal_id, user_id, plan_id, task_id, completed_units,
                         total_units, study_seconds, progress_version, last_activity_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """, scope.tenantId(), scope.principalId(), scope.userId(), progress.planId(), progress.taskId(),
                    progress.completedUnits(), progress.totalUnits(), progress.studySeconds(), progress.version(),
                    timestamp(progress.lastActivityAt()));
            return;
        }
        if (current.get().version() + 1 != progress.version()) {
            throw new LearningDomainException(LearningDecisionCode.VERSION_CONFLICT,
                    "progress version does not advance the durable fact");
        }
        jdbc.update("""
                UPDATE learning_runtime_progress
                   SET completed_units = ?, total_units = ?, study_seconds = ?, progress_version = ?,
                       last_activity_at = ?
                 WHERE tenant_id = ? AND principal_id = ? AND user_id = ? AND plan_id = ? AND task_id = ?
                   AND progress_version = ?
                """, progress.completedUnits(), progress.totalUnits(), progress.studySeconds(), progress.version(),
                timestamp(progress.lastActivityAt()), scope.tenantId(), scope.principalId(), scope.userId(),
                progress.planId(), progress.taskId(), current.get().version());
    }

    @Override
    public void saveReviewQueue(ReviewQueueSnapshot snapshot) {
        LearningSchema.requireOwnedFact("review_queue_snapshot");
        LearningTenantScope scope = snapshot.scope();
        jdbc.update("""
                INSERT INTO learning_runtime_review_queue_snapshot
                    (schedule_snapshot_id, tenant_id, principal_id, user_id, local_date,
                     time_zone_id, rules_version, item_count, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE item_count = VALUES(item_count), rules_version = VALUES(rules_version)
                """, snapshot.scheduleSnapshotId(), scope.tenantId(), scope.principalId(), scope.userId(),
                Date.valueOf(snapshot.localDate()), snapshot.timeZoneId(), snapshot.rulesVersion(),
                snapshot.items().size(), timestamp(Instant.now()));
        int order = 0;
        for (SrsState state : snapshot.items()) {
            jdbc.update("""
                    INSERT INTO learning_runtime_review_queue_item
                        (schedule_snapshot_id, tenant_id, principal_id, user_id, item_order, srs_state_id,
                         item_type, item_id, due_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON DUPLICATE KEY UPDATE item_order = VALUES(item_order), due_at = VALUES(due_at)
                    """, snapshot.scheduleSnapshotId(), scope.tenantId(), scope.principalId(), scope.userId(),
                    order++, state.srsStateId(), state.itemType().name(), state.itemId(), timestamp(state.dueAt()));
        }
    }

    @Override
    public void appendOutbox(LearningOutboxEvent event) {
        LearningSchema.requireOwnedFact("outbox_event");
        LearningTenantScope scope = event.scope();
        List<String> existing = jdbc.query("""
                SELECT event_id
                  FROM learning_runtime_outbox_event
                 WHERE tenant_id = ? AND principal_id = ? AND user_id = ? AND dedupe_key = ?
                """, (rs, rowNum) -> rs.getString(1), scope.tenantId(), scope.principalId(), scope.userId(),
                event.dedupeKey());
        if (!existing.isEmpty()) {
            return;
        }
        jdbc.update("""
                INSERT INTO learning_runtime_outbox_event
                    (event_id, tenant_id, principal_id, user_id, aggregate_type, aggregate_id,
                     event_type, schema_version, event_version, actor_id, dedupe_key, payload_json,
                     request_id, trace_id, occurred_at, status, attempt_count, available_at, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', 0, ?, ?)
                """, event.eventId().toString(), scope.tenantId(), scope.principalId(), scope.userId(),
                event.aggregateType(), event.aggregateId(), event.eventType(), event.schemaVersion(), event.version(),
                event.actorId(), event.dedupeKey(), serialize(event.payload()), event.requestId(), event.traceId(),
                timestamp(event.occurredAt()), timestamp(event.occurredAt()), timestamp(event.occurredAt()));
    }

    @Override
    public List<LearningOutboxEvent> outboxEvents() {
        return jdbc.query("""
                SELECT event_id, tenant_id, principal_id, user_id, aggregate_type, aggregate_id,
                       event_type, schema_version, event_version, actor_id, dedupe_key, payload_json,
                       request_id, trace_id, occurred_at
                  FROM learning_runtime_outbox_event
                 ORDER BY created_at, event_id
                """, this::mapOutboxEvent);
    }

    private void saveTask(LearningTenantScope scope, long planId, LearningTask task) {
        List<OwnerRow> owners = jdbc.query("""
                SELECT tenant_id, principal_id, user_id, learning_plan_id
                  FROM learning_runtime_task
                 WHERE learning_task_id = ?
                """, (rs, rowNum) -> new OwnerRow(rs.getString("tenant_id"), rs.getString("principal_id"),
                        rs.getLong("user_id"), rs.getLong("learning_plan_id")), task.taskId());
        if (!owners.isEmpty()) {
            OwnerRow owner = owners.getFirst();
            requireOwner(scope, owner);
            if (owner.resourceId() != planId) {
                throw new LearningDomainException(LearningDecisionCode.OWNER_MISMATCH,
                        "learning task is attached to another plan");
            }
            jdbc.update("""
                    UPDATE learning_runtime_task
                       SET task_type = ?, content_item_id = ?, content_version_id = ?, planned_local_date = ?,
                           task_status = ?, progress_percent = ?, completion_version = ?, last_updated_at = ?
                     WHERE learning_task_id = ? AND learning_plan_id = ? AND tenant_id = ? AND principal_id = ? AND user_id = ?
                    """, task.taskType().name(), task.contentItemId(), task.contentVersionId(),
                    Date.valueOf(task.plannedLocalDate()), task.status().name(), task.progressPercent(),
                    task.completionVersion(), timestamp(task.lastUpdatedAt()), task.taskId(), planId,
                    scope.tenantId(), scope.principalId(), scope.userId());
            return;
        }
        jdbc.update("""
                INSERT INTO learning_runtime_task
                    (learning_task_id, learning_plan_id, tenant_id, principal_id, user_id, task_type,
                     content_item_id, content_version_id, planned_local_date, task_status, progress_percent,
                     completion_version, last_updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, task.taskId(), planId, scope.tenantId(), scope.principalId(), scope.userId(), task.taskType().name(),
                task.contentItemId(), task.contentVersionId(), Date.valueOf(task.plannedLocalDate()), task.status().name(),
                task.progressPercent(), task.completionVersion(), timestamp(task.lastUpdatedAt()));
    }

    private LearningPlan loadTasks(LearningTenantScope scope, LearningPlan plan) {
        List<LearningTask> tasks = jdbc.query("""
                SELECT learning_task_id, task_type, content_item_id, content_version_id, planned_local_date,
                       task_status, progress_percent, completion_version, last_updated_at
                  FROM learning_runtime_task
                 WHERE learning_plan_id = ? AND tenant_id = ? AND principal_id = ? AND user_id = ?
                 ORDER BY learning_task_id
                """, this::mapTask, plan.planId(), scope.tenantId(), scope.principalId(), scope.userId());
        return new LearningPlan(plan.planId(), plan.scope(), plan.targetId(), plan.goalCode(), plan.contentVersionId(),
                plan.contentEpoch(), plan.timeZoneId(), plan.dailyQuotaMinutes(), plan.status(), plan.version(), tasks,
                plan.createdAt(), plan.updatedAt());
    }

    private LearningPlan mapPlan(ResultSet rs, int rowNum) throws SQLException {
        return new LearningPlan(rs.getLong("plan_id"),
                new LearningTenantScope(rs.getString("tenant_id"), rs.getString("principal_id"), rs.getLong("user_id")),
                rs.getLong("target_id"), rs.getString("goal_code"), rs.getLong("content_version_id"),
                rs.getLong("content_epoch"), rs.getString("time_zone_id"), rs.getInt("daily_quota_minutes"),
                LearningPlanStatus.valueOf(rs.getString("status")), rs.getLong("plan_version"), List.of(),
                instant(rs, "created_at"), instant(rs, "updated_at"));
    }

    private LearningTask mapTask(ResultSet rs, int rowNum) throws SQLException {
        return new LearningTask(rs.getLong("learning_task_id"), LearningTaskType.valueOf(rs.getString("task_type")),
                rs.getLong("content_item_id"), rs.getLong("content_version_id"),
                rs.getDate("planned_local_date").toLocalDate(), LearningTaskStatus.valueOf(rs.getString("task_status")),
                rs.getInt("progress_percent"), rs.getInt("completion_version"), instant(rs, "last_updated_at"));
    }

    private SrsState mapSrsState(ResultSet rs, int rowNum) throws SQLException {
        return new SrsState(rs.getLong("srs_state_id"),
                new LearningTenantScope(rs.getString("tenant_id"), rs.getString("principal_id"), rs.getLong("user_id")),
                LearningItemType.valueOf(rs.getString("item_type")), rs.getLong("target_id"), rs.getLong("item_id"),
                rs.getLong("content_version_id"), SrsStage.valueOf(rs.getString("stage")),
                rs.getDouble("easiness_factor"), rs.getInt("repetitions"), rs.getInt("interval_days"),
                rs.getInt("lapse_count"), rs.getString("time_zone_id"), instant(rs, "due_at"),
                nullableInstant(rs, "last_reviewed_at"), rs.getInt("state_version"));
    }

    private ReviewEvent mapReviewEvent(ResultSet rs, int rowNum) throws SQLException {
        return new ReviewEvent(rs.getLong("review_event_id"),
                new LearningTenantScope(rs.getString("tenant_id"), rs.getString("principal_id"), rs.getLong("user_id")),
                LearningItemType.valueOf(rs.getString("item_type")), rs.getLong("target_id"), rs.getLong("item_id"),
                rs.getLong("content_version_id"), rs.getString("algorithm_version"), rs.getLong("srs_state_id"),
                rs.getInt("state_version"), rs.getInt("raw_quality"), rs.getInt("effective_quality"),
                ReviewConfidence.valueOf(rs.getString("confidence")), instant(rs, "reviewed_at"),
                rs.getString("client_event_id"));
    }

    private LearningProgress mapProgress(ResultSet rs, int rowNum) throws SQLException {
        return new LearningProgress(
                new LearningTenantScope(rs.getString("tenant_id"), rs.getString("principal_id"), rs.getLong("user_id")),
                rs.getLong("plan_id"), rs.getLong("task_id"), rs.getInt("completed_units"), rs.getInt("total_units"),
                rs.getLong("study_seconds"), rs.getLong("progress_version"), instant(rs, "last_activity_at"));
    }

    private MasteryProjection mapMastery(ResultSet rs, int rowNum) throws SQLException {
        return new MasteryProjection(
                new LearningTenantScope(rs.getString("tenant_id"), rs.getString("principal_id"), rs.getLong("user_id")),
                LearningItemType.valueOf(rs.getString("item_type")), rs.getLong("item_id"),
                rs.getLong("content_version_id"), MasteryStage.valueOf(rs.getString("stage")), rs.getInt("score"),
                rs.getInt("attempt_count"), rs.getInt("correct_count"), rs.getLong("projection_version"),
                VerificationStage.valueOf(rs.getString("verification_stage")), rs.getString("rule_version"),
                instant(rs, "last_evidence_at"), readEvidenceIds(rs.getString("applied_evidence_ids_json")));
    }

    private LearningOutboxEvent mapOutboxEvent(ResultSet rs, int rowNum) throws SQLException {
        return new LearningOutboxEvent(UUID.fromString(rs.getString("event_id")),
                new LearningTenantScope(rs.getString("tenant_id"), rs.getString("principal_id"), rs.getLong("user_id")),
                rs.getString("aggregate_type"), rs.getString("aggregate_id"), rs.getString("event_type"),
                rs.getString("schema_version"), rs.getInt("event_version"), rs.getString("actor_id"),
                rs.getString("dedupe_key"), readPayload(rs.getString("payload_json")), rs.getString("request_id"),
                rs.getString("trace_id"), instant(rs, "occurred_at"));
    }

    private Optional<OwnerRow> ownerForPlan(long planId) {
        return jdbc.query("SELECT tenant_id, principal_id, user_id, plan_id FROM learning_runtime_plan WHERE plan_id = ?",
                (rs, rowNum) -> new OwnerRow(rs.getString("tenant_id"), rs.getString("principal_id"),
                        rs.getLong("user_id"), rs.getLong("plan_id")), planId).stream().findFirst();
    }

    private void requireOwner(LearningTenantScope expected, OwnerRow actual) {
        if (!expected.tenantId().equals(actual.tenantId()) || !expected.principalId().equals(actual.principalId())
                || expected.userId() != actual.userId()) {
            throw new LearningDomainException(LearningDecisionCode.OWNER_MISMATCH,
                    "learning fact is outside the verified owner scope");
        }
    }

    private void requireOwner(LearningTenantScope expected, LearningTenantScope actual) {
        if (!expected.equals(actual)) {
            throw new LearningDomainException(LearningDecisionCode.OWNER_MISMATCH,
                    "learning fact is outside the verified owner scope");
        }
    }

    private static void requireScope(LearningTenantScope expected, LearningTenantScope actual) {
        if (!expected.equals(actual)) {
            throw new LearningDomainException(LearningDecisionCode.OWNER_MISMATCH,
                    "planning key is outside the verified owner scope");
        }
    }

    private static boolean sameReview(ReviewEvent first, ReviewEvent second) {
        return first.scope().equals(second.scope()) && first.itemType() == second.itemType()
                && first.targetId() == second.targetId() && first.itemId() == second.itemId()
                && first.contentVersionId() == second.contentVersionId()
                && first.stateVersion() == second.stateVersion() && first.rawQuality() == second.rawQuality()
                && first.effectiveQuality() == second.effectiveQuality() && first.confidence() == second.confidence()
                && first.reviewedAt().equals(second.reviewedAt()) && first.clientEventId().equals(second.clientEventId());
    }

    private String serialize(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (Exception exception) {
            throw new JdbcLearningPersistenceException("learning fact could not be serialized", exception);
        }
    }

    private Object deserialize(String responseType, String responseJson) {
        try {
            return objectMapper.readValue(responseJson, responseClass(responseType));
        } catch (Exception exception) {
            throw new JdbcLearningPersistenceException(
                    "durable idempotency response cannot be safely replayed: " + responseType, exception);
        }
    }

    private String responseType(String operation) {
        return switch (operation) {
            case "plan.create", "plan.resume", "task.complete" -> "learning-plan";
            case "srs.queue.build" -> "review-queue";
            case "progress.record" -> "learning-progress";
            case "review.submit" -> "review-application";
            case "mastery.apply" -> "mastery-projection";
            default -> throw new JdbcLearningPersistenceException(
                    "no durable response codec is registered for operation: " + operation);
        };
    }

    @SuppressWarnings("unchecked")
    private Class<Object> responseClass(String type) {
        return switch (type) {
            case "learning-plan" -> (Class<Object>) (Class<?>) LearningPlan.class;
            case "review-queue" -> (Class<Object>) (Class<?>) ReviewQueueSnapshot.class;
            case "learning-progress" -> (Class<Object>) (Class<?>) LearningProgress.class;
            case "review-application" -> (Class<Object>) (Class<?>) LearningReviewService.ReviewApplication.class;
            case "mastery-projection" -> (Class<Object>) (Class<?>) MasteryProjection.class;
            default -> throw new JdbcLearningPersistenceException("unknown durable response type: " + type);
        };
    }

    private Set<String> readEvidenceIds(String json) {
        if (json == null || json.isBlank()) {
            return Set.of();
        }
        try {
            Object raw = objectMapper.readValue(json, Object.class);
            if (!(raw instanceof Collection<?> collection)) {
                throw new IllegalArgumentException("evidence replay history is not an array");
            }
            LinkedHashSet<String> values = new LinkedHashSet<>();
            for (Object value : collection) {
                if (!(value instanceof String string)) {
                    throw new IllegalArgumentException("evidence replay id is not text");
                }
                values.add(string);
            }
            return Set.copyOf(values);
        } catch (Exception exception) {
            throw new JdbcLearningPersistenceException("mastery replay history cannot be read", exception);
        }
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> readPayload(String json) {
        try {
            Object raw = objectMapper.readValue(json, Object.class);
            if (!(raw instanceof Map<?, ?> map)) {
                throw new IllegalArgumentException("outbox payload is not an object");
            }
            return (Map<String, Object>) map;
        } catch (Exception exception) {
            throw new JdbcLearningPersistenceException("outbox payload cannot be read", exception);
        }
    }

    private static Instant instant(ResultSet rs, String column) throws SQLException {
        Timestamp value = rs.getTimestamp(column);
        if (value == null) {
            throw new SQLException("required timestamp is null: " + column);
        }
        return value.toInstant();
    }

    private static Instant nullableInstant(ResultSet rs, String column) throws SQLException {
        Timestamp value = rs.getTimestamp(column);
        return value == null ? null : value.toInstant();
    }

    private static Timestamp timestamp(Instant instant) {
        return instant == null ? null : Timestamp.from(instant);
    }

    private record OwnerRow(String tenantId, String principalId, long userId, long resourceId) {
    }

    private record IdempotencyRow(String requestFingerprint, String responseType, String responseJson) {
    }
}
