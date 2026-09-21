package com.englishflow.content.domain;

import java.time.Instant;
import java.util.Objects;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Content-owned scheduled publish task for PACK/LEXEME/ITEM targets.
 * Execution re-validates owner facts at run time; a stale pin fails the task
 * instead of publishing the wrong version.
 */
public final class ScheduledPublishTask {

    public static final Set<String> TARGETS = Set.of("PACK", "LEXEME", "ITEM");
    public static final Set<String> STATES = Set.of("SCHEDULED", "CANCELLED", "EXECUTED", "FAILED");

    private static final Pattern SAFE_ID = Pattern.compile("[A-Za-z0-9][A-Za-z0-9._:-]{0,127}");

    private final String taskId;
    private final String tenantId;
    private final String packCode;
    private final String targetType;
    private final String targetRef;
    private final Long expectedStateVersion;
    private final Instant runAt;
    private String status;
    private final String reasonCode;
    private final String cohort;
    private String failureCode;
    private final String createdBy;
    private final Instant createdAt;
    private Instant updatedAt;

    public ScheduledPublishTask(
            String taskId, String tenantId, String packCode, String targetType, String targetRef,
            Long expectedStateVersion, Instant runAt, String status, String reasonCode,
            String cohort, String failureCode, String createdBy, Instant createdAt, Instant updatedAt) {
        this.taskId = requireId(taskId, "taskId");
        this.tenantId = requireId(tenantId, "tenantId");
        this.packCode = requireId(packCode, "packCode");
        if (!TARGETS.contains(targetType)) {
            throw ContentOperationException.badRequest("SCHEDULE_TARGET_INVALID", "target type is invalid");
        }
        this.targetType = targetType;
        this.targetRef = requireId(targetRef, "targetRef");
        this.expectedStateVersion = expectedStateVersion;
        this.runAt = Objects.requireNonNull(runAt, "runAt is required");
        if (!STATES.contains(status)) {
            throw ContentOperationException.badRequest("SCHEDULE_STATUS_INVALID", "task status is invalid");
        }
        this.status = status;
        this.reasonCode = reasonCode;
        if (cohort != null && (cohort.isBlank() || cohort.length() > 64)) {
            throw ContentOperationException.badRequest("SCHEDULE_FIELD_INVALID", "cohort must be 1..64 characters");
        }
        this.cohort = cohort == null || cohort.isBlank() ? null : cohort.trim();
        this.failureCode = failureCode;
        this.createdBy = requireId(createdBy, "createdBy");
        this.createdAt = Objects.requireNonNull(createdAt, "createdAt is required");
        this.updatedAt = Objects.requireNonNull(updatedAt, "updatedAt is required");
    }

    public static ScheduledPublishTask schedule(
            String taskId, String packCode, String targetType, String targetRef,
            Long expectedStateVersion, Instant runAt, String reasonCode, String cohort,
            String createdBy, Instant now) {
        if (!runAt.isAfter(now)) {
            throw ContentOperationException.badRequest("SCHEDULE_TIME_INVALID", "runAt must be in the future");
        }
        return new ScheduledPublishTask(taskId, "platform", packCode, targetType, targetRef,
                expectedStateVersion, runAt, "SCHEDULED", reasonCode, cohort, null, createdBy, now, now);
    }

    public String taskId() {
        return taskId;
    }

    public String tenantId() {
        return tenantId;
    }

    public String packCode() {
        return packCode;
    }

    public String targetType() {
        return targetType;
    }

    public String targetRef() {
        return targetRef;
    }

    public Long expectedStateVersion() {
        return expectedStateVersion;
    }

    public Instant runAt() {
        return runAt;
    }

    public String status() {
        return status;
    }

    public String reasonCode() {
        return reasonCode;
    }

    /** Gray cohort label (B3 metadata; learner enforcement arrives in B4). */
    public String cohort() {
        return cohort;
    }

    public String failureCode() {
        return failureCode;
    }

    public String createdBy() {
        return createdBy;
    }

    public Instant createdAt() {
        return createdAt;
    }

    public Instant updatedAt() {
        return updatedAt;
    }

    public void cancel(Instant now) {
        if (!"SCHEDULED".equals(status)) {
            throw ContentOperationException.conflict("SCHEDULE_STATE_INVALID", "only a SCHEDULED task can be cancelled");
        }
        this.status = "CANCELLED";
        this.updatedAt = now;
    }

    public void markExecuted(Instant now) {
        this.status = "EXECUTED";
        this.updatedAt = now;
    }

    public void markFailed(String failureCode, Instant now) {
        this.status = "FAILED";
        this.failureCode = failureCode;
        this.updatedAt = now;
    }

    private static String requireId(String value, String field) {
        Objects.requireNonNull(value, field + " is required");
        if (!SAFE_ID.matcher(value).matches()) {
            throw ContentOperationException.badRequest("SCHEDULE_FIELD_INVALID", field + " has an unsafe format");
        }
        return value;
    }
}
