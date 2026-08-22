package com.englishflow.modules.b14;

import java.time.Instant;
import java.util.Map;

/** Pure Java 17 smoke test for B14-MIG-001; no Spring, database or test library required. */
public final class B14MigrationCompatibilityAdapterSmoke {
    private static final Instant NOW = Instant.parse("2026-08-22T12:00:00Z");

    private B14MigrationCompatibilityAdapterSmoke() {
    }

    public static void main(String[] args) {
        B14MigrationCompatibilityAdapter adapter = new B14MigrationCompatibilityAdapter("tenant-a");
        require(B14MigrationCompatibilityAdapter.Domain.values().length == 8, "eight migration domains");
        normalAndDuplicateMigrations(adapter);
        comparisonStates(adapter);
        failureCompensationAndFallback(adapter);
        tenantIsolationAndInvalidInput(adapter);
        System.out.println("core-api B14-MIG-001 migration compatibility smoke: PASS");
    }

    private static void normalAndDuplicateMigrations(B14MigrationCompatibilityAdapter adapter) {
        for (B14MigrationCompatibilityAdapter.Domain domain : B14MigrationCompatibilityAdapter.Domain.values()) {
            String batchId = "batch-" + domain.name().toLowerCase();
            String seed = "stable-summary-" + domain.name();
            B14MigrationCompatibilityAdapter.MigrationRequest request = request(
                    domain, batchId, available("legacy-v1", 12, seed), available("target-v2", 12, seed),
                    "migrate-" + domain.name().toLowerCase() + "-0001");
            B14MigrationCompatibilityAdapter.OperationResult<B14MigrationCompatibilityAdapter.MigrationRecord> first =
                    adapter.migrate(request, NOW);
            require(!first.replayed(), "first migration " + domain);
            require(first.value().reconciliationStatus() == B14MigrationCompatibilityAdapter.ReconciliationStatus.MATCH,
                    "matching reconciliation " + domain);
            require(first.value().status() == B14MigrationCompatibilityAdapter.MigrationStatus.COMPLETED,
                    "completed migration " + domain);
            require(first.value().legacySnapshot().rowCount() == 12, "legacy row count " + domain);
            require(first.value().targetSnapshot().rowCount() == 12, "target row count " + domain);
            require(first.value().targetDomainFactsUntouched(), "target facts untouched " + domain);

            B14MigrationCompatibilityAdapter.OperationResult<B14MigrationCompatibilityAdapter.MigrationRecord> duplicate =
                    adapter.migrate(request, NOW.plusSeconds(1));
            require(duplicate.replayed() && duplicate.value() == first.value(),
                    "duplicate migration is idempotent " + domain);

            B14MigrationCompatibilityAdapter.OperationResult<B14MigrationCompatibilityAdapter.RouteState> cutover =
                    adapter.switchReadPath(new B14MigrationCompatibilityAdapter.RouteRequest(
                            domain, batchId, B14MigrationCompatibilityAdapter.ReadPath.TARGET, "MATCH_CONFIRMED",
                            "route-" + domain.name().toLowerCase() + "-0001", "trace-route"), NOW.plusSeconds(2));
            require(cutover.value().readPath() == B14MigrationCompatibilityAdapter.ReadPath.TARGET,
                    "target route " + domain);
            require(adapter.resolveRead(domain, true).resolvedPath() == B14MigrationCompatibilityAdapter.ReadPath.TARGET,
                    "target read resolution " + domain);
        }
    }

