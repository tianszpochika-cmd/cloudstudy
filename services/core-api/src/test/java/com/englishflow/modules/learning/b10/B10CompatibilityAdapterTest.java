package com.englishflow.modules.learning.b10;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Instant;
import java.util.List;

import org.junit.jupiter.api.Test;

class B10CompatibilityAdapterTest {
    private static final String SUBJECT = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    private static final String HASH = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
    private static final Instant NOW = Instant.parse("2026-08-22T09:00:00Z");

    @Test
    void shadowReconciliationIsIdempotentAndTargetCutoverRequiresMatch() {
        B10CompatibilityAdapter adapter = new B10CompatibilityAdapter();
        B10CompatibilityAdapter.ReconciliationRequest request = request("b10-reconcile-0001", HASH, HASH, List.of());

        B10CompatibilityAdapter.OperationResult<B10CompatibilityAdapter.Reconciliation> first = adapter.reconcile(request, NOW);
        B10CompatibilityAdapter.OperationResult<B10CompatibilityAdapter.Reconciliation> replay = adapter.reconcile(request, NOW.plusSeconds(1));

        assertFalse(first.replayed());
        assertTrue(replay.replayed());
        assertEquals(first.value(), replay.value());
        assertEquals(B10CompatibilityAdapter.ComparisonStatus.MATCH, first.value().status());
        assertTrue(first.value().safeToCutover());

        B10CompatibilityAdapter.RouteDecisionRequest route = new B10CompatibilityAdapter.RouteDecisionRequest(
                "ASSESSMENT", SUBJECT, B10CompatibilityAdapter.ReadMode.TARGET_READ, 0,
                first.value().comparisonId(), "CONTROLLED_CUTOVER", NOW.plusSeconds(3600),
                "b10-route-target-0001", "trace-b10-0001");
        B10CompatibilityAdapter.RouteDecision decision = adapter.decideRoute(route, NOW).value();
        assertEquals(B10CompatibilityAdapter.ReadMode.TARGET_READ, decision.mode());
        assertEquals(1, decision.configVersion());
    }

    @Test
    void mismatchCannotCutOverAndChangedIdempotencyKeyIsRejected() {
        B10CompatibilityAdapter adapter = new B10CompatibilityAdapter();
        B10CompatibilityAdapter.ReconciliationRequest request = request(
                "b10-reconcile-0002", HASH, "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc", List.of("SCORE_BUCKET_CHANGED"));
        B10CompatibilityAdapter.Reconciliation comparison = adapter.reconcile(request, NOW).value();
        assertEquals(B10CompatibilityAdapter.ComparisonStatus.MISMATCH, comparison.status());
        assertFalse(comparison.safeToCutover());

        B10CompatibilityAdapter.RouteDecisionRequest route = new B10CompatibilityAdapter.RouteDecisionRequest(
                "ASSESSMENT", SUBJECT, B10CompatibilityAdapter.ReadMode.TARGET_READ, 0,
                comparison.comparisonId(), "CONTROLLED_CUTOVER", NOW.plusSeconds(3600),
                "b10-route-target-0002", "trace-b10-0002");
        assertEquals("B10_TARGET_CUTOVER_NOT_SAFE", assertThrows(B10CompatibilityAdapter.CompatibilityException.class,
                () -> adapter.decideRoute(route, NOW)).getMessage());

        B10CompatibilityAdapter.ReconciliationRequest changed = request(
                "b10-reconcile-0002", HASH, HASH, List.of());
        assertEquals("B10_IDEMPOTENCY_KEY_REUSED", assertThrows(B10CompatibilityAdapter.CompatibilityException.class,
                () -> adapter.reconcile(changed, NOW)).getMessage());
    }

    @Test
    void rollbackOnlyChangesAdapterRouteAndIsReplaySafe() {
        B10CompatibilityAdapter adapter = new B10CompatibilityAdapter();
        B10CompatibilityAdapter.Reconciliation comparison = adapter.reconcile(request("b10-reconcile-0003", HASH, HASH, List.of()), NOW).value();
        B10CompatibilityAdapter.RouteDecision target = adapter.decideRoute(new B10CompatibilityAdapter.RouteDecisionRequest(
                "ASSESSMENT", SUBJECT, B10CompatibilityAdapter.ReadMode.TARGET_READ, 0,
                comparison.comparisonId(), "CONTROLLED_CUTOVER", NOW.plusSeconds(3600),
                "b10-route-target-0003", "trace-b10-0003"), NOW).value();

        B10CompatibilityAdapter.RollbackRequest rollback = new B10CompatibilityAdapter.RollbackRequest(
                "ASSESSMENT", SUBJECT, B10CompatibilityAdapter.ReadMode.LEGACY_READ, target.configVersion(),
                "MISMATCH_DETECTED", comparison.comparisonId(), "b10-rollback-0003", "trace-b10-0003");
        B10CompatibilityAdapter.OperationResult<B10CompatibilityAdapter.RouteDecision> result = adapter.rollback(rollback, NOW.plusSeconds(10));
        B10CompatibilityAdapter.OperationResult<B10CompatibilityAdapter.RouteDecision> replay = adapter.rollback(rollback, NOW.plusSeconds(20));

        assertEquals(B10CompatibilityAdapter.ReadMode.LEGACY_READ, result.value().mode());
        assertTrue(replay.replayed());
        assertEquals(result.value(), replay.value());
        assertFalse(adapter.lastRollback("ASSESSMENT", SUBJECT, rollback.idempotencyKey()).domainFactsMutated());
        assertEquals(B10CompatibilityAdapter.ReadMode.LEGACY_READ,
                adapter.resolveRead("ASSESSMENT", SUBJECT, NOW.plusSeconds(20)).mode());
    }

    private static B10CompatibilityAdapter.ReconciliationRequest request(
            String key, String legacyHash, String targetHash, List<String> differences) {
        return new B10CompatibilityAdapter.ReconciliationRequest(
                "ASSESSMENT", SUBJECT, "b2-v1", "core-api-b2-v1", "b10-assessment-v1",
                legacyHash, targetHash, true, true, differences, key, "trace-b10");
    }
}
