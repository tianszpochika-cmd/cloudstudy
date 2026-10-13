package com.englishflow.workflow.application;

import com.englishflow.workflow.domain.ManualRecoveryRequest;
import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ManualRecoveryExecuteEffectTest {

    @Test
    void executeRunsSideEffectThenMarksExecuted() {
        FakeStore store = new FakeStore();
        AtomicReference<String> applied = new AtomicReference<>();
        ManualRecoveryService service = new ManualRecoveryService(store,
                (recoveryId, type, id, action, executor, bearer) -> {
                    applied.set(type + "/" + action + ":" + id);
                    return "ok";
                });
        var requested = service.request("ops-1", "TICKET", "ticket-9", "REOPEN", "stuck closed");
        service.approve(requested.recoveryId(), "ops-2");
        var executed = service.execute(requested.recoveryId(), "ops-3");
        assertEquals("EXECUTED", executed.status());
        assertEquals("TICKET/REOPEN:ticket-9", applied.get());
        assertEquals("ok", executed.effectDetail());
        assertTrue(store.receipts.containsKey(requested.recoveryId()));
    }

    @Test
    void failedSideEffectMarksFailedAndDoesNotClaimExecuted() {
        FakeStore store = new FakeStore();
        ManualRecoveryService service = new ManualRecoveryService(store,
                (recoveryId, type, id, action, executor, bearer) -> {
                    throw new ManualRecoveryRequest.RecoveryNotAllowed("ticket missing");
                });
        var requested = service.request("ops-1", "TICKET", "missing", "REOPEN", "retry");
        service.approve(requested.recoveryId(), "ops-2");
        assertThrows(ManualRecoveryRequest.RecoveryNotAllowed.class,
                () -> service.execute(requested.recoveryId(), "ops-3"));
        assertEquals(ManualRecoveryRequest.Status.FAILED, store.byId.get(requested.recoveryId()).request().status());
        assertEquals("ticket missing", store.byId.get(requested.recoveryId()).request().failureMessage());
    }

    @Test
    void uncertainOutcomeKeepsApprovedAndRetryMarksExecuted() {
        FakeStore store = new FakeStore();
        java.util.concurrent.atomic.AtomicInteger calls = new java.util.concurrent.atomic.AtomicInteger();
        ManualRecoveryService service = new ManualRecoveryService(store,
                (recoveryId, type, id, action, executor, bearer) -> {
                    if (calls.incrementAndGet() == 1) {
                        // owner applied it, but the response was lost
                        throw new RecoverySideEffectPort.SideEffectUncertain("timeout");
                    }
                    return "admin-ops support_ticket -> IN_PROGRESS (replayed)";
                });
        var requested = service.request("ops-1", "TICKET", "t-1", "REOPEN", "stuck");
        service.approve(requested.recoveryId(), "ops-2");
        assertThrows(RecoverySideEffectPort.SideEffectUncertain.class,
                () -> service.execute(requested.recoveryId(), "ops-3", "tok"));
        assertEquals(ManualRecoveryRequest.Status.APPROVED, store.byId.get(requested.recoveryId()).request().status());
        assertTrue(store.receipts.isEmpty());

        var retried = service.execute(requested.recoveryId(), "ops-3", "tok");
        assertEquals("EXECUTED", retried.status());
        assertTrue(retried.effectDetail().contains("replayed"));
        assertEquals(2, calls.get());
    }

    @Test
    void executingAnExecutedRequestAgainIsANoOp() {
        FakeStore store = new FakeStore();
        java.util.concurrent.atomic.AtomicInteger calls = new java.util.concurrent.atomic.AtomicInteger();
        ManualRecoveryService service = new ManualRecoveryService(store,
                (recoveryId, type, id, action, executor, bearer) -> { calls.incrementAndGet(); return "ok"; });
        var requested = service.request("ops-1", "TICKET", "t-2", "REOPEN", "stuck");
        service.approve(requested.recoveryId(), "ops-2");
        service.execute(requested.recoveryId(), "ops-3", "tok");
        assertEquals("EXECUTED", service.execute(requested.recoveryId(), "ops-3", "tok").status());
        assertEquals(1, calls.get());
        assertEquals(1, store.receipts.size());
    }

    @Test
    void bearerTokenIsForwardedToTheOwnerCall() {
        FakeStore store = new FakeStore();
        AtomicReference<String> seen = new AtomicReference<>();
        ManualRecoveryService service = new ManualRecoveryService(store,
                (recoveryId, type, id, action, executor, bearer) -> { seen.set(bearer); return "ok"; });
        var requested = service.request("ops-1", "TICKET", "t-3", "REOPEN", "stuck");
        service.approve(requested.recoveryId(), "ops-2");
        service.execute(requested.recoveryId(), "ops-3", "jwt-abc");
        assertEquals("jwt-abc", seen.get());
    }

    static final class FakeStore implements ManualRecoveryService.RecoveryStore {
        final Map<String, ManualRecoveryService.StoredRecovery> byId = new HashMap<>();
        final Map<String, String> receipts = new HashMap<>();

        @Override
        public void save(ManualRecoveryRequest request, String subjectType, String subjectId, String action, String reason) {
            byId.put(request.recoveryId(), new ManualRecoveryService.StoredRecovery(request, subjectType, subjectId, action, reason));
        }

        @Override
        public void update(ManualRecoveryRequest request) {
            ManualRecoveryService.StoredRecovery prior = byId.get(request.recoveryId());
            byId.put(request.recoveryId(), new ManualRecoveryService.StoredRecovery(
                    request, prior.subjectType(), prior.subjectId(), prior.action(), prior.reason()));
        }

        @Override
        public void recordReceipt(ManualRecoveryRequest request, String executor) {
            receipts.put(request.recoveryId(), executor);
        }

        @Override
        public Optional<ManualRecoveryService.StoredRecovery> find(String recoveryId) {
            return Optional.ofNullable(byId.get(recoveryId));
        }
    }
}
