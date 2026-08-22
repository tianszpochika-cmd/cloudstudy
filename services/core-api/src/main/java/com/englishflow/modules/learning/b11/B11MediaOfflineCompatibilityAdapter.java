package com.englishflow.modules.learning.b11;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.Objects;
import java.util.regex.Pattern;

/**
 * B11 migration-only anti-corruption boundary for B3 media and offline facts.
 *
 * <p>This adapter can compare legacy and target metadata, choose a read mode,
 * migrate an opaque object reference, and record a rights revocation. It never
 * receives media bytes, answer data, client-submitted data, or a command that writes
 * a B3 domain fact. A durable implementation may replace the maps with the
 * cmp_b11_* adapter tables without changing this state-machine contract.</p>
 */
public final class B11MediaOfflineCompatibilityAdapter {
    private static final Pattern SHA256 = Pattern.compile("^[A-Fa-f0-9]{64}$");
    private static final Pattern FIXTURE = Pattern.compile("^b3-v[0-9]+$");
    private static final Pattern ASSET_ID = Pattern.compile("^[A-Za-z0-9._:-]{1,128}$");

    private final Map<String, MediaReconciliation> reconciliations = new HashMap<>();
    private final Map<String, MigrationResult> migrations = new HashMap<>();
    private final Map<String, RevocationResult> revocations = new HashMap<>();
    private final Map<String, OperationFingerprint> idempotency = new HashMap<>();
    private final Map<String, OperationResult<?>> replays = new HashMap<>();

    public synchronized OperationResult<MediaReconciliation> reconcile(
            MediaReconciliationRequest request, Instant comparedAt) {
        validate(request);
        Objects.requireNonNull(comparedAt, "comparedAt");
        String operationKey = "reconcile:" + request.assetId() + ":" + request.idempotencyKey();
        OperationFingerprint fingerprint = new OperationFingerprint(request.fingerprint());
        OperationFingerprint previous = idempotency.get(operationKey);
        if (previous != null) {
            ensureSameFingerprint(previous, fingerprint);
            @SuppressWarnings("unchecked")
            OperationResult<MediaReconciliation> replay =
                    (OperationResult<MediaReconciliation>) replays.get(operationKey);
            return new OperationResult<>(replay.value(), true);
        }

        ComparisonStatus status = compareStatus(request);
        boolean safeToCutover = status == ComparisonStatus.MATCH;
        MediaReconciliation reconciliation = new MediaReconciliation(
                "cmp_" + stableId(request.assetId() + ":" + request.fixtureVersion()),
                request.assetId(),
                request.fixtureVersion(),
                request.legacyManifestHash(),
                request.targetManifestHash(),
                request.legacyAvailable(),
                request.targetAvailable(),
                request.legacyAuthorized(),
                request.targetAuthorized(),
                status,
                ReadMode.SHADOW_READ,
                true,
                safeToCutover,
                true,
                comparedAt,
                request.traceId());
        OperationResult<MediaReconciliation> result = new OperationResult<>(reconciliation, false);
        reconciliations.put(scope(request.assetId(), request.fixtureVersion()), reconciliation);
        remember(operationKey, fingerprint, result);
        return result;
    }

    public synchronized OperationResult<ReadResolution> resolveRead(
            ReadRequest request, Instant resolvedAt) {
        validate(request);
        Objects.requireNonNull(resolvedAt, "resolvedAt");
        if (revocations.containsKey(request.assetId())) {
            throw conflict("B11_MEDIA_REVOKED");
        }
        MediaReconciliation reconciliation = reconciliations.get(scope(request.assetId(), request.fixtureVersion()));
        if (reconciliation == null) throw conflict("B11_COMPATIBILITY_NOT_FOUND");
        if (!request.serverAuthorized()
                || (!reconciliation.legacyAuthorized() && !reconciliation.targetAuthorized())) {
            throw conflict("B11_MEDIA_UNAUTHORIZED");
        }

        ReadMode mode = ReadMode.LEGACY_READ;
        if (request.desiredMode() == ReadMode.TARGET_READ && reconciliation.safeToCutover()
                && reconciliation.targetAvailable() && reconciliation.targetAuthorized()) {
            mode = ReadMode.TARGET_READ;
        } else if (request.desiredMode() == ReadMode.TARGET_READ) {
            mode = ReadMode.FALLBACK_READ;
        }
        return new OperationResult<>(new ReadResolution(
                request.assetId(), mode, true, mode != ReadMode.TARGET_READ, resolvedAt,
                request.traceId()), false);
    }

