package com.englishflow.modules.b14;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Dependency-free B14 migration anti-corruption boundary for the Java 17
 * legacy core-api.
 *
 * <p>The adapter records migration metadata, shadow comparisons, route state
 * and compensation receipts only. It never receives a client tenant, role or
 * domain fact and it has no target-domain repository/writer port. Target
 * services remain the only owners of target facts; the configured tenant is a
 * server-side deployment binding and is never read from a request.</p>
 */
public final class B14MigrationCompatibilityAdapter {

    private static final Pattern SHA256 = Pattern.compile("^[A-Fa-f0-9]{64}$");
    private static final Pattern IDENTIFIER = Pattern.compile("^[A-Za-z0-9._:-]{1,128}$");
    private static final Set<String> CLIENT_FACT_MARKERS = Set.of(
            "role", "roles", "tenant", "tenantid", "domain", "domainid",
            "domainfacts", "owner", "ownerid", "subject", "subjectid");

    private final String serverTenantScopeHash;
    private final Map<String, MigrationRecord> migrations = new LinkedHashMap<>();
    private final Map<String, ShadowComparison> shadows = new LinkedHashMap<>();
    private final Map<String, CompensationRecord> compensations = new LinkedHashMap<>();
    private final Map<Domain, RouteState> routes = new LinkedHashMap<>();
    private final Map<String, String> idempotencyFingerprints = new LinkedHashMap<>();
    private final Map<String, ShadowComparison> shadowReplays = new LinkedHashMap<>();
    private final Map<String, MigrationRecord> migrationReplays = new LinkedHashMap<>();
    private final Map<String, String> failureFingerprints = new LinkedHashMap<>();
    private final Map<String, MigrationRecord> failureReplays = new LinkedHashMap<>();
    private final Map<String, CompensationRecord> compensationReplays = new LinkedHashMap<>();
    private final Map<String, RouteState> routeReplays = new LinkedHashMap<>();

    /**
     * The tenant is a server configuration value, not a client request field.
     * Store only a scope hash so the compatibility record does not expose the
     * deployment tenant identifier.
     */
    public B14MigrationCompatibilityAdapter(String serverTenantId) {
        requireServerTenant(serverTenantId);
        this.serverTenantScopeHash = sha256(serverTenantId.trim());
        for (Domain domain : Domain.values()) {
            routes.put(domain, RouteState.initial(domain));
        }
    }

    /**
     * Performs a read-only legacy/target comparison for one domain and batch.
     * The input contains metadata snapshots, never domain rows or write
     * commands.
     */
    public synchronized OperationResult<ShadowComparison> shadowCompare(
            MigrationRequest request, Instant comparedAt) {
        validate(request);
        Objects.requireNonNull(comparedAt, "comparedAt");
        String batchKey = batchKey(request.domain(), request.batchId());
        String operationKey = operationKey("shadow", request.idempotencyKey());
        String fingerprint = request.fingerprint();
        String previousFingerprint = idempotencyFingerprints.get(operationKey);
        if (previousFingerprint != null) {
            ensureSameFingerprint(previousFingerprint, fingerprint);
            return new OperationResult<>(shadowReplays.get(operationKey), true);
        }

        ShadowComparison existing = shadows.get(batchKey);
        if (existing != null) {
            ensureSameFingerprint(existing.fingerprint(), fingerprint);
            idempotencyFingerprints.put(operationKey, fingerprint);
            shadowReplays.put(operationKey, existing);
            return new OperationResult<>(existing, true);
        }

        ShadowComparison comparison = compare(request, comparedAt, batchKey);
        shadows.put(batchKey, comparison);
        idempotencyFingerprints.put(operationKey, fingerprint);
        shadowReplays.put(operationKey, comparison);
        return new OperationResult<>(comparison, false);
    }

