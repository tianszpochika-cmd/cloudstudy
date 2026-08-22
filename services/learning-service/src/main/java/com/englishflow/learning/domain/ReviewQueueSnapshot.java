package com.englishflow.learning.domain;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;

/** A replayable, de-duplicated view of the SRS queue for one learner local day. */
public record ReviewQueueSnapshot(
        long scheduleSnapshotId,
        LearningTenantScope scope,
        LocalDate localDate,
        String timeZoneId,
        String rulesVersion,
        List<SrsState> items) {

    public ReviewQueueSnapshot {
        if (scheduleSnapshotId < 1) {
            throw new IllegalArgumentException("scheduleSnapshotId must be positive");
        }
        Objects.requireNonNull(scope, "scope is required");
        Objects.requireNonNull(localDate, "localDate is required");
        if (timeZoneId == null || timeZoneId.isBlank()) {
            throw new IllegalArgumentException("timeZoneId is required");
        }
        ZoneId.of(timeZoneId);
        if (rulesVersion == null || rulesVersion.isBlank() || rulesVersion.length() > 64) {
            throw new IllegalArgumentException("rulesVersion is required and bounded");
        }
        items = items == null ? List.of() : List.copyOf(items);
        Set<Long> ids = new HashSet<>();
        for (SrsState item : items) {
            if (!scope.equals(item.scope()) || !ids.add(item.srsStateId())) {
                throw new IllegalArgumentException("queue items must be same-owner and unique");
            }
        }
    }
}
