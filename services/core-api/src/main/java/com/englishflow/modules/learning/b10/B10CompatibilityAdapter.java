package com.englishflow.modules.learning.b10;

import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * B10 migration-only anti-corruption boundary for B2/B3 read shadowing.
 *
 * <p>The adapter stores reconciliation and route-control facts only. It never
 * receives domain rows, raw answers, content rules, or a command that can
 * mutate learning/assessment/content facts. A durable implementation may
 * replace the maps with the cmp_b10_* adapter tables without changing this
 * state-machine contract.</p>
 */
public final class B10CompatibilityAdapter {
    private static final Pattern SHA256 = Pattern.compile("^[A-Fa-f0-9]{64}$");
    private static final Pattern FIXTURE = Pattern.compile("^b[23]-v[0-9]+$");
    private static final Set<String> DOMAINS = Set.of(
            "VOCABULARY", "ASSESSMENT", "GRAMMAR", "READING", "WRITING", "LISTENING", "SPEAKING");
    private static final Set<String> ROUTE_REASONS = Set.of(
            "INITIAL_SHADOW", "MATCH_CONFIRMED", "CONTROLLED_CUTOVER", "DEPENDENCY_DEGRADED", "MANUAL_RECOVERY");
    private static final Set<String> ROLLBACK_REASONS = Set.of(
            "MISMATCH_DETECTED", "TARGET_UNAVAILABLE", "CONTENT_PIN_UNAVAILABLE", "DLQ_BACKLOG", "MANUAL_RECOVERY");

    private final Map<String, Reconciliation> reconciliations = new HashMap<>();
    private final Map<String, Reconciliation> latestByScope = new HashMap<>();
    private final Map<String, RouteControl> routes = new HashMap<>();
    private final Map<String, OperationFingerprint> idempotency = new HashMap<>();
    private final Map<String, Reconciliation> reconciliationReplays = new HashMap<>();
    private final Map<String, RouteDecision> routeReplays = new HashMap<>();
    private final Map<String, RouteDecision> rollbackReplays = new HashMap<>();
    private final Map<String, RollbackRecord> rollbackByKey = new HashMap<>();

    public synchronized OperationResult<Reconciliation> reconcile(ReconciliationRequest request, Instant comparedAt) {
        validate(request);
        Objects.requireNonNull(comparedAt, "comparedAt");
        String scope = scope(request.domainCode(), request.subjectRefHash());
        String idemScope = "reconcile:" + scope + ":" + request.idempotencyKey();
        OperationFingerprint fingerprint = new OperationFingerprint(request.fingerprint());
        OperationFingerprint previous = idempotency.get(idemScope);
        if (previous != null) {
            if (!previous.equals(fingerprint)) throw conflict("B10_IDEMPOTENCY_KEY_REUSED");
            return new OperationResult<>(reconciliationReplays.get(idemScope), true);
        }

        ComparisonStatus status = compareStatus(request);
        boolean safeToCutover = status == ComparisonStatus.MATCH && request.targetAvailable();
        String comparisonId = "cmp_" + stableId(scope + ":" + request.fixtureVersion() + ":" + request.targetVersion());
        Reconciliation reconciliation = new Reconciliation(
                comparisonId,
                request.domainCode(),
                request.subjectRefHash(),
                request.fixtureVersion(),
                request.legacyVersion(),
                request.targetVersion(),
                request.legacySnapshotHash(),
                request.targetSnapshotHash(),
                status,
                request.differenceCodes(),
                ReadMode.LEGACY_READ,
                true,
                safeToCutover,
                null,
                comparedAt,
                request.traceId());
        reconciliations.put(comparisonId, reconciliation);
        latestByScope.put(scope, reconciliation);
        idempotency.put(idemScope, fingerprint);
        reconciliationReplays.put(idemScope, reconciliation);
        return new OperationResult<>(reconciliation, false);
    }

