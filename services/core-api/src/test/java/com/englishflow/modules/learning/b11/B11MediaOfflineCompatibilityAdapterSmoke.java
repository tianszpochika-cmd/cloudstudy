package com.englishflow.modules.learning.b11;

import java.time.Instant;

/** Pure-Java smoke for the B11 migration-only media/offline anti-corruption boundary. */
public final class B11MediaOfflineCompatibilityAdapterSmoke {
    private static final String HASH = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    private static final String OTHER_HASH = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
    private static final Instant NOW = Instant.parse("2026-08-22T10:00:00Z");

    private B11MediaOfflineCompatibilityAdapterSmoke() { }

    public static void main(String[] args) {
        B11MediaOfflineCompatibilityAdapter adapter = new B11MediaOfflineCompatibilityAdapter();
        B11MediaOfflineCompatibilityAdapter.MediaReconciliationRequest matching =
                new B11MediaOfflineCompatibilityAdapter.MediaReconciliationRequest(
                        "b3-media-asset-001", "b3-v1", HASH, HASH,
                        true, true, true, true, "b11-reconcile-smoke-0001", "trace-b11-smoke");
        B11MediaOfflineCompatibilityAdapter.MediaReconciliation comparison =
                adapter.reconcile(matching, NOW).value();
        require(comparison.status() == B11MediaOfflineCompatibilityAdapter.ComparisonStatus.MATCH,
                "matching manifest comparison");
        require(comparison.safeToCutover() && comparison.readOnly(), "safe read-only cutover gate");

        B11MediaOfflineCompatibilityAdapter.OperationResult<
                B11MediaOfflineCompatibilityAdapter.ReadResolution> target = adapter.resolveRead(
                        new B11MediaOfflineCompatibilityAdapter.ReadRequest(
                                "b3-media-asset-001", "b3-v1",
                                B11MediaOfflineCompatibilityAdapter.ReadMode.TARGET_READ,
                                true, "trace-b11-smoke"), NOW);
        require(target.value().mode() == B11MediaOfflineCompatibilityAdapter.ReadMode.TARGET_READ,
                "target read for authorized matching asset");

        B11MediaOfflineCompatibilityAdapter.OperationResult<
                B11MediaOfflineCompatibilityAdapter.MigrationResult> migrated = adapter.migrateReference(
                        new B11MediaOfflineCompatibilityAdapter.ReferenceMigrationRequest(
                                "b3-media-asset-001", "b3-v1", HASH, OTHER_HASH,
                                "b11-migration-smoke-0001", "trace-b11-smoke"), NOW);
        require(migrated.value().status() == B11MediaOfflineCompatibilityAdapter.MigrationStatus.APPLIED,
                "authorized opaque reference migration");
        require(migrated.value().domainFactsUntouched(), "migration does not mutate B3 facts");

        B11MediaOfflineCompatibilityAdapter.MediaReconciliation legacyOnly = adapter.reconcile(
                new B11MediaOfflineCompatibilityAdapter.MediaReconciliationRequest(
                        "b3-media-asset-002", "b3-v1", HASH, null,
                        true, false, true, false, "b11-reconcile-smoke-0002", "trace-b11-smoke"),
                NOW.plusSeconds(1)).value();
        require(legacyOnly.status() == B11MediaOfflineCompatibilityAdapter.ComparisonStatus.LEGACY_ONLY,
                "legacy-only asset is explicit");
        B11MediaOfflineCompatibilityAdapter.ReadResolution fallback = adapter.resolveRead(
                new B11MediaOfflineCompatibilityAdapter.ReadRequest(
                        "b3-media-asset-002", "b3-v1",
                        B11MediaOfflineCompatibilityAdapter.ReadMode.TARGET_READ,
                        true, "trace-b11-smoke"), NOW.plusSeconds(1)).value();
        require(fallback.mode() == B11MediaOfflineCompatibilityAdapter.ReadMode.FALLBACK_READ,
                "target outage falls back to legacy read");

        B11MediaOfflineCompatibilityAdapter.MediaReconciliation unauthorized = adapter.reconcile(
                new B11MediaOfflineCompatibilityAdapter.MediaReconciliationRequest(
                        "b3-media-asset-003", "b3-v1", HASH, HASH,
                        true, true, false, false, "b11-reconcile-smoke-0003", "trace-b11-smoke"),
                NOW.plusSeconds(2)).value();
        require(unauthorized.status() == B11MediaOfflineCompatibilityAdapter.ComparisonStatus.UNAUTHORIZED,
                "unauthorized asset is not readable");
        expectCode(() -> adapter.resolveRead(new B11MediaOfflineCompatibilityAdapter.ReadRequest(
                "b3-media-asset-003", "b3-v1",
                B11MediaOfflineCompatibilityAdapter.ReadMode.LEGACY_READ,
                true, "trace-b11-smoke"), NOW), "B11_MEDIA_UNAUTHORIZED");

        adapter.revoke(new B11MediaOfflineCompatibilityAdapter.RevocationRequest(
                "b3-media-asset-001", "RIGHTS_REVOKED", "b11-revoke-smoke-0001", "trace-b11-smoke"),
                NOW.plusSeconds(3));
        expectCode(() -> adapter.resolveRead(new B11MediaOfflineCompatibilityAdapter.ReadRequest(
                "b3-media-asset-001", "b3-v1",
                B11MediaOfflineCompatibilityAdapter.ReadMode.TARGET_READ,
                true, "trace-b11-smoke"), NOW.plusSeconds(3)), "B11_MEDIA_REVOKED");

        B11MediaOfflineCompatibilityAdapter.OperationResult<
                B11MediaOfflineCompatibilityAdapter.MediaReconciliation> replay = adapter.reconcile(
                        matching, NOW.plusSeconds(4));
        require(replay.replayed(), "reconciliation is idempotent");
        System.out.println("core-api B11 media/offline compatibility smoke: PASS");
    }

    private static void expectCode(Runnable operation, String code) {
        try {
            operation.run();
            throw new AssertionError("expected " + code);
        } catch (B11MediaOfflineCompatibilityAdapter.CompatibilityException error) {
            require(code.equals(error.getMessage()), "expected error " + code);
        }
    }

    private static void require(boolean condition, String description) {
        if (!condition) throw new AssertionError(description);
    }
}
