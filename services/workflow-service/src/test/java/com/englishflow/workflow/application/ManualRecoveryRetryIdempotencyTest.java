package com.englishflow.workflow.application;

import com.englishflow.workflow.domain.ManualRecoveryRequest;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * P1-2: the retry contract after an uncertain owner outcome.
 *
 * <p>The owner call is idempotent on the recovery id, so every attempt must
 * forward the same recovery id and the same executor token; a retry that finds
 * the mutation applied must flip the request to EXECUTED exactly once.
 */
class ManualRecoveryRetryIdempotencyTest {

    private record Attempt(String recoveryId, String bearer) {
    }

    private static final class Store implements ManualRecoveryService.RecoveryStore {
        final Map<String, ManualRecoveryService.StoredRecovery> byId = new HashMap<>();
        final AtomicInteger updates = new AtomicInteger();
        final AtomicInteger receipts = new AtomicInteger();

        @Override
        public void save(ManualRecoveryRequest request, String subjectType, String subjectId, String action,
                         String reason) {
            byId.put(request.recoveryId(), new ManualRecoveryService.StoredRecovery(request, subjectType,
                    subjectId, action, reason));
        }

        @Override
        public void update(ManualRecoveryRequest request) {
            ManualRecoveryService.StoredRecovery prior = byId.get(request.recoveryId());
            byId.put(request.recoveryId(), new ManualRecoveryService.StoredRecovery(request,
                    prior.subjectType(), prior.subjectId(), prior.action(), prior.reason()));
            updates.incrementAndGet();
        }

        @Override
        public void recordReceipt(ManualRecoveryRequest request, String executor) {
            receipts.incrementAndGet();
        }

        @Override
        public Optional<ManualRecoveryService.StoredRecovery> find(String recoveryId) {
            return Optional.ofNullable(byId.get(recoveryId));
        }
    }

    @Test
    void retriesReuseTheRecoveryIdAndTokenThenMarkExecutedOnce() {
        Store store = new Store();
        List<Attempt> attempts = new ArrayList<>();
        AtomicInteger calls = new AtomicInteger();
        ManualRecoveryService service = new ManualRecoveryService(store,
                (recoveryId, type, id, action, executor, bearer) -> {
                    attempts.add(new Attempt(recoveryId, bearer));
                    if (calls.incrementAndGet() < 3) {
                        throw new RecoverySideEffectPort.SideEffectUncertain("timeout");
                    }
                    return "admin-ops support_ticket -> IN_PROGRESS (replayed)";
                });
        var requested = service.request("ops-1", "TICKET", "t-7", "REOPEN", "stuck");
        service.approve(requested.recoveryId(), "ops-2");

        assertThrows(RecoverySideEffectPort.SideEffectUncertain.class,
                () -> service.execute(requested.recoveryId(), "ops-3", "jwt-same"));
        assertThrows(RecoverySideEffectPort.SideEffectUncertain.class,
                () -> service.execute(requested.recoveryId(), "ops-3", "jwt-same"));
        assertEquals(ManualRecoveryRequest.Status.APPROVED,
                store.byId.get(requested.recoveryId()).request().status());

        var retried = service.execute(requested.recoveryId(), "ops-3", "jwt-same");
        assertEquals("EXECUTED", retried.status());
        assertTrue(retried.effectDetail().contains("replayed"));
        assertEquals(3, attempts.size());
        assertTrue(attempts.stream().allMatch(a -> a.recoveryId().equals(requested.recoveryId())),
                "every attempt must stay idempotent on the same recovery id");
        assertTrue(attempts.stream().allMatch(a -> "jwt-same".equals(a.bearer())),
                "every attempt must forward the same executor token");
        assertEquals(1, store.receipts.get(), "EXECUTED claims its receipt exactly once");
    }

    @Test
    void aFailedRequestCannotBeRetriedIntoExecuted() {
        Store store = new Store();
        ManualRecoveryService service = new ManualRecoveryService(store,
                (recoveryId, type, id, action, executor, bearer) -> {
                    throw new ManualRecoveryRequest.RecoveryNotAllowed("ticket missing");
                });
        var requested = service.request("ops-1", "TICKET", "missing", "REOPEN", "retry");
        service.approve(requested.recoveryId(), "ops-2");
        assertThrows(ManualRecoveryRequest.RecoveryNotAllowed.class,
                () -> service.execute(requested.recoveryId(), "ops-3", "jwt"));

        assertThrows(ManualRecoveryRequest.RecoveryNotAllowed.class,
                () -> service.execute(requested.recoveryId(), "ops-3", "jwt"));
        assertEquals(ManualRecoveryRequest.Status.FAILED,
                store.byId.get(requested.recoveryId()).request().status());
        assertEquals(0, store.receipts.get());
    }
}