    public synchronized Reconciliation readShadow(String domainCode, String subjectRefHash, String fixtureVersion) {
        validateDomain(domainCode);
        validateHash(subjectRefHash, "subjectRefHash");
        validateFixture(fixtureVersion);
        Reconciliation reconciliation = latestByScope.get(scope(domainCode, subjectRefHash));
        if (reconciliation == null || !reconciliation.fixtureVersion().equals(fixtureVersion)) {
            throw new CompatibilityException("B10_COMPATIBILITY_NOT_FOUND");
        }
        RouteControl route = routes.get(scope(domainCode, subjectRefHash));
        ReadMode mode = route == null ? ReadMode.LEGACY_READ : route.mode();
        return reconciliation.withReadMode(mode);
    }

    public synchronized OperationResult<RouteDecision> decideRoute(RouteDecisionRequest request, Instant decidedAt) {
        validate(request);
        Objects.requireNonNull(decidedAt, "decidedAt");
        String scope = scope(request.domainCode(), request.subjectRefHash());
        String idemScope = "route:" + scope + ":" + request.idempotencyKey();
        OperationFingerprint fingerprint = new OperationFingerprint(request.fingerprint());
        OperationFingerprint previous = idempotency.get(idemScope);
        if (previous != null) {
            if (!previous.equals(fingerprint)) throw conflict("B10_IDEMPOTENCY_KEY_REUSED");
            return new OperationResult<>(routeReplays.get(idemScope), true);
        }

        RouteControl current = routes.getOrDefault(scope, RouteControl.initial());
        if (current.configVersion() != request.expectedConfigVersion()) {
            throw conflict("B10_ROUTE_CONFIG_VERSION_CONFLICT");
        }
        Reconciliation reconciliation = requireComparison(request.comparisonId(), scope);
        if (request.desiredMode() == ReadMode.TARGET_READ
                && (!reconciliation.safeToCutover() || !hasTarget(reconciliation))) {
            throw conflict("B10_TARGET_CUTOVER_NOT_SAFE");
        }
        if (!request.rollbackWindowEndsAt().isAfter(decidedAt)) {
            throw conflict("B10_ROLLBACK_WINDOW_INVALID");
        }

        RouteControl next = new RouteControl(
                request.desiredMode(),
                current.configVersion() + 1,
                reconciliation.comparisonId(),
                request.rollbackWindowEndsAt(),
                decidedAt,
                request.traceId());
        routes.put(scope, next);
        idempotency.put(idemScope, fingerprint);
        RouteDecision decision = next.toDecision(request.domainCode());
        routeReplays.put(idemScope, decision);
        return new OperationResult<>(decision, false);
    }

    public synchronized OperationResult<RouteDecision> rollback(RollbackRequest request, Instant rolledBackAt) {
        validate(request);
        Objects.requireNonNull(rolledBackAt, "rolledBackAt");
        String scope = scope(request.domainCode(), request.subjectRefHash());
        String idemScope = "rollback:" + scope + ":" + request.idempotencyKey();
        OperationFingerprint fingerprint = new OperationFingerprint(request.fingerprint());
        OperationFingerprint previous = idempotency.get(idemScope);
        if (previous != null) {
            if (!previous.equals(fingerprint)) throw conflict("B10_IDEMPOTENCY_KEY_REUSED");
            return new OperationResult<>(rollbackReplays.get(idemScope), true);
        }

        RouteControl current = routes.get(scope);
        if (current == null) throw conflict("B10_ROUTE_NOT_INITIALIZED");
        if (current.configVersion() != request.expectedConfigVersion()) {
            throw conflict("B10_ROUTE_CONFIG_VERSION_CONFLICT");
        }
        if (!current.comparisonId().equals(request.comparisonId())) {
            throw conflict("B10_COMPARISON_VERSION_CONFLICT");
        }
        if (!current.rollbackWindowEndsAt().isAfter(rolledBackAt)) {
            throw conflict("B10_ROLLBACK_WINDOW_CLOSED");
        }
        Reconciliation reconciliation = requireComparison(request.comparisonId(), scope);
        if (request.targetMode() == ReadMode.TARGET_READ
                && (!reconciliation.safeToCutover() || !hasTarget(reconciliation))) {
            throw conflict("B10_TARGET_CUTOVER_NOT_SAFE");
        }

        RouteControl next = new RouteControl(
                request.targetMode(),
                current.configVersion() + 1,
                current.comparisonId(),
                current.rollbackWindowEndsAt(),
                rolledBackAt,
                request.traceId());
        routes.put(scope, next);
        RollbackRecord record = new RollbackRecord(
                "rb_" + stableId(scope + ":" + request.idempotencyKey()),
                request.domainCode(),
                request.comparisonId(),
                current.mode(),
                request.targetMode(),
                request.reasonCode(),
                rolledBackAt,
                false,
                request.traceId());
        rollbackByKey.put(idemScope, record);
        idempotency.put(idemScope, fingerprint);
        RouteDecision decision = next.toDecision(request.domainCode());
        rollbackReplays.put(idemScope, decision);
        return new OperationResult<>(decision, false);
    }

