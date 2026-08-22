package com.englishflow.learning.port;

import com.englishflow.learning.domain.LearningPrincipalContext;
import com.englishflow.learning.domain.LearningTenantScope;

import java.time.ZoneId;
import java.util.Objects;
import java.util.Optional;

/** Read-only contract to learner-service; it must not read learner tables directly. */
@FunctionalInterface
public interface LearnerTargetPort {

    Optional<LearnerTargetSnapshot> findTarget(LearningPrincipalContext principal, long targetId);

    record LearnerTargetSnapshot(
            LearningTenantScope scope,
            long targetId,
            String goalCode,
            int dailyQuotaMinutes,
            String timeZoneId,
            long contentVersionId,
            long targetVersion) {

        public LearnerTargetSnapshot {
            Objects.requireNonNull(scope, "scope is required");
            if (targetId < 1 || contentVersionId < 1 || targetVersion < 1) {
                throw new IllegalArgumentException("target identifiers must be positive");
            }
            if (goalCode == null || !goalCode.matches("[a-z][a-z0-9._-]{1,63}")) {
                throw new IllegalArgumentException("goalCode is invalid");
            }
            if (dailyQuotaMinutes < 5 || dailyQuotaMinutes > 240) {
                throw new IllegalArgumentException("dailyQuotaMinutes must be between 5 and 240");
            }
            if (timeZoneId == null || timeZoneId.isBlank()) {
                throw new IllegalArgumentException("timeZoneId is required");
            }
            ZoneId.of(timeZoneId);
        }
    }
}