    /**
     * Records a metadata-only migration batch. A matching target snapshot is
     * required before the batch is marked completed; other availability or
     * comparison states are retained as shadow-only evidence.
     */
    public synchronized OperationResult<MigrationRecord> migrate(
            MigrationRequest request, Instant migratedAt) {
        validate(request);
        Objects.requireNonNull(migratedAt, "migratedAt");
        String batchKey = batchKey(request.domain(), request.batchId());
        String operationKey = operationKey("migrate", request.idempotencyKey());
        String fingerprint = request.fingerprint();

        String previousFingerprint = idempotencyFingerprints.get(operationKey);
        if (previousFingerprint != null) {
            ensureSameFingerprint(previousFingerprint, fingerprint);
            return new OperationResult<>(migrationReplays.get(operationKey), true);
        }

        MigrationRecord existing = migrations.get(batchKey);
        if (existing != null) {
            ensureSameFingerprint(existing.fingerprint(), fingerprint);
            idempotencyFingerprints.put(operationKey, fingerprint);
            migrationReplays.put(operationKey, existing);
            return new OperationResult<>(existing, true);
        }

        ShadowComparison comparison = ensureComparison(request, migratedAt, batchKey);
        MigrationStatus status = comparison.status() == ReconciliationStatus.MATCH
                ? MigrationStatus.COMPLETED : MigrationStatus.SHADOW_ONLY;
        MigrationRecord record = new MigrationRecord(
                request.domain(), request.batchId(), request.legacySnapshot(), request.targetSnapshot(),
                comparison.status(), comparison.comparisonSummaryHash(), status, migratedAt,
                false, serverTenantScopeHash, true, true, fingerprint);
        migrations.put(batchKey, record);
        idempotencyFingerprints.put(operationKey, fingerprint);
        migrationReplays.put(operationKey, record);
        return new OperationResult<>(record, false);
    }

    /** Marks a metadata-only batch as failed before compensation is allowed. */
    public synchronized OperationResult<MigrationRecord> markFailed(
            MigrationFailureRequest request, Instant failedAt) {
        validate(request);
        Objects.requireNonNull(failedAt, "failedAt");
        String batchKey = batchKey(request.domain(), request.batchId());
        MigrationRecord migration = migrations.get(batchKey);
        if (migration == null) {
            throw conflict("B14_MIGRATION_NOT_FOUND");
        }

        String operationKey = operationKey("fail", request.idempotencyKey());
        String fingerprint = request.fingerprint();
        String previousFingerprint = idempotencyFingerprints.get(operationKey);
        if (previousFingerprint != null) {
            ensureSameFingerprint(previousFingerprint, fingerprint);
            return new OperationResult<>(failureReplays.get(operationKey), true);
        }
        String previousBatchFailure = failureFingerprints.get(batchKey);
        if (previousBatchFailure != null) {
            ensureSameFingerprint(previousBatchFailure, fingerprint);
            idempotencyFingerprints.put(operationKey, fingerprint);
            failureReplays.put(operationKey, migration);
            return new OperationResult<>(migration, true);
        }
        if (migration.status() == MigrationStatus.COMPLETED) {
            throw conflict("B14_COMPLETED_BATCH_CANNOT_FAIL");
        }
        if (migration.status() == MigrationStatus.COMPENSATED) {
            throw conflict("B14_COMPENSATED_BATCH_CANNOT_FAIL");
        }

        MigrationRecord failed = migration.withStatus(MigrationStatus.FAILED);
        migrations.put(batchKey, failed);
        failureFingerprints.put(batchKey, fingerprint);
        idempotencyFingerprints.put(operationKey, fingerprint);
        failureReplays.put(operationKey, failed);
        return new OperationResult<>(failed, false);
    }

    /**
     * Compensates a failed migration by recording a receipt and forcing the
     * domain read path to FALLBACK. It never deletes or mutates target facts.
     */
    public synchronized OperationResult<CompensationRecord> compensate(
            CompensationRequest request, Instant compensatedAt) {
        validate(request);
        Objects.requireNonNull(compensatedAt, "compensatedAt");
        String batchKey = batchKey(request.domain(), request.batchId());
        MigrationRecord migration = migrations.get(batchKey);
        if (migration == null) {
            throw conflict("B14_MIGRATION_NOT_FOUND");
        }

        String operationKey = operationKey("compensate", request.idempotencyKey());
        String fingerprint = request.fingerprint();
        String previousFingerprint = idempotencyFingerprints.get(operationKey);
        if (previousFingerprint != null) {
            ensureSameFingerprint(previousFingerprint, fingerprint);
            return new OperationResult<>(compensationReplays.get(operationKey), true);
        }

        CompensationRecord existing = compensations.get(batchKey);
        if (existing != null) {
            ensureSameFingerprint(existing.fingerprint(), fingerprint);
            idempotencyFingerprints.put(operationKey, fingerprint);
            compensationReplays.put(operationKey, existing);
            return new OperationResult<>(existing, true);
        }
        if (migration.status() != MigrationStatus.FAILED) {
            throw conflict("B14_COMPENSATION_REQUIRES_FAILED_BATCH");
        }

        CompensationRecord receipt = new CompensationRecord(
                request.domain(), request.batchId(), request.failureCode(), request.reasonCode(),
                compensatedAt, serverTenantScopeHash, true, true, fingerprint);
        compensations.put(batchKey, receipt);
        migrations.put(batchKey, migration.withStatus(MigrationStatus.COMPENSATED));
        forceFallback(request.domain(), request.batchId(), request.reasonCode(), compensatedAt);
        idempotencyFingerprints.put(operationKey, fingerprint);
        compensationReplays.put(operationKey, receipt);
        return new OperationResult<>(receipt, false);
    }