    public synchronized ReadResolution resolveRead(String domainCode, String subjectRefHash, Instant resolvedAt) {
        validateDomain(domainCode);
        validateHash(subjectRefHash, "subjectRefHash");
        Objects.requireNonNull(resolvedAt, "resolvedAt");
        RouteControl route = routes.get(scope(domainCode, subjectRefHash));
        ReadMode mode = route == null ? ReadMode.LEGACY_READ : route.mode();
        boolean fallbackAllowed = route != null && route.rollbackWindowEndsAt().isAfter(resolvedAt);
        return new ReadResolution(domainCode, subjectRefHash, mode, fallbackAllowed, resolvedAt);
    }

    public synchronized RollbackRecord lastRollback(String domainCode, String subjectRefHash, String idempotencyKey) {
        return rollbackByKey.get("rollback:" + scope(domainCode, subjectRefHash) + ":" + idempotencyKey);
    }

    private Reconciliation requireComparison(String comparisonId, String scope) {
        Reconciliation reconciliation = reconciliations.get(comparisonId);
        if (reconciliation == null || !scope.equals(scope(reconciliation.domainCode(), reconciliation.subjectRefHash()))) {
            throw conflict("B10_COMPARISON_NOT_FOUND");
        }
        return reconciliation;
    }

    private static ComparisonStatus compareStatus(ReconciliationRequest request) {
        if (!request.legacyAvailable() && !request.targetAvailable()) return ComparisonStatus.UNAVAILABLE;
        if (!request.legacyAvailable()) return ComparisonStatus.TARGET_ONLY;
        if (!request.targetAvailable()) return ComparisonStatus.LEGACY_ONLY;
        if (request.legacySnapshotHash() == null || request.targetSnapshotHash() == null) {
            return ComparisonStatus.NOT_COMPARED;
        }
        return request.legacySnapshotHash().equalsIgnoreCase(request.targetSnapshotHash())
                && request.differenceCodes().isEmpty() ? ComparisonStatus.MATCH : ComparisonStatus.MISMATCH;
    }

    private static boolean hasTarget(Reconciliation reconciliation) {
        return reconciliation.targetSnapshotHash() != null && !reconciliation.targetSnapshotHash().isBlank();
    }

    private static String scope(String domainCode, String subjectRefHash) {
        return domainCode + ":" + subjectRefHash;
    }

    private static String stableId(String value) {
        return Integer.toUnsignedString(value.hashCode(), 36) + "_" + Integer.toUnsignedString((value + ":b10").hashCode(), 36);
    }

    private static void validate(ReconciliationRequest request) {
        Objects.requireNonNull(request, "reconciliation request");
        validateDomain(request.domainCode());
        validateHash(request.subjectRefHash(), "subjectRefHash");
        validateFixture(request.fixtureVersion());
        requireText(request.legacyVersion(), "legacyVersion");
        requireText(request.targetVersion(), "targetVersion");
        validateOptionalHash(request.legacySnapshotHash(), "legacySnapshotHash");
        validateOptionalHash(request.targetSnapshotHash(), "targetSnapshotHash");
        validateDifferences(request.differenceCodes());
        requireKey(request.idempotencyKey());
        requireText(request.traceId(), "traceId");
    }

