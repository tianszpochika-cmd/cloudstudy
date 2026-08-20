package com.englishflow.modules.learning.b3;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class B3MultimodalServiceTest {
    private static final long USER_ID = 42L;
    private B3MultimodalService service;
    private SpyDurableRepository durable;

    @BeforeEach
    void setUp() {
        durable = new SpyDurableRepository();
        service = new B3MultimodalService(Clock.fixed(Instant.parse("2026-08-21T00:00:00Z"), ZoneOffset.UTC), durable);
    }

    @Test
    void grammarAttemptUpdatesMasteryWithDeterministicRuleResult() {
        Map<String, Object> result = service.submitGrammarAttempt(USER_ID,
                Map.of("exerciseId", 3701L, "answer", Map.of("value", "has"), "contentVersionId", 301L),
                "grammar-attempt-1");

        Map<?, ?> data = data(result);
        assertEquals(Boolean.TRUE, data.get("correct"));
        assertEquals("B3-RULE-1", data.get("ruleVersion"));
        assertEquals("REVIEW", ((Map<?, ?>) data.get("mastery")).get("level"));
        assertEquals(6, ((Map<?, ?>) data.get("mastery")).get("dimensions") instanceof Map<?, ?> dimensions
                ? dimensions.size() : 0);
        assertEquals(1, durable.attempts.size());
        assertEquals("GRAMMAR:3701", durable.attempts.get(0).itemCode());
    }

    @Test
    void idempotencyReplaysSameResultAndRejectsChangedBody() {
        Map<String, Object> body = Map.of("exerciseId", 3701L, "answer", Map.of("value", "has"), "contentVersionId", 301L);
        Map<String, Object> first = service.submitGrammarAttempt(USER_ID, body, "grammar-attempt-2");
        Map<String, Object> replay = service.submitGrammarAttempt(USER_ID, body, "grammar-attempt-2");

        assertSame(first, replay);
        B3Exception conflict = assertThrows(B3Exception.class, () -> service.submitGrammarAttempt(USER_ID,
                Map.of("exerciseId", 3701L, "answer", Map.of("value", "have"), "contentVersionId", 301L),
                "grammar-attempt-2"));
        assertEquals("IDEMPOTENCY_CONFLICT", conflict.code());
        assertEquals(409, conflict.status());
    }

    @Test
    void staleContentVersionIsRejectedBeforeAWrite() {
        B3Exception exception = assertThrows(B3Exception.class, () -> service.submitGrammarAttempt(USER_ID,
                Map.of("exerciseId", 3701L, "answer", Map.of("value", "has"), "contentVersionId", 300L),
                "grammar-attempt-3"));

        assertEquals("CONTENT_VERSION_UNAVAILABLE", exception.code());
        assertEquals(409, exception.status());
        assertTrue(service.getGrammarMastery(USER_ID, 3103L).get("data") instanceof Map<?, ?> data
                && ((List<?>) data.get("items")).isEmpty());
    }

    @Test
    void grammarSessionUsesServerExerciseKeysAndIgnoresClientAcceptedFlag() {
        Map<?, ?> session = data(service.createGrammarSession(USER_ID,
                Map.of("grammarPointId", 3103L, "targetCount", 2, "contentVersionId", 301L), "grammar-session-1"));
        assertEquals(2, ((List<?>) session.get("exercises")).size());
        assertFalse(((Map<?, ?>) ((List<?>) session.get("exercises")).get(0)).containsKey("expectedAnswer"));

        String sessionId = String.valueOf(session.get("sessionId"));
        Map<?, ?> result = data(service.answerGrammar(USER_ID, sessionId,
                Map.of("exerciseId", 3701L, "answer", Map.of("value", "have"), "accepted", true,
                        "clientAnswerId", "grammar-session-answer-1", "contentVersionId", 301L), "grammar-session-answer-key-1"));
        assertEquals(Boolean.FALSE, result.get("correct"));
        assertEquals(Boolean.TRUE, result.get("answersRemainProtected"));
        assertEquals(2, durable.sessions.size());
        assertEquals(1, durable.sessions.get(1).currentIndex());
    }

    @Test
    void proofreadingPublicViewDoesNotLeakAnswerAndCorrectionUsesPromptBinding() {
        Map<String, Object> list = service.listProofreadingExercises(20);
        Map<?, ?> issue = (Map<?, ?>) ((List<?>) data(list).get("items")).get(0);
        assertTrue(issue.containsKey("wrongText"));
        assertFalse(issue.containsKey("correctText"));

        Map<?, ?> wrong = data(service.submitCorrection(USER_ID,
                Map.of("promptId", 3302L, "answer", "The team have completed the task.",
                        "clientSubmissionId", "correction-submit-1", "contentVersionId", 301L), "correction-key-1"));
        assertEquals(Boolean.FALSE, wrong.get("correct"));
        Map<?, ?> correct = data(service.submitCorrection(USER_ID,
                Map.of("promptId", 3302L, "answer", "The team has completed the task.",
                        "clientSubmissionId", "correction-submit-2", "contentVersionId", 301L), "correction-key-2"));
        assertEquals(Boolean.TRUE, correct.get("correct"));
    }

    @Test
    void listeningProgressIsVersionedAndDurablyRecorded() {
        Map<?, ?> session = data(service.createListeningSession(USER_ID,
                Map.of("materialId", 3401L, "contentVersionId", 301L, "mode", "LISTEN"), "listening-session-1"));
        String sessionId = String.valueOf(session.get("sessionId"));
        Map<?, ?> saved = data(service.updateListeningProgress(USER_ID, sessionId,
                Map.of("mediaPositionMs", 600, "positionVersion", 2, "contentVersionId", 301L,
                        "clientEventId", "listening-progress-1"), "listening-progress-key-1"));
        assertEquals(600, saved.get("positionMs"));
        assertEquals(2L, saved.get("positionVersion"));
        assertEquals(2, durable.sessions.get(durable.sessions.size() - 1).positionVersion());

        B3Exception conflict = assertThrows(B3Exception.class, () -> service.updateListeningProgress(USER_ID, sessionId,
                Map.of("mediaPositionMs", 400, "positionVersion", 1, "contentVersionId", 301L,
                        "clientEventId", "listening-progress-2"), "listening-progress-key-2"));
        assertEquals("PROGRESS_VERSION_CONFLICT", conflict.code());
    }

    @Test
    void roleplayRejectsUnpublishedChoiceAndRequiresRecordingOnRecordingTurn() {
        Map<?, ?> session = data(service.createRoleplaySession(USER_ID,
                Map.of("roleplayCode", "COFFEE_SHOP_V1", "contentVersionId", 301L,
                        "clientEventId", "roleplay-session-1"), "roleplay-session-key-1"));
        String sessionId = String.valueOf(session.get("roleplaySessionId"));
        B3Exception invalidChoice = assertThrows(B3Exception.class, () -> service.submitRoleplayTurn(USER_ID, sessionId,
                Map.of("turnIndex", 0, "choiceCode", "MARS", "recordingId", "", "clientEventId", "roleplay-turn-1"), "roleplay-turn-key-1"));
        assertEquals("INVALID_BRANCH_CHOICE", invalidChoice.code());

        Map<?, ?> first = data(service.submitRoleplayTurn(USER_ID, sessionId,
                Map.of("turnIndex", 0, "choiceCode", "COFFEE", "recordingId", "", "clientEventId", "roleplay-turn-2"), "roleplay-turn-key-2"));
        assertEquals(1, first.get("nextTurnIndex"));
        B3Exception recordingRequired = assertThrows(B3Exception.class, () -> service.submitRoleplayTurn(USER_ID, sessionId,
                Map.of("turnIndex", 1, "recordingId", "", "clientEventId", "roleplay-turn-3"), "roleplay-turn-key-3"));
        assertEquals("ROLEPLAY_RECORDING_REQUIRED", recordingRequired.code());
    }

    @Test
    void recordingRequiresARealLookingSha256AndBoundedDuration() {
        B3Exception hashError = assertThrows(B3Exception.class, () -> service.createRecording(USER_ID,
                Map.of("sourceSegmentId", "seg-1", "durationMs", 1200, "contentHash", "0".repeat(64)),
                "recording-1"));
        assertEquals("RECORDING_HASH_INVALID", hashError.code());

        Map<String, Object> result = service.createRecording(USER_ID,
                Map.of("sourceSegmentId", "seg-1", "durationMs", 1200, "contentHash", "a".repeat(64)),
                "recording-2");
        Map<?, ?> recording = data(result);
        assertEquals("LOCAL_ONLY", recording.get("status"));
        assertFalse(recording.containsKey("contentHash"));
        assertEquals(1, durable.recordings.size());

        B3Exception encryptionError = assertThrows(B3Exception.class, () -> service.createRecording(USER_ID,
                Map.of("sourceSegmentId", "seg-1", "durationMs", 1200, "contentHash", "a".repeat(64), "storageMode", "PLAINTEXT"),
                "recording-3"));
        assertEquals("RECORDING_ENCRYPTION_REQUIRED", encryptionError.code());
    }

    @Test
    void offlinePackageDoesNotPretendMediaIsDownloaded() {
        Map<String, Object> packageResult = service.createOfflinePackage(USER_ID,
                Map.of("materialIds", List.of(3401L), "deviceId", "device-1", "contentVersionId", 301L),
                "offline-package-1");
        Map<?, ?> offlinePackage = data(packageResult);
        assertEquals("PENDING_MEDIA", offlinePackage.get("status"));

        B3Exception mediaError = assertThrows(B3Exception.class, () -> service.downloadOfflineAsset(USER_ID,
                ((Number) offlinePackage.get("packageId")).longValue(), "b3-audio-3401", "bytes=0-100"));
        assertEquals("MEDIA_NOT_READY", mediaError.code());
        assertTrue(mediaError.retryable());
        assertEquals(503, mediaError.status());
    }

    @Test
    void syncAcceptsAChangeAndIsCursorBased() {
        Map<String, Object> change = Map.of("changeId", "change-1", "entityType", "READING_PROGRESS",
                "entityId", "3501", "entityVersion", 1, "operation", "UPSERT", "payloadHash", "b".repeat(64),
                "occurredAt", "2026-08-21T00:00:00Z", "clientEventId", "event-1");
        Map<?, ?> push = data(service.pushSync(USER_ID,
                Map.of("clientBatchId", "batch-1", "baseCursor", "0", "changes", List.of(change)), "sync-push-1"));

        assertEquals(List.of("change-1"), push.get("acceptedChangeIds"));
        assertEquals("1", push.get("nextCursor"));
        Map<String, Object> pulled = service.pullSync(USER_ID, "0", 20);
        assertEquals("1", pulled.get("data") instanceof Map<?, ?> data ? data.get("cursor") : null);
        assertEquals(1, pulled.get("data") instanceof Map<?, ?> data && data.get("changes") instanceof List<?> changes
                ? changes.size() : 0);
        assertEquals(1, durable.cursors.size());
        assertEquals("b3-sync-v2", durable.cursors.get(0).schemaVersion());
    }

    @SuppressWarnings("unchecked")
    private static Map<?, ?> data(Map<String, Object> envelope) {
        return (Map<?, ?>) envelope.get("data");
    }

    private static final class SpyDurableRepository implements B3DurableRepository {
        private final List<Attempt> attempts = new ArrayList<>();
        private final List<PracticeSession> sessions = new ArrayList<>();
        private final List<ReadingProgress> readingProgress = new ArrayList<>();
        private final List<Recording> recordings = new ArrayList<>();
        private final List<OfflineChange> changes = new ArrayList<>();
        private final List<OfflineCursor> cursors = new ArrayList<>();

        @Override public void savePracticeSession(PracticeSession session) { sessions.add(session); }
        @Override public void saveShadowingSession(ShadowingSession session) {}
        @Override public void saveRoleplaySession(RoleplaySession session) {}
        @Override public void saveAttempt(Attempt attempt) { attempts.add(attempt); }
        @Override public void saveReadingProgress(ReadingProgress progress) { readingProgress.add(progress); }
        @Override public void saveRecording(Recording recording) { recordings.add(recording); }
        @Override public void saveSelfRating(long userId, String recordingUuid, String ratingCode, List<String> tags, String clientEventId) {}
        @Override public void saveOfflineChange(OfflineChange change) { changes.add(change); }
        @Override public void saveOfflineCursor(OfflineCursor cursor) { cursors.add(cursor); }
        @Override public void saveOfflineConflict(long userId, String changeId, String entityType, String entityId, long localVersion, long serverVersion, String resolutionCode) {}
    }
}
