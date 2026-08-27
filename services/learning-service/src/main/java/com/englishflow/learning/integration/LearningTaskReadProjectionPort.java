package com.englishflow.learning.integration;

import java.util.Optional;

/** Learning owner read port; contentVersion is part of the cache/contract key. */
public interface LearningTaskReadProjectionPort {
    Optional<LearningTaskReadProjection> findToday(String subject, String tenantId, String taskId, long contentVersion);
}