    private static void validate(RouteDecisionRequest request) {
        Objects.requireNonNull(request, "route decision request");
        validateDomain(request.domainCode());
        validateHash(request.subjectRefHash(), "subjectRefHash");
        if (request.desiredMode() == null) throw bad("desiredMode");
        requireText(request.comparisonId(), "comparisonId");
        if (request.expectedConfigVersion() < 0) throw bad("expectedConfigVersion");
        if (!ROUTE_REASONS.contains(request.reasonCode())) throw bad("reasonCode");
        requireKey(request.idempotencyKey());
        requireText(request.traceId(), "traceId");
        Objects.requireNonNull(request.rollbackWindowEndsAt(), "rollbackWindowEndsAt");
    }

    private static void validate(RollbackRequest request) {
        Objects.requireNonNull(request, "rollback request");
        validateDomain(request.domainCode());
        validateHash(request.subjectRefHash(), "subjectRefHash");
        if (request.targetMode() == null) throw bad("targetMode");
        requireText(request.comparisonId(), "comparisonId");
        if (request.expectedConfigVersion() < 0) throw bad("expectedConfigVersion");
        if (request.targetMode() == ReadMode.SHADOW_READ) throw bad("targetMode");
        if (!ROLLBACK_REASONS.contains(request.reasonCode())) throw bad("reasonCode");
        requireKey(request.idempotencyKey());
        requireText(request.traceId(), "traceId");
    }

    private static void validateDomain(String domainCode) {
        if (domainCode == null || !DOMAINS.contains(domainCode)) throw bad("domainCode");
    }

    private static void validateFixture(String fixtureVersion) {
        if (fixtureVersion == null || !FIXTURE.matcher(fixtureVersion).matches()) throw bad("fixtureVersion");
    }

    private static void validateHash(String value, String field) {
        if (value == null || !SHA256.matcher(value).matches()) throw bad(field);
    }

    private static void validateOptionalHash(String value, String field) {
        if (value != null && !value.isBlank()) validateHash(value, field);
    }

    private static void validateDifferences(List<String> differences) {
        if (differences == null || differences.size() > 64) throw bad("differenceCodes");
        for (String difference : differences) {
            if (difference == null || difference.isBlank() || difference.length() > 96) throw bad("differenceCodes");
        }
    }

    private static void requireKey(String key) {
        if (key == null || key.length() < 16 || key.length() > 192) throw bad("idempotencyKey");
    }

    private static void requireText(String value, String field) {
        if (value == null || value.isBlank()) throw bad(field);
    }

    private static CompatibilityException bad(String field) {
        return new CompatibilityException("B10_INVALID_" + field.toUpperCase());
    }

    private static CompatibilityException conflict(String code) {
        return new CompatibilityException(code);
    }

    public enum ReadMode { LEGACY_READ, SHADOW_READ, TARGET_READ, FALLBACK_READ }

    public enum ComparisonStatus { MATCH, MISMATCH, LEGACY_ONLY, TARGET_ONLY, UNAVAILABLE, NOT_COMPARED }

    public record ReconciliationRequest(
            String domainCode,
            String subjectRefHash,
            String fixtureVersion,
            String legacyVersion,
            String targetVersion,
            String legacySnapshotHash,
            String targetSnapshotHash,
            boolean legacyAvailable,
            boolean targetAvailable,
            List<String> differenceCodes,
            String idempotencyKey,
            String traceId) {
        public ReconciliationRequest {
            differenceCodes = differenceCodes == null ? List.of() : List.copyOf(differenceCodes);
        }

        private String fingerprint() {
            return String.join("|", String.valueOf(domainCode), String.valueOf(subjectRefHash), String.valueOf(fixtureVersion),
                    String.valueOf(legacyVersion), String.valueOf(targetVersion), String.valueOf(legacySnapshotHash),
                    String.valueOf(targetSnapshotHash), Boolean.toString(legacyAvailable), Boolean.toString(targetAvailable),
                    String.join(",", differenceCodes), String.valueOf(traceId));
        }
    }