    private static void comparisonStates(B14MigrationCompatibilityAdapter adapter) {
        B14MigrationCompatibilityAdapter.Domain domain = B14MigrationCompatibilityAdapter.Domain.LEARNING;
        require(adapter.shadowCompare(request(domain, "batch-mismatch",
                available("legacy-v1", 4, "legacy-content"), available("target-v2", 5, "target-content"),
                "shadow-mismatch-0001"), NOW.plusSeconds(3)).value().status()
                == B14MigrationCompatibilityAdapter.ReconciliationStatus.MISMATCH, "mismatch comparison");
        require(adapter.shadowCompare(request(domain, "batch-legacy-only", available("legacy-v1", 1, "legacy-only"),
                B14MigrationCompatibilityAdapter.DomainSnapshot.unavailable(), "shadow-legacy-0001"), NOW.plusSeconds(4))
                .value().status() == B14MigrationCompatibilityAdapter.ReconciliationStatus.LEGACY_ONLY,
                "legacy only comparison");
        require(adapter.shadowCompare(request(domain, "batch-target-only",
                B14MigrationCompatibilityAdapter.DomainSnapshot.unavailable(), available("target-v2", 1, "target-only"),
                "shadow-target-0001"), NOW.plusSeconds(5)).value().status()
                == B14MigrationCompatibilityAdapter.ReconciliationStatus.TARGET_ONLY, "target only comparison");
        require(adapter.shadowCompare(request(domain, "batch-unavailable",
                B14MigrationCompatibilityAdapter.DomainSnapshot.unavailable(),
                B14MigrationCompatibilityAdapter.DomainSnapshot.unavailable(), "shadow-none-0001"), NOW.plusSeconds(6))
                .value().status() == B14MigrationCompatibilityAdapter.ReconciliationStatus.UNAVAILABLE,
                "unavailable comparison");

        boolean targetRejected = false;
        try {
            adapter.switchReadPath(new B14MigrationCompatibilityAdapter.RouteRequest(
                    domain, "batch-mismatch", B14MigrationCompatibilityAdapter.ReadPath.TARGET, "MATCH_CONFIRMED",
                    "route-mismatch-0001", "trace-route-mismatch"), NOW.plusSeconds(7));
        } catch (IllegalStateException expected) {
            targetRejected = true;
        }
        require(targetRejected, "mismatched target route rejected");
    }

    private static void failureCompensationAndFallback(B14MigrationCompatibilityAdapter adapter) {
        B14MigrationCompatibilityAdapter.Domain domain = B14MigrationCompatibilityAdapter.Domain.COMMERCE;
        B14MigrationCompatibilityAdapter.MigrationRequest failedMigration = request(
                domain, "batch-commerce-failed", available("legacy-v1", 3, "commerce-legacy"),
                available("target-v2", 4, "commerce-target"), "migrate-commerce-failed-0001");
        require(adapter.migrate(failedMigration, NOW.plusSeconds(7)).value().status()
                == B14MigrationCompatibilityAdapter.MigrationStatus.SHADOW_ONLY, "failed batch recorded");
        B14MigrationCompatibilityAdapter.MigrationFailureRequest failure =
                new B14MigrationCompatibilityAdapter.MigrationFailureRequest(
                        domain, "batch-commerce-failed", "TARGET_TIMEOUT", "DEPENDENCY_DEGRADED",
                        "fail-commerce-0001", "trace-fail");
        require(adapter.markFailed(failure, NOW.plusSeconds(8)).value().status()
                == B14MigrationCompatibilityAdapter.MigrationStatus.FAILED, "failed state recorded");
        require(adapter.markFailed(failure, NOW.plusSeconds(9)).replayed(), "duplicate failure is idempotent");
        B14MigrationCompatibilityAdapter.CompensationRequest request =
                new B14MigrationCompatibilityAdapter.CompensationRequest(
                        domain, "batch-commerce-failed", "TARGET_TIMEOUT", "DEPENDENCY_DEGRADED",
                        "compensate-commerce-0001", "trace-compensate");
        B14MigrationCompatibilityAdapter.OperationResult<B14MigrationCompatibilityAdapter.CompensationRecord> first =
                adapter.compensate(request, NOW.plusSeconds(10));
        require(!first.replayed() && first.value().domainFactsUntouched(), "first compensation safety");
        require(adapter.migration(domain, "batch-commerce-failed").status()
                == B14MigrationCompatibilityAdapter.MigrationStatus.COMPENSATED, "migration compensated");
        require(adapter.route(domain).readPath() == B14MigrationCompatibilityAdapter.ReadPath.FALLBACK,
                "compensation fallback route");
        require(adapter.resolveRead(domain, true).resolvedPath() == B14MigrationCompatibilityAdapter.ReadPath.FALLBACK,
                "compensation fallback read");
        require(adapter.compensate(request, NOW.plusSeconds(11)).replayed(), "duplicate compensation");

        B14MigrationCompatibilityAdapter.ReadResolution outage = adapter.resolveRead(
                B14MigrationCompatibilityAdapter.Domain.LEARNER, false);
        require(outage.fallbackApplied() && outage.resolvedPath() == B14MigrationCompatibilityAdapter.ReadPath.FALLBACK,
                "target outage fallback read");
    }