    /** Switches only compatibility routing; it cannot write target-domain facts. */
    public synchronized OperationResult<RouteState> switchReadPath(
            RouteRequest request, Instant switchedAt) {
        validate(request);
        Objects.requireNonNull(switchedAt, "switchedAt");
        String operationKey = operationKey("route", request.idempotencyKey());
        String fingerprint = request.fingerprint();
        String previousFingerprint = idempotencyFingerprints.get(operationKey);
        if (previousFingerprint != null) {
            ensureSameFingerprint(previousFingerprint, fingerprint);
            return new OperationResult<>(routeReplays.get(operationKey), true);
        }

        String batchKey = batchKey(request.domain(), request.batchId());
        if (request.readPath() == ReadPath.TARGET) {
            ShadowComparison comparison = shadows.get(batchKey);
            if (comparison == null || comparison.status() != ReconciliationStatus.MATCH
                    || !comparison.targetSnapshot().available()) {
                throw conflict("B14_TARGET_ROUTE_NOT_READY");
            }
        }
        if (request.readPath() == ReadPath.SHADOW && !shadows.containsKey(batchKey)) {
            throw conflict("B14_SHADOW_NOT_FOUND");
        }

        RouteState current = routes.get(request.domain());
        RouteState next = new RouteState(
                request.domain(), request.readPath(), request.batchId(), current.configVersion() + 1,
                request.reasonCode(), switchedAt, true, true);
        routes.put(request.domain(), next);
        idempotencyFingerprints.put(operationKey, fingerprint);
        routeReplays.put(operationKey, next);
        return new OperationResult<>(next, false);
    }

    /** Returns the configured path, resolving a target outage to FALLBACK. */
    public synchronized ReadResolution resolveRead(Domain domain, boolean targetAvailable) {
        Objects.requireNonNull(domain, "domain");
        RouteState configured = routes.get(domain);
        ReadPath resolved = configured.readPath();
        boolean fallbackApplied = false;
        if (resolved == ReadPath.TARGET && !targetAvailable) {
            resolved = ReadPath.FALLBACK;
            fallbackApplied = true;
        }
        return new ReadResolution(
                domain, configured.readPath(), resolved, configured.batchId(), fallbackApplied,
                true, true);
    }

    public synchronized MigrationRecord migration(Domain domain, String batchId) {
        requireDomain(domain);
        requireIdentifier(batchId, "batchId");
        MigrationRecord record = migrations.get(batchKey(domain, batchId));
        if (record == null) throw conflict("B14_MIGRATION_NOT_FOUND");
        return record;
    }

    public synchronized ShadowComparison shadow(Domain domain, String batchId) {
        requireDomain(domain);
        requireIdentifier(batchId, "batchId");
        ShadowComparison comparison = shadows.get(batchKey(domain, batchId));
        if (comparison == null) throw conflict("B14_SHADOW_NOT_FOUND");
        return comparison;
    }

    public synchronized RouteState route(Domain domain) {
        requireDomain(domain);
        return routes.get(domain);
    }

    /** Hash of server configuration only; no request tenant is accepted. */
    public String serverTenantScopeHash() {
        return serverTenantScopeHash;
    }

