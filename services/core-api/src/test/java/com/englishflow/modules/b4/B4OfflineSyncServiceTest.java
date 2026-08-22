package com.englishflow.modules.b4;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import com.englishflow.modules.social.b4.B4SocialService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class B4OfflineSyncServiceTest {
    private static final long USER_ID = 201L;

    private MutableClock clock;
    private B4SocialService service;

    @BeforeEach
    void setUp() {
        clock = new MutableClock(Instant.parse("2026-08-22T00:00:00Z"));
        service = new B4SocialService(clock, new InMemoryB4DurableRepository());
    }

    @Test
    void offlinePartsRequireManifestEtagSupportPauseResumeAndCleanup() {
        Map<String, Object> packageView = firstPackageView(service.offlinePackages(USER_ID, 20));
        String packageId = String.valueOf(packageView.get("packageId"));

        Map<String, Object> authorized = data(service.authorizeOfflinePackage(USER_ID, packageId,
                "device-201", "offline-authorize-201"));
        String downloadId = String.valueOf(authorized.get("downloadId"));
        Map<?, ?> manifest = (Map<?, ?>) authorized.get("manifest");
        String expectedEtag = "ETAG-" + packageId + "-" + manifest.get("versionCode") + "-0";

        B4Exception wrongEtag = assertThrows(B4Exception.class, () -> service.updateOfflineDownload(USER_ID,
                downloadId, Map.of("action", "PART_RECEIVED", "partIndex", 0, "etag", "ETAG-invalid"),
                "offline-part-wrong-201"));
        assertEquals("INF_OFFLINE_PART_ETAG_MISMATCH", wrongEtag.code());
        assertTrue(wrongEtag.retryable());

        Map<String, Object> paused = data(service.updateOfflineDownload(USER_ID, downloadId,
                Map.of("action", "PAUSE"), "offline-pause-201"));
        assertEquals("PAUSED", download(paused).get("state"));

        Map<String, Object> resumed = data(service.updateOfflineDownload(USER_ID, downloadId,
                Map.of("action", "RESUME"), "offline-resume-201"));
        assertEquals("AUTHORIZED", download(resumed).get("state"));

        Map<String, Object> partReceived = data(service.updateOfflineDownload(USER_ID, downloadId,
                Map.of("action", "PART_RECEIVED", "partIndex", 0, "etag", expectedEtag),
                "offline-part-valid-201"));
        assertEquals("DOWNLOADING", download(partReceived).get("state"));
        assertEquals(1, download(partReceived).get("completedPartCount"));
        assertEquals(1024L, download(partReceived).get("downloadedBytes"));

        Map<String, Object> pausedWithProgress = data(service.updateOfflineDownload(USER_ID, downloadId,
                Map.of("action", "PAUSE"), "offline-pause-progress-201"));
        assertEquals("PAUSED", download(pausedWithProgress).get("state"));
        Map<String, Object> resumedWithProgress = data(service.updateOfflineDownload(USER_ID, downloadId,
                Map.of("action", "RESUME"), "offline-resume-progress-201"));
        assertEquals("DOWNLOADING", download(resumedWithProgress).get("state"));

        Map<String, Object> cleaned = data(service.cleanupOfflineDownload(USER_ID, downloadId,
                "offline-cleanup-201"));
        assertEquals(Boolean.TRUE, cleaned.get("cleaned"));
        assertEquals("CLEANED", cleaned.get("state"));
        assertEquals(downloadId, cleaned.get("downloadId"));
    }

    @Test
    void syncDeduplicatesClientEventIdAndRecordsVersionConflicts() {
        Map<String, Object> firstEvent = syncEvent("sync-event-201", "PROGRESS_UPDATED", "entity-201", 1);
        Map<String, Object> first = data(service.pushSync(USER_ID,
                Map.of("clientBatchId", "sync-batch-201", "events", List.of(firstEvent)),
                "device-201", "sync-push-201"));
        Map<String, Object> firstResult = firstResult(first);
        assertEquals("ACCEPTED", firstResult.get("status"));
        assertEquals("APPLIED", firstResult.get("resultCode"));
        assertEquals(1, first.get("accepted"));

        Map<String, Object> duplicate = data(service.pushSync(USER_ID,
                Map.of("clientBatchId", "sync-batch-202", "events", List.of(new LinkedHashMap<>(firstEvent))),
                "device-201", "sync-push-202"));
        Map<String, Object> duplicateResult = firstResult(duplicate);
        assertEquals("DUPLICATE", duplicateResult.get("status"));
        assertEquals(0, duplicate.get("accepted"));
        assertEquals(firstResult.get("serverEventId"), duplicateResult.get("serverEventId"));

        Map<String, Object> reusedWithDifferentEvent = syncEvent(
                "sync-event-201", "FOCUS_COMPLETED", "entity-201", 1);
        Map<String, Object> reusedConflict = data(service.pushSync(USER_ID,
                Map.of("clientBatchId", "sync-batch-203", "events", List.of(reusedWithDifferentEvent)),
                "device-201", "sync-push-203"));
        Map<String, Object> reusedResult = firstResult(reusedConflict);
        assertEquals("REJECTED", reusedResult.get("status"));
        assertEquals("SYNC_CONFLICT", reusedResult.get("resultCode"));

        Map<String, Object> staleEvent = syncEvent("sync-event-204", "PROGRESS_UPDATED", "entity-201", 0);
        Map<String, Object> stale = data(service.pushSync(USER_ID,
                Map.of("clientBatchId", "sync-batch-204", "events", List.of(staleEvent)),
                "device-201", "sync-push-204"));
        Map<String, Object> staleResult = firstResult(stale);
        assertEquals("CONFLICT", staleResult.get("status"));
        assertEquals("SYNC_CONFLICT", staleResult.get("resultCode"));
        assertEquals(1, stale.get("conflicts"));

        Map<String, Object> changes = data(service.syncChanges(USER_ID, "0", 20));
        assertEquals(1, ((List<?>) changes.get("changes")).size());
        assertTrue(String.valueOf(changes.get("nextCursor")).startsWith("CUR-" + USER_ID + "-1-"));
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> data(Map<String, Object> envelope) {
        return (Map<String, Object>) envelope.get("data");
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> firstPackageView(Map<String, Object> envelope) {
        return (Map<String, Object>) ((List<?>) data(envelope).get("items")).get(0);
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> download(Map<String, Object> envelopeData) {
        return (Map<String, Object>) envelopeData.get("download");
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> firstResult(Map<String, Object> data) {
        return (Map<String, Object>) ((List<?>) data.get("results")).get(0);
    }

    private Map<String, Object> syncEvent(String clientEventId, String eventType,
                                           String entityId, long entityVersion) {
        Map<String, Object> event = new LinkedHashMap<>();
        event.put("clientEventId", clientEventId);
        event.put("eventType", eventType);
        event.put("occurredAt", clock.instant().toString());
        event.put("entityId", entityId);
        event.put("entityVersion", entityVersion);
        return event;
    }

    private static final class MutableClock extends Clock {
        private Instant current;
        private final ZoneId zone;

        private MutableClock(Instant current) {
            this(current, ZoneOffset.UTC);
        }

        private MutableClock(Instant current, ZoneId zone) {
            this.current = current;
            this.zone = zone;
        }

        @Override
        public ZoneId getZone() {
            return zone;
        }

        @Override
        public Clock withZone(ZoneId zone) {
            return new MutableClock(current, zone);
        }

        @Override
        public Instant instant() {
            return current;
        }
    }
}
