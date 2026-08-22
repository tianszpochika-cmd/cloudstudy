package com.englishflow.modules.learning.b10;

import java.time.Instant;
import java.util.List;

/** Pure-Java smoke entry point for the migration adapter; it does not need Spring or a database. */
public final class B10CompatibilityAdapterSmoke {
    private static final String SUBJECT = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    private static final String HASH = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
    private static final Instant NOW = Instant.parse("2026-08-22T09:00:00Z");

    private B10CompatibilityAdapterSmoke() { }

    public static void main(String[] args) {
        B10CompatibilityAdapter adapter = new B10CompatibilityAdapter();
        B10CompatibilityAdapter.Reconciliation comparison = adapter.reconcile(
                new B10CompatibilityAdapter.ReconciliationRequest(
                        "ASSESSMENT", SUBJECT, "b2-v1", "core-api-b2-v1", "b10-assessment-v1",
                        HASH, HASH, true, true, List.of(), "b10-reconcile-smoke-0001", "trace-b10-smoke"), NOW).value();
        require(comparison.status() == B10CompatibilityAdapter.ComparisonStatus.MATCH, "matching shadow comparison");
        require(comparison.safeToCutover(), "safe cutover gate");

        B10CompatibilityAdapter.RouteDecision target = adapter.decideRoute(
                new B10CompatibilityAdapter.RouteDecisionRequest(
                        "ASSESSMENT", SUBJECT, B10CompatibilityAdapter.ReadMode.TARGET_READ, 0,
                        comparison.comparisonId(), "CONTROLLED_CUTOVER", NOW.plusSeconds(3600),
                        "b10-route-smoke-0001", "trace-b10-smoke"), NOW).value();
        require(target.mode() == B10CompatibilityAdapter.ReadMode.TARGET_READ, "target route");

        adapter.reconcile(new B10CompatibilityAdapter.ReconciliationRequest(
                "ASSESSMENT", SUBJECT, "b2-v1", "core-api-b2-v1", "b10-assessment-v1",
                HASH, "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
                true, true, List.of("VERSION_DRIFT"), "b10-reconcile-smoke-0002", "trace-b10-smoke"), NOW.plusSeconds(1));
        B10CompatibilityAdapter.OperationResult<B10CompatibilityAdapter.Reconciliation> reconciliationReplay = adapter.reconcile(
                new B10CompatibilityAdapter.ReconciliationRequest(
                        "ASSESSMENT", SUBJECT, "b2-v1", "core-api-b2-v1", "b10-assessment-v1",
                        HASH, HASH, true, true, List.of(), "b10-reconcile-smoke-0001", "trace-b10-smoke"), NOW.plusSeconds(2));
        require(reconciliationReplay.replayed() && reconciliationReplay.value().comparisonId().equals(comparison.comparisonId()),
                "reconciliation replay returns original result");

        B10CompatibilityAdapter.OperationResult<B10CompatibilityAdapter.RouteDecision> rollback = adapter.rollback(
                new B10CompatibilityAdapter.RollbackRequest(
                        "ASSESSMENT", SUBJECT, B10CompatibilityAdapter.ReadMode.LEGACY_READ,
                        target.configVersion(), "MISMATCH_DETECTED", comparison.comparisonId(),
                        "b10-rollback-smoke-0001", "trace-b10-smoke"), NOW.plusSeconds(10));
        require(rollback.value().mode() == B10CompatibilityAdapter.ReadMode.LEGACY_READ, "legacy rollback route");
        require(!adapter.lastRollback("ASSESSMENT", SUBJECT, "b10-rollback-smoke-0001").domainFactsMutated(),
                "rollback never mutates domain facts");
        adapter.decideRoute(new B10CompatibilityAdapter.RouteDecisionRequest(
                "ASSESSMENT", SUBJECT, B10CompatibilityAdapter.ReadMode.FALLBACK_READ, rollback.value().configVersion(),
                comparison.comparisonId(), "DEPENDENCY_DEGRADED", NOW.plusSeconds(3600),
                "b10-route-fallback-smoke-0001", "trace-b10-smoke"), NOW.plusSeconds(11));
        B10CompatibilityAdapter.OperationResult<B10CompatibilityAdapter.RouteDecision> rollbackReplay = adapter.rollback(
                new B10CompatibilityAdapter.RollbackRequest(
                        "ASSESSMENT", SUBJECT, B10CompatibilityAdapter.ReadMode.LEGACY_READ,
                        target.configVersion(), "MISMATCH_DETECTED", comparison.comparisonId(),
                        "b10-rollback-smoke-0001", "trace-b10-smoke"), NOW.plusSeconds(12));
        require(rollbackReplay.replayed() && rollbackReplay.value().mode() == B10CompatibilityAdapter.ReadMode.LEGACY_READ,
                "rollback replay returns original result");
        System.out.println("core-api B10 compatibility adapter smoke: PASS");
    }

    private static void require(boolean condition, String description) {
        if (!condition) throw new AssertionError(description);
    }
}
