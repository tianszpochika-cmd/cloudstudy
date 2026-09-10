package com.englishflow.notification.unit;

import com.englishflow.notification.adapter.memory.InMemoryNotificationIdGenerator;
import com.englishflow.notification.adapter.memory.InMemoryOfflineSyncStore;
import com.englishflow.notification.adapter.memory.InMemoryOutboxEventPort;
import com.englishflow.notification.adapter.memory.InMemoryWorkflowPort;
import com.englishflow.notification.application.OfflineSyncApplicationService;
import com.englishflow.notification.application.RequestMetadata;
import com.englishflow.notification.domain.NotificationAccessPolicy;
import com.englishflow.notification.domain.NotificationDomainException;
import com.englishflow.notification.domain.NotificationPrincipalContext;
import com.englishflow.notification.domain.OfflineChange;
import com.englishflow.notification.domain.OfflineVector;
import com.englishflow.notification.domain.SyncFailureState;
import com.englishflow.notification.domain.SyncStatus;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

/** Offline cursor/dedupe/conflict use cases, tenant isolation and failure states. */
class OfflineSyncApplicationServiceTest {

    private static final Instant NOW = Instant.parse("2026-08-22T00:00:00Z");
    private final Clock clock = Clock.fixed(NOW, ZoneOffset.UTC);
    private final RequestMetadata meta = new RequestMetadata("req-1", "trace-1");
    private final NotificationPrincipalContext ctx = NotificationPrincipalContext.authenticated("t", "p", "d");

    private record Fixture(OfflineSyncApplicationService svc, InMemoryOfflineSyncStore store) {
    }

    private Fixture fixture() {
        var store = new InMemoryOfflineSyncStore();
        var svc = new OfflineSyncApplicationService(store, new InMemoryWorkflowPort(),
                new InMemoryOutboxEventPort(), new InMemoryNotificationIdGenerator(),
                new NotificationAccessPolicy(), clock);
        return new Fixture(svc, store);
    }

    private OfflineChange change(String tenant, String principal, String device, String eventId,
            long seq, long baseVersion, OfflineVector vector) {
        return new OfflineChange(tenant, principal, device, eventId, seq, "ET", "eid", "UPSERT",
                baseVersion, vector, "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef", NOW);
    }

    @Test
    void firstChangeIsApplied() {
        var f = fixture();
        var result = f.svc().sync(ctx, change("t", "p", "d", "e1", 1, 0, new OfflineVector(Map.of("d", 1L))), meta);
        assertEquals(SyncStatus.APPLIED, result.status());
        assertEquals(1, result.serverVersion());
    }

    @Test
    void clientEventIdDedupeReplays() {
        var f = fixture();
        var change = change("t", "p", "d", "e1", 1, 0, new OfflineVector(Map.of("d", 1L)));
        f.svc().sync(ctx, change, meta);
        var replay = f.svc().sync(ctx, change, meta);
        assertEquals(SyncStatus.REPLAYED, replay.status());
    }

    @Test
    void clientSequenceReuseConflicts() {
        var f = fixture();
        f.svc().sync(ctx, change("t", "p", "d", "e1", 1, 0, new OfflineVector(Map.of("d", 1L))), meta);
        var ex = assertThrows(NotificationDomainException.class,
                () -> f.svc().sync(ctx, change("t", "p", "d", "e2", 1, 0, new OfflineVector(Map.of("d", 1L))), meta));
        assertEquals(NotificationDomainException.Code.SEQUENCE_CONFLICT, ex.code());
    }

    @Test
    void clientSequenceGapConflicts() {
        var f = fixture();
        var gap = f.svc().sync(ctx, change("t", "p", "d", "e1", 3, 0, new OfflineVector(Map.of("d", 3L))), meta);
        assertEquals(SyncStatus.CONFLICT, gap.status());
        assertEquals("CLIENT_SEQUENCE_GAP", gap.conflict().reason());
    }

    @Test
    void concurrentVectorConflicts() {
        var f = fixture();
        f.svc().sync(ctx, change("t", "p", "d", "e1", 1, 0, new OfflineVector(Map.of("d", 1L))), meta);
        var concurrent = f.svc().sync(ctx, change("t", "p", "d", "e2", 2, 1, new OfflineVector(Map.of("d", 0L, "other", 1L))), meta);
        assertEquals(SyncStatus.CONFLICT, concurrent.status());
        assertEquals("VECTOR_CONCURRENT", concurrent.conflict().reason());
    }

    @Test
    void staleBaseVersionConflicts() {
        var f = fixture();
        f.svc().sync(ctx, change("t", "p", "d", "e1", 1, 0, new OfflineVector(Map.of("d", 1L))), meta);
        var stale = f.svc().sync(ctx, change("t", "p", "d", "e2", 2, 0, new OfflineVector(Map.of("d", 2L))), meta);
        assertEquals(SyncStatus.CONFLICT, stale.status());
        assertEquals("BASE_VERSION_STALE", stale.conflict().reason());
    }

    @Test
    void storageFailureIsRecoverableState() {
        var f = fixture();
        f.store().failWith(SyncFailureState.STORAGE_FULL);
        var failed = f.svc().sync(ctx, change("t", "p", "d", "e1", 1, 0, new OfflineVector(Map.of("d", 1L))), meta);
        assertEquals(SyncStatus.FAILED, failed.status());
        assertEquals(SyncFailureState.STORAGE_FULL, failed.failureState());
    }

    @Test
    void tenantIsolationDeniesOtherPrincipal() {
        var f = fixture();
        var other = change("t", "p2", "d", "e1", 1, 0, new OfflineVector(Map.of("d", 1L)));
        var ex = assertThrows(NotificationDomainException.class, () -> f.svc().sync(ctx, other, meta));
        assertEquals(NotificationDomainException.Code.FORBIDDEN, ex.code());
    }
}
