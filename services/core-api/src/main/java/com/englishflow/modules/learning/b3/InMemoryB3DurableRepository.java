package com.englishflow.modules.learning.b3;

import java.util.List;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Repository;

/** Explicit development adapter; it keeps the B3 unit-test baseline runnable without infrastructure. */
@Repository
@ConditionalOnProperty(prefix = "englishflow.b3", name = "persistence", havingValue = "memory", matchIfMissing = true)
public final class InMemoryB3DurableRepository implements B3DurableRepository {
    @Override public void savePracticeSession(PracticeSession session) {}
    @Override public void saveShadowingSession(ShadowingSession session) {}
    @Override public void saveRoleplaySession(RoleplaySession session) {}
    @Override public void saveAttempt(Attempt attempt) {}
    @Override public void saveReadingProgress(ReadingProgress progress) {}
    @Override public void saveRecording(Recording recording) {}
    @Override public void saveSelfRating(long userId, String recordingUuid, String ratingCode, List<String> tags, String clientEventId) {}
    @Override public void saveOfflineChange(OfflineChange change) {}
    @Override public void saveOfflineCursor(OfflineCursor cursor) {}
    @Override public void saveOfflineConflict(long userId, String changeId, String entityType, String entityId, long localVersion, long serverVersion, String resolutionCode) {}
}