    private static void tenantIsolationAndInvalidInput(B14MigrationCompatibilityAdapter adapter) {
        B14MigrationCompatibilityAdapter otherTenant = new B14MigrationCompatibilityAdapter("tenant-b");
        require(!adapter.serverTenantScopeHash().equals(otherTenant.serverTenantScopeHash()), "tenant scopes differ");
        boolean crossTenantRejected = false;
        try {
            otherTenant.migration(B14MigrationCompatibilityAdapter.Domain.LEARNER, "batch-learner");
        } catch (IllegalStateException expected) {
            crossTenantRejected = true;
        }
        require(crossTenantRejected, "cross-tenant state is not visible");

        boolean clientFactsRejected = false;
        try {
            B14MigrationCompatibilityAdapter.rejectClientFacts(Map.of(
                    "tenant_id", "tenant-b", "role", "ADMIN", "domain", "COMMERCE"));
        } catch (IllegalArgumentException expected) {
            clientFactsRejected = true;
        }
        require(clientFactsRejected, "client tenant role domain facts rejected");

        boolean invalidHashRejected = false;
        try {
            new B14MigrationCompatibilityAdapter.DomainSnapshot(true, "target-v2", 1, "not-a-sha256");
        } catch (IllegalArgumentException expected) {
            invalidHashRejected = true;
        }
        require(invalidHashRejected, "invalid summary hash rejected");

        boolean invalidRowsRejected = false;
        try {
            new B14MigrationCompatibilityAdapter.DomainSnapshot(
                    true, "v1", -1, B14MigrationCompatibilityAdapter.sha256("rows"));
        } catch (IllegalArgumentException expected) {
            invalidRowsRejected = true;
        }
        require(invalidRowsRejected, "negative row count rejected");

        boolean invalidKeyRejected = false;
        try {
            adapter.migrate(request(B14MigrationCompatibilityAdapter.Domain.MEDIA, "batch-invalid-key",
                    available("legacy-v1", 1, "media"), available("target-v2", 1, "media"), "short"), NOW);
        } catch (IllegalArgumentException expected) {
            invalidKeyRejected = true;
        }
        require(invalidKeyRejected, "short idempotency key rejected");
    }

    private static B14MigrationCompatibilityAdapter.MigrationRequest request(
            B14MigrationCompatibilityAdapter.Domain domain, String batchId,
            B14MigrationCompatibilityAdapter.DomainSnapshot legacy,
            B14MigrationCompatibilityAdapter.DomainSnapshot target, String idempotencyKey) {
        return new B14MigrationCompatibilityAdapter.MigrationRequest(
                domain, batchId, legacy, target, idempotencyKey, "trace-b14-smoke");
    }

    private static B14MigrationCompatibilityAdapter.DomainSnapshot available(
            String version, long rowCount, String summarySeed) {
        return new B14MigrationCompatibilityAdapter.DomainSnapshot(
                true, version, rowCount, B14MigrationCompatibilityAdapter.sha256(summarySeed));
    }

    private static void require(boolean condition, String description) {
        if (!condition) throw new AssertionError(description);
    }
}