    public record RouteDecisionRequest(
            String domainCode,
            String subjectRefHash,
            ReadMode desiredMode,
            long expectedConfigVersion,
            String comparisonId,
            String reasonCode,
            Instant rollbackWindowEndsAt,
            String idempotencyKey,
            String traceId) {
        private String fingerprint() {
            return String.join("|", String.valueOf(domainCode), String.valueOf(subjectRefHash), String.valueOf(desiredMode),
                    Long.toString(expectedConfigVersion), String.valueOf(comparisonId), String.valueOf(reasonCode),
                    String.valueOf(rollbackWindowEndsAt), String.valueOf(traceId));
        }
    }

    public record RollbackRequest(
            String domainCode,
            String subjectRefHash,
            ReadMode targetMode,
            long expectedConfigVersion,
            String reasonCode,
            String comparisonId,
            String idempotencyKey,
            String traceId) {
        private String fingerprint() {
            return String.join("|", String.valueOf(domainCode), String.valueOf(subjectRefHash), String.valueOf(targetMode),
                    Long.toString(expectedConfigVersion), String.valueOf(reasonCode), String.valueOf(comparisonId),
                    String.valueOf(traceId));
        }
    }

    public record Reconciliation(
            String comparisonId,
            String domainCode,
            String subjectRefHash,
            String fixtureVersion,
            String legacyVersion,
            String targetVersion,
            String legacySnapshotHash,
            String targetSnapshotHash,
            ComparisonStatus status,
            List<String> differenceCodes,
            ReadMode readMode,
            boolean readOnly,
            boolean safeToCutover,
            Instant rollbackWindowEndsAt,
            Instant comparedAt,
            String traceId) {
        public Reconciliation {
            differenceCodes = List.copyOf(differenceCodes);
        }

        private Reconciliation withReadMode(ReadMode mode) {
            return new Reconciliation(comparisonId, domainCode, subjectRefHash, fixtureVersion, legacyVersion,
                    targetVersion, legacySnapshotHash, targetSnapshotHash, status, differenceCodes, mode,
                    true, safeToCutover, rollbackWindowEndsAt, comparedAt, traceId);
        }
    }

    public record RouteDecision(
            String domainCode,
            ReadMode mode,
            long configVersion,
            boolean fallbackAllowed,
            Instant rollbackWindowEndsAt,
            Instant updatedAt,
            String comparisonId,
            String traceId) { }

    public record ReadResolution(
            String domainCode,
            String subjectRefHash,
            ReadMode mode,
            boolean fallbackAllowed,
            Instant resolvedAt) { }

    public record RollbackRecord(
            String rollbackId,
            String domainCode,
            String comparisonId,
            ReadMode fromMode,
            ReadMode toMode,
            String reasonCode,
            Instant createdAt,
            boolean domainFactsMutated,
            String traceId) { }

    public record OperationResult<T>(T value, boolean replayed) { }

    public static final class CompatibilityException extends RuntimeException {
        private static final long serialVersionUID = 1L;

        public CompatibilityException(String message) { super(message); }
    }

    private record OperationFingerprint(String value) { }

    private record RouteControl(
            ReadMode mode,
            long configVersion,
            String comparisonId,
            Instant rollbackWindowEndsAt,
            Instant updatedAt,
            String traceId) {
        private static RouteControl initial() {
            return new RouteControl(ReadMode.LEGACY_READ, 0, "", Instant.MAX, Instant.EPOCH, "bootstrap");
        }

        private RouteDecision toDecision(String domainCode) {
            return new RouteDecision(domainCode, mode, configVersion, !Instant.MAX.equals(rollbackWindowEndsAt),
                    rollbackWindowEndsAt, updatedAt, comparisonId, traceId);
        }
    }
}