    public synchronized OperationResult<MigrationResult> migrateReference(
            ReferenceMigrationRequest request, Instant migratedAt) {
        validate(request);
        Objects.requireNonNull(migratedAt, "migratedAt");
        String operationKey = "migration:" + request.assetId() + ":" + request.idempotencyKey();
        OperationFingerprint fingerprint = new OperationFingerprint(request.fingerprint());
        OperationFingerprint previous = idempotency.get(operationKey);
        if (previous != null) {
            ensureSameFingerprint(previous, fingerprint);
            @SuppressWarnings("unchecked")
            OperationResult<MigrationResult> replay =
                    (OperationResult<MigrationResult>) replays.get(operationKey);
            return new OperationResult<>(replay.value(), true);
        }

        MediaReconciliation reconciliation = reconciliations.get(scope(request.assetId(), request.fixtureVersion()));
        if (reconciliation == null) throw conflict("B11_COMPATIBILITY_NOT_FOUND");
        MigrationStatus status = reconciliation.targetAvailable() && reconciliation.targetAuthorized()
                ? MigrationStatus.APPLIED : MigrationStatus.FALLBACK;
        String failureCode = status == MigrationStatus.FALLBACK ? "TARGET_UNAVAILABLE_OR_UNAUTHORIZED" : null;
        MigrationResult result = new MigrationResult(
                "mig_" + stableId(request.assetId() + ":" + request.sourceRefHash()),
                request.assetId(),
                request.sourceRefHash(),
                request.targetRefHash(),
                status,
                status == MigrationStatus.FALLBACK,
                failureCode,
                true,
                migratedAt,
                request.traceId());
        OperationResult<MigrationResult> operation = new OperationResult<>(result, false);
        migrations.put(scope(request.assetId(), request.fixtureVersion()), result);
        remember(operationKey, fingerprint, operation);
        return operation;
    }

    public synchronized OperationResult<RevocationResult> revoke(
            RevocationRequest request, Instant revokedAt) {
        validate(request);
        Objects.requireNonNull(revokedAt, "revokedAt");
        String operationKey = "revoke:" + request.assetId() + ":" + request.idempotencyKey();
        OperationFingerprint fingerprint = new OperationFingerprint(request.fingerprint());
        OperationFingerprint previous = idempotency.get(operationKey);
        if (previous != null) {
            ensureSameFingerprint(previous, fingerprint);
            @SuppressWarnings("unchecked")
            OperationResult<RevocationResult> replay =
                    (OperationResult<RevocationResult>) replays.get(operationKey);
            return new OperationResult<>(replay.value(), true);
        }

        RevocationResult result = new RevocationResult(
                request.assetId(), "REVOKED", request.reason(), true, revokedAt, request.traceId());
        OperationResult<RevocationResult> operation = new OperationResult<>(result, false);
        revocations.put(request.assetId(), result);
        remember(operationKey, fingerprint, operation);
        return operation;
    }

    public synchronized MigrationResult migration(String assetId, String fixtureVersion) {
        validateAssetId(assetId);
        validateFixture(fixtureVersion);
        return migrations.get(scope(assetId, fixtureVersion));
    }

    private void remember(String operationKey, OperationFingerprint fingerprint, OperationResult<?> result) {
        idempotency.put(operationKey, fingerprint);
        replays.put(operationKey, result);
    }

    private static ComparisonStatus compareStatus(MediaReconciliationRequest request) {
        if ((!request.legacyAvailable() && !request.targetAvailable())) return ComparisonStatus.UNAVAILABLE;
        if ((!request.legacyAuthorized() && !request.targetAuthorized())) return ComparisonStatus.UNAUTHORIZED;
        if (!request.legacyAvailable()) return ComparisonStatus.TARGET_ONLY;
        if (!request.targetAvailable()) return ComparisonStatus.LEGACY_ONLY;
        if (request.legacyManifestHash() == null || request.targetManifestHash() == null) {
            return ComparisonStatus.NOT_COMPARED;
        }
        return request.legacyManifestHash().equalsIgnoreCase(request.targetManifestHash())
                ? ComparisonStatus.MATCH : ComparisonStatus.MISMATCH;
    }

    private static String scope(String assetId, String fixtureVersion) {
        return assetId + ":" + fixtureVersion;
    }

    private static String stableId(String value) {
        return Integer.toUnsignedString(value.hashCode(), 36)
                + "_" + Integer.toUnsignedString((value + ":b11").hashCode(), 36);
    }

    private static void validate(MediaReconciliationRequest request) {
        Objects.requireNonNull(request, "reconciliation request");
        validateAssetId(request.assetId());
        validateFixture(request.fixtureVersion());
        validateOptionalHash(request.legacyManifestHash(), "legacyManifestHash");
        validateOptionalHash(request.targetManifestHash(), "targetManifestHash");
        requireKey(request.idempotencyKey());
        requireText(request.traceId(), "traceId");
    }

    private static void validate(ReadRequest request) {
        Objects.requireNonNull(request, "read request");
        validateAssetId(request.assetId());
        validateFixture(request.fixtureVersion());
        if (request.desiredMode() == null) throw bad("desiredMode");
        requireText(request.traceId(), "traceId");
    }