    /**
     * Boundary guard for HTTP/controller layers. The adapter itself has no
     * client request DTO, but callers can use this guard before translating
     * untrusted maps into server-owned metadata requests.
     */
    public static void rejectClientFacts(Map<String, ?> fields) {
        if (fields == null) return;
        for (String field : fields.keySet()) {
            if (field == null) continue;
            String normalized = field.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]", "");
            if (CLIENT_FACT_MARKERS.contains(normalized)
                    || normalized.contains("role")
                    || normalized.contains("tenant")
                    || normalized.contains("domain")
                    || normalized.contains("owner")
                    || normalized.contains("subject")) {
                throw new IllegalArgumentException("client identity/domain fact is not accepted: " + field);
            }
        }
    }

    public static String sha256(String value) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest(Objects.requireNonNull(value, "value").getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is required", exception);
        }
    }

    private ShadowComparison ensureComparison(
            MigrationRequest request, Instant comparedAt, String batchKey) {
        ShadowComparison existing = shadows.get(batchKey);
        if (existing != null) {
            ensureSameFingerprint(existing.fingerprint(), request.fingerprint());
            return existing;
        }
        ShadowComparison comparison = compare(request, comparedAt, batchKey);
        shadows.put(batchKey, comparison);
        return comparison;
    }

    private ShadowComparison compare(MigrationRequest request, Instant comparedAt, String batchKey) {
        ReconciliationStatus status = compareStatus(request.legacySnapshot(), request.targetSnapshot());
        String summaryHash = sha256(String.join("|",
                request.domain().name(), request.batchId(), request.legacySnapshot().canonical(),
                request.targetSnapshot().canonical()));
        return new ShadowComparison(
                "b14_cmp_" + sha256(serverTenantScopeHash + ":" + batchKey).substring(0, 24),
                request.domain(), request.batchId(), request.legacySnapshot(), request.targetSnapshot(), status,
                summaryHash, comparedAt, serverTenantScopeHash, true, true, request.fingerprint());
    }

    private void forceFallback(Domain domain, String batchId, String reasonCode, Instant changedAt) {
        RouteState current = routes.get(domain);
        routes.put(domain, new RouteState(
                domain, ReadPath.FALLBACK, batchId, current.configVersion() + 1, reasonCode,
                changedAt, true, true));
    }

    private String batchKey(Domain domain, String batchId) {
        return serverTenantScopeHash + ":" + domain.name() + ":" + batchId;
    }

    private String operationKey(String operation, String idempotencyKey) {
        return serverTenantScopeHash + ":" + operation + ":" + idempotencyKey;
    }

    private static ReconciliationStatus compareStatus(DomainSnapshot legacy, DomainSnapshot target) {
        if (!legacy.available() && !target.available()) return ReconciliationStatus.UNAVAILABLE;
        if (legacy.available() && !target.available()) return ReconciliationStatus.LEGACY_ONLY;
        if (!legacy.available() && target.available()) return ReconciliationStatus.TARGET_ONLY;
        return legacy.rowCount() == target.rowCount()
                && legacy.summaryHash().equalsIgnoreCase(target.summaryHash())
                ? ReconciliationStatus.MATCH : ReconciliationStatus.MISMATCH;
    }

    private static void validate(MigrationRequest request) {
        Objects.requireNonNull(request, "migration request");
        requireDomain(request.domain());
        requireIdentifier(request.batchId(), "batchId");
        Objects.requireNonNull(request.legacySnapshot(), "legacySnapshot");
        Objects.requireNonNull(request.targetSnapshot(), "targetSnapshot");
        requireIdempotencyKey(request.idempotencyKey());
        requireText(request.traceId(), "traceId");
    }

    private static void validate(CompensationRequest request) {
        Objects.requireNonNull(request, "compensation request");
        requireDomain(request.domain());
        requireIdentifier(request.batchId(), "batchId");
        requireIdentifier(request.failureCode(), "failureCode");
        requireIdentifier(request.reasonCode(), "reasonCode");
        requireIdempotencyKey(request.idempotencyKey());
        requireText(request.traceId(), "traceId");
    }

    private static void validate(MigrationFailureRequest request) {
        Objects.requireNonNull(request, "migration failure request");
        requireDomain(request.domain());
        requireIdentifier(request.batchId(), "batchId");
        requireIdentifier(request.failureCode(), "failureCode");
        requireIdentifier(request.reasonCode(), "reasonCode");
        requireIdempotencyKey(request.idempotencyKey());
        requireText(request.traceId(), "traceId");
    }

    private static void validate(RouteRequest request) {
        Objects.requireNonNull(request, "route request");
        requireDomain(request.domain());
        requireIdentifier(request.batchId(), "batchId");
        Objects.requireNonNull(request.readPath(), "readPath");
        if (request.readPath() == ReadPath.TARGET && request.batchId().isBlank()) {
            throw invalid("batchId");
        }
        requireIdentifier(request.reasonCode(), "reasonCode");
        requireIdempotencyKey(request.idempotencyKey());
        requireText(request.traceId(), "traceId");
    }

    private static void requireServerTenant(String value) {
        requireText(value, "serverTenantId");
        if (!IDENTIFIER.matcher(value.trim()).matches()) throw invalid("serverTenantId");
    }

    private static void requireDomain(Domain domain) {
        Objects.requireNonNull(domain, "domain");
    }

    private static void requireIdentifier(String value, String field) {
        if (value == null || !IDENTIFIER.matcher(value).matches()) throw invalid(field);
    }

    private static void requireIdempotencyKey(String value) {
        if (value == null || value.length() < 16 || value.length() > 192) {
            throw invalid("idempotencyKey");
        }
    }

    private static void requireText(String value, String field) {
        if (value == null || value.isBlank()) throw invalid(field);
    }

    private static void requireHash(String value, String field) {
        if (value == null || !SHA256.matcher(value).matches()) throw invalid(field);
    }

    private static void ensureSameFingerprint(String expected, String actual) {
        if (!Objects.equals(expected, actual)) throw conflict("B14_IDEMPOTENCY_KEY_REUSED");
    }

    private static IllegalArgumentException invalid(String field) {
        return new IllegalArgumentException("B14_INVALID_" + field.toUpperCase(Locale.ROOT));
    }

    private static IllegalStateException conflict(String code) {
        return new IllegalStateException(code);
    }

    public enum Domain {
        LEARNER, CONTENT, LEARNING, ASSESSMENT, MEDIA, GAMIFICATION, SOCIAL, COMMERCE
    }

    public enum ReconciliationStatus {
        MATCH, MISMATCH, LEGACY_ONLY, TARGET_ONLY, UNAVAILABLE
    }

    public enum MigrationStatus {
        COMPLETED, SHADOW_ONLY, FAILED, COMPENSATED
    }

    public enum ReadPath {
        LEGACY, SHADOW, TARGET, FALLBACK
    }

    public record DomainSnapshot(
            boolean available, String version, long rowCount, String summaryHash) {
        public DomainSnapshot {
            if (!available) {
                if (version != null && !version.isBlank()) throw invalid("snapshotVersion");
                if (rowCount != 0) throw invalid("snapshotRowCount");
                if (summaryHash != null) throw invalid("snapshotSummaryHash");
                version = null;
                summaryHash = null;
            } else {
                requireText(version, "snapshotVersion");
                if (rowCount < 0) throw invalid("snapshotRowCount");
                requireHash(summaryHash, "snapshotSummaryHash");
                version = version.trim();
                summaryHash = summaryHash.toLowerCase(Locale.ROOT);
            }
        }

        public static DomainSnapshot unavailable() {
            return new DomainSnapshot(false, null, 0, null);
        }

        private String canonical() {
            return available + ":" + String.valueOf(version) + ":" + rowCount + ":" + String.valueOf(summaryHash);
        }
    }

    public record MigrationRequest(
            Domain domain,
            String batchId,
            DomainSnapshot legacySnapshot,
            DomainSnapshot targetSnapshot,
            String idempotencyKey,
            String traceId) {
        private String fingerprint() {
            return String.join("|", domain == null ? "null" : domain.name(), String.valueOf(batchId),
                    String.valueOf(legacySnapshot), String.valueOf(targetSnapshot));
        }
    }

    public record CompensationRequest(
            Domain domain,
            String batchId,
            String failureCode,
            String reasonCode,
            String idempotencyKey,
            String traceId) {
        private String fingerprint() {
            return String.join("|", domain == null ? "null" : domain.name(), String.valueOf(batchId),
                    String.valueOf(failureCode), String.valueOf(reasonCode));
        }
    }

    public record MigrationFailureRequest(
            Domain domain,
            String batchId,
            String failureCode,
            String reasonCode,
            String idempotencyKey,
            String traceId) {
        private String fingerprint() {
            return String.join("|", domain == null ? "null" : domain.name(), String.valueOf(batchId),
                    String.valueOf(failureCode), String.valueOf(reasonCode));
        }
    }

    public record RouteRequest(
            Domain domain,
            String batchId,
            ReadPath readPath,
            String reasonCode,
            String idempotencyKey,
            String traceId) {
        private String fingerprint() {
            return String.join("|", domain == null ? "null" : domain.name(), String.valueOf(batchId),
                    String.valueOf(readPath), String.valueOf(reasonCode));
        }
    }

    public record ShadowComparison(
            String comparisonId,
            Domain domain,
            String batchId,
            DomainSnapshot legacySnapshot,
            DomainSnapshot targetSnapshot,
            ReconciliationStatus status,
            String comparisonSummaryHash,
            Instant comparedAt,
            String tenantScopeHash,
            boolean readOnly,
            boolean domainFactsUntouched,
            String fingerprint) {
        public ShadowComparison {
            Objects.requireNonNull(domain, "domain");
            Objects.requireNonNull(status, "status");
            Objects.requireNonNull(legacySnapshot, "legacySnapshot");
            Objects.requireNonNull(targetSnapshot, "targetSnapshot");
            if (!readOnly || !domainFactsUntouched) throw invalid("shadowSafety");
        }
    }

    public record MigrationRecord(
            Domain domain,
            String batchId,
            DomainSnapshot legacySnapshot,
            DomainSnapshot targetSnapshot,
            ReconciliationStatus reconciliationStatus,
            String comparisonSummaryHash,
            MigrationStatus status,
            Instant migratedAt,
            boolean compensated,
            String tenantScopeHash,
            boolean readOnly,
            boolean targetDomainFactsUntouched,
            String fingerprint) {
        public MigrationRecord {
            Objects.requireNonNull(domain, "domain");
            Objects.requireNonNull(status, "status");
            if (status == MigrationStatus.COMPENSATED && !compensated) {
                throw invalid("compensationState");
            }
            if (!readOnly || !targetDomainFactsUntouched) throw invalid("migrationSafety");
        }

        private MigrationRecord withStatus(MigrationStatus replacement) {
            return new MigrationRecord(domain, batchId, legacySnapshot, targetSnapshot,
                    reconciliationStatus, comparisonSummaryHash, replacement, migratedAt,
                    replacement == MigrationStatus.COMPENSATED, tenantScopeHash, readOnly,
                    targetDomainFactsUntouched, fingerprint);
        }
    }

    public record CompensationRecord(
            Domain domain,
            String batchId,
            String failureCode,
            String reasonCode,
            Instant compensatedAt,
            String tenantScopeHash,
            boolean readOnly,
            boolean domainFactsUntouched,
            String fingerprint) {
        public CompensationRecord {
            Objects.requireNonNull(domain, "domain");
            if (!readOnly || !domainFactsUntouched) throw invalid("compensationSafety");
        }
    }

    public record RouteState(
            Domain domain,
            ReadPath readPath,
            String batchId,
            long configVersion,
            String reasonCode,
            Instant changedAt,
            boolean readOnly,
            boolean domainFactsUntouched) {
        private static RouteState initial(Domain domain) {
            return new RouteState(domain, ReadPath.LEGACY, null, 0, "INITIAL", null, true, true);
        }

        public RouteState {
            Objects.requireNonNull(domain, "domain");
            Objects.requireNonNull(readPath, "readPath");
            if (configVersion < 0) throw invalid("configVersion");
            if (!readOnly || !domainFactsUntouched) throw invalid("routeSafety");
        }
    }

    public record ReadResolution(
            Domain domain,
            ReadPath configuredPath,
            ReadPath resolvedPath,
            String batchId,
            boolean fallbackApplied,
            boolean readOnly,
            boolean domainFactsUntouched) {
        public ReadResolution {
            Objects.requireNonNull(domain, "domain");
            Objects.requireNonNull(configuredPath, "configuredPath");
            Objects.requireNonNull(resolvedPath, "resolvedPath");
            if (!readOnly || !domainFactsUntouched) throw invalid("readSafety");
        }
    }

    public record OperationResult<T>(T value, boolean replayed) { }
}
