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
                (recoveryId, type, id, action, executor) -> {
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
                (recoveryId, type, id, action, executor) -> {
                    throw new ManualRecoveryRequest.RecoveryNotAllowed("ticket missing");
                });
        var requested = service.request("ops-1", "TICKET", "missing", "REOPEN", "retry");
        service.approve(requested.recoveryId(), "ops-2");
        assertThrows(ManualRecoveryRequest.RecoveryNotAllowed.class,
                () -> service.execute(requested.recoveryId(), "ops-3"));
        assertEquals(ManualRecoveryRequest.Status.FAILED, store.byId.get(requested.recoveryId()).request().status());
        assertEquals("ticket missing", store.byId.get(requested.recoveryId()).request().failureMessage());
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