    private static void validate(ReferenceMigrationRequest request) {
        Objects.requireNonNull(request, "reference migration request");
        validateAssetId(request.assetId());
        validateFixture(request.fixtureVersion());
        validateHash(request.sourceRefHash(), "sourceRefHash");
        validateHash(request.targetRefHash(), "targetRefHash");
        requireKey(request.idempotencyKey());
        requireText(request.traceId(), "traceId");
    }

    private static void validate(RevocationRequest request) {
        Objects.requireNonNull(request, "revocation request");
        validateAssetId(request.assetId());
        requireText(request.reason(), "reason");
        requireKey(request.idempotencyKey());
        requireText(request.traceId(), "traceId");
    }

    private static void validateAssetId(String value) {
        if (value == null || !ASSET_ID.matcher(value).matches()) throw bad("assetId");
    }

    private static void validateFixture(String value) {
        if (value == null || !FIXTURE.matcher(value).matches()) throw bad("fixtureVersion");
    }

    private static void validateHash(String value, String field) {
        if (value == null || !SHA256.matcher(value).matches()) throw bad(field);
    }

    private static void validateOptionalHash(String value, String field) {
        if (value != null && !value.isBlank()) validateHash(value, field);
    }

    private static void requireKey(String value) {
        if (value == null || value.length() < 16 || value.length() > 192) throw bad("idempotencyKey");
    }

    private static void requireText(String value, String field) {
        if (value == null || value.isBlank()) throw bad(field);
    }

    private static void ensureSameFingerprint(OperationFingerprint previous, OperationFingerprint current) {
        if (!previous.equals(current)) throw conflict("B11_IDEMPOTENCY_KEY_REUSED");
    }

    private static CompatibilityException bad(String field) {
        return new CompatibilityException("B11_INVALID_" + field.toUpperCase());
    }

    private static CompatibilityException conflict(String code) {
        return new CompatibilityException(code);
    }

    public enum ReadMode { LEGACY_READ, SHADOW_READ, TARGET_READ, FALLBACK_READ }

    public enum ComparisonStatus { MATCH, MISMATCH, LEGACY_ONLY, TARGET_ONLY, UNAVAILABLE, UNAUTHORIZED, NOT_COMPARED }

    public enum MigrationStatus { PLANNED, APPLIED, FALLBACK, FAILED, ROLLED_BACK }

    public record MediaReconciliation(
            String comparisonId,
            String assetId,
            String fixtureVersion,
            String legacyManifestHash,
            String targetManifestHash,
            boolean legacyAvailable,
            boolean targetAvailable,
            boolean legacyAuthorized,
            boolean targetAuthorized,
            ComparisonStatus status,
            ReadMode readMode,
            boolean readOnly,
            boolean safeToCutover,
            boolean fallbackAllowed,
            Instant comparedAt,
            String traceId) { }

    public record ReadResolution(
            String assetId,
            ReadMode mode,
            boolean readOnly,
            boolean fallbackAllowed,
            Instant resolvedAt,
            String traceId) { }

    public record MigrationResult(
            String migrationId,
            String assetId,
            String sourceRefHash,
            String targetRefHash,
            MigrationStatus status,
            boolean fallbackAllowed,
            String failureCode,
            boolean domainFactsUntouched,
            Instant migratedAt,
            String traceId) { }

    public record RevocationResult(
            String assetId,
            String rightsStatus,
            String reason,
            boolean domainFactsUntouched,
            Instant revokedAt,
            String traceId) { }

    public record MediaReconciliationRequest(
            String assetId,
            String fixtureVersion,
            String legacyManifestHash,
            String targetManifestHash,
            boolean legacyAvailable,
            boolean targetAvailable,
            boolean legacyAuthorized,
            boolean targetAuthorized,
            String idempotencyKey,
            String traceId) {
        private String fingerprint() {
            return String.join("|", String.valueOf(assetId), String.valueOf(fixtureVersion),
                    String.valueOf(legacyManifestHash), String.valueOf(targetManifestHash),
                    Boolean.toString(legacyAvailable), Boolean.toString(targetAvailable),
                    Boolean.toString(legacyAuthorized), Boolean.toString(targetAuthorized), traceId);
        }
    }

    public record ReadRequest(
            String assetId,
            String fixtureVersion,
            ReadMode desiredMode,
            boolean serverAuthorized,
            String traceId) { }

    public record ReferenceMigrationRequest(
            String assetId,
            String fixtureVersion,
            String sourceRefHash,
            String targetRefHash,
            String idempotencyKey,
            String traceId) {
        private String fingerprint() {
            return String.join("|", String.valueOf(assetId), String.valueOf(fixtureVersion),
                    sourceRefHash, targetRefHash, traceId);
        }
    }

    public record RevocationRequest(String assetId, String reason, String idempotencyKey, String traceId) {
        private String fingerprint() {
            return String.join("|", String.valueOf(assetId), reason, traceId);
        }
    }

    public record OperationResult<T>(T value, boolean replayed) { }

    private record OperationFingerprint(String value) { }

    public static final class CompatibilityException extends RuntimeException {
        public CompatibilityException(String message) {
            super(message);
        }
    }
}
