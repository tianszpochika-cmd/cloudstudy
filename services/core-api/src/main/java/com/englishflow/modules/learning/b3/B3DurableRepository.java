package com.englishflow.modules.learning.b3;

import java.time.Instant;
import java.util.List;

/**
 * Durable boundary for learner-side B3 writes. The default development adapter
 * is intentionally in-memory; the JDBC adapter is enabled explicitly with
 * B3_PERSISTENCE_MODE=jdbc and writes to the V0012 tables.
 */
public interface B3DurableRepository {
    record PracticeSession(String sessionUuid, long userId, String domainCode, long contentId,
                           long contentVersionId, String ruleVersion, String status,
                           int currentIndex, long positionVersion) {}

    record ShadowingSession(String sessionUuid, long userId, String sourceSegmentCode,
                            int targetGapMs, int attemptCount, int lastPositionMs,
                            String status, long contentVersionId, String clientEventId) {}

    record RoleplaySession(String sessionUuid, long userId, String roleplayCode,
                           int turnIndex, long contentVersionId, String status,
                           String clientEventId) {}

    record Attempt(long userId, String itemCode, long contentVersionId, String answerHash,
                   double score, Boolean correct, String feedbackCode, String clientEventId) {}

    record ReadingProgress(long userId, long articleId, long contentVersionId, String blockCode,
                           String tokenCode, double progressPercent, long positionVersion,
                           String clientEventId) {}

    record Recording(long userId, String recordingUuid, String sourceSegmentCode, String contentHash,
                     int durationMs, String storageMode, String status, Instant retentionUntil,
                     String clientEventId) {}

    record OfflineChange(long userId, String deviceId, String changeId, String clientBatchId,
                         String entityType, String entityId, long entityVersion, String operation,
                         String payloadHash, Instant occurredAt, String status) {}

    record OfflineCursor(long userId, String deviceId, long cursorValue, String schemaVersion) {}

    void savePracticeSession(PracticeSession session);

    void saveShadowingSession(ShadowingSession session);

    void saveRoleplaySession(RoleplaySession session);

    void saveAttempt(Attempt attempt);

    void saveReadingProgress(ReadingProgress progress);

    void saveRecording(Recording recording);

    void saveSelfRating(long userId, String recordingUuid, String ratingCode, List<String> tags,
                        String clientEventId);

    void saveOfflineChange(OfflineChange change);

    void saveOfflineCursor(OfflineCursor cursor);

    void saveOfflineConflict(long userId, String changeId, String entityType, String entityId,
                             long localVersion, long serverVersion, String resolutionCode);
}
