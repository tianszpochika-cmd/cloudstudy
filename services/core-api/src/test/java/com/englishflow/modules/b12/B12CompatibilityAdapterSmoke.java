package com.englishflow.modules.b12;

import java.util.Map;

/** Dependency-free Java 17 smoke for B12-MIG-006. */
public final class B12CompatibilityAdapterSmoke {

    public static void main(String[] args) {
        String hash = B12CompatibilityAdapter.sha256("same-server-snapshot");
        B12CompatibilityAdapter adapter = new B12CompatibilityAdapter();
        B12CompatibilityAdapter.ShadowComparison comparison = adapter.shadowRead(
                B12CompatibilityAdapter.Domain.GAMIFICATION, "legacy-user-1", hash, hash, "b12-fixture-1");
        require(comparison.state() == B12CompatibilityAdapter.ReconciliationState.MATCH, "shadow match");
        require(comparison.readOnly() && comparison.domainFactsUntouched(), "shadow safety");
        B12CompatibilityAdapter.ReplayReceipt first = adapter.replayTrustedEvent(
                B12CompatibilityAdapter.Domain.GAMIFICATION, "evt-1", "dedupe-1", hash);
        B12CompatibilityAdapter.ReplayReceipt duplicate = adapter.replayTrustedEvent(
                B12CompatibilityAdapter.Domain.GAMIFICATION, "evt-1", "dedupe-1", hash);
        require(first.state() == B12CompatibilityAdapter.ReplayState.RECEIVED, "replay first");
        require(duplicate.state() == B12CompatibilityAdapter.ReplayState.DUPLICATE, "replay dedupe");
        adapter.switchRoute(B12CompatibilityAdapter.Domain.GAMIFICATION,
                B12CompatibilityAdapter.RouteMode.TARGET, "gamification-v2", "B12_TARGET_READY", "route-1");
        require(adapter.route(B12CompatibilityAdapter.Domain.GAMIFICATION).mode()
                == B12CompatibilityAdapter.RouteMode.TARGET, "target switch");
        adapter.rollback(B12CompatibilityAdapter.Domain.GAMIFICATION, "B12_ROLLBACK_SMOKE", "route-2");
        require(adapter.route(B12CompatibilityAdapter.Domain.GAMIFICATION).mode()
                == B12CompatibilityAdapter.RouteMode.FALLBACK, "rollback");
        boolean rejected = false;
        try {
            B12CompatibilityAdapter.rejectClientFacts(Map.of("xp", 10));
        } catch (IllegalArgumentException expected) {
            rejected = true;
        }
        require(rejected, "client fact rejected");
        System.out.println("core-api B12-MIG-006 compatibility smoke: PASS");
    }

    private static void require(boolean condition, String label) {
        if (!condition) throw new AssertionError(label);
    }
}
