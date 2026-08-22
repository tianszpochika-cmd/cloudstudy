package com.englishflow.learning.port;

import com.englishflow.learning.domain.LearningItemType;
import com.englishflow.learning.domain.LearningPrincipalContext;
import com.englishflow.learning.domain.LearningTaskType;

import java.time.LocalDate;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;

/** Read-only content-service contract. No answer rules or content tables cross this boundary. */
@FunctionalInterface
public interface PublishedContentPort {

    Optional<PublishedContentSnapshot> findLearnerSnapshot(
            LearningPrincipalContext principal, long contentVersionId);

    record PublishedContentSnapshot(
            long contentVersionId,
            long contentEpoch,
            String contentCode,
            Set<String> rights,
            List<LearningSeedItem> items) {

        public PublishedContentSnapshot {
            if (contentVersionId < 1 || contentEpoch < 1) {
                throw new IllegalArgumentException("content version and epoch must be positive");
            }
            if (contentCode == null || !contentCode.matches("[a-z][a-z0-9._-]{1,127}")) {
                throw new IllegalArgumentException("contentCode is invalid");
            }
            rights = rights == null ? Set.of() : Set.copyOf(rights);
            items = items == null ? List.of() : List.copyOf(items);
        }

        public boolean learnerReadable() {
            return rights.contains("LEARNER");
        }
    }

    record LearningSeedItem(
            LearningItemType itemType,
            long itemId,
            LearningTaskType taskType,
            LocalDate plannedLocalDate) {

        public LearningSeedItem {
            Objects.requireNonNull(itemType, "itemType is required");
            if (itemId < 1) {
                throw new IllegalArgumentException("itemId must be positive");
            }
            Objects.requireNonNull(taskType, "taskType is required");
            Objects.requireNonNull(plannedLocalDate, "plannedLocalDate is required");
        }
    }
}
