package com.englishflow.modules.b12;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

/**
 * B12 migration anti-corruption layer for the Java 17 legacy core-api.
 *
 * <p>The adapter is deliberately dependency-free and fact-read-only. It records
 * hashes, dedupe receipts and reversible route state; it never writes a legacy
 * game/social/notification domain table and never accepts client growth facts.
 * The target services remain the only owners of B12 domain facts.</p>
 */
public final class B12CompatibilityAdapter {

    private static final Set<String> FORBIDDEN_CLIENT_FACTS = Set.of(
            "xp", "coins", "points", "delta", "scoreDelta", "balanceAfter", "rewardOutcome");

    private final Map<String, ShadowComparison> comparisons = new LinkedHashMap<>();
    private final Map<String, ReplayReceipt> replayReceipts = new LinkedHashMap<>();
    private final Map<Domain, RouteState> routes = new LinkedHashMap<>();

    public B12CompatibilityAdapter() {
        for (Domain domain : Domain.values()) {
            routes.put(domain, new RouteState(RouteMode.SHADOW, "legacy", null, "initial-shadow"));
        }
    }

    /** Performs a legacy/target hash comparison without copying or writing domain facts. */
    public synchronized ShadowComparison shadowRead(
            Domain domain,
            String aggregateRef,
            String legacySnapshotHash,
            String targetSnapshotHash,
            String fixtureVersion) {
        requireText(aggregateRef, "aggregateRef");
        requireHash(legacySnapshotHash, "legacySnapshotHash");
        if (targetSnapshotHash != null) requireHash(targetSnapshotHash, "targetSnapshotHash");
        requireText(fixtureVersion, "fixtureVersion");
        ReconciliationState state = targetSnapshotHash == null
                ? ReconciliationState.LEGACY_ONLY
                : legacySnapshotHash.equalsIgnoreCase(targetSnapshotHash)
                        ? ReconciliationState.MATCH : ReconciliationState.MISMATCH;
        String comparisonRef = domain.name().toLowerCase() + ":" + aggregateRef + ":" + fixtureVersion;
        ShadowComparison comparison = new ShadowComparison(comparisonRef, domain, aggregateRef,
                legacySnapshotHash, targetSnapshotHash, state, true, true, fixtureVersion);
        comparisons.put(comparisonRef, comparison);
        return comparison;
    }

    public synchronized ReplayReceipt replayTrustedEvent(
            Domain domain, String eventId, String dedupeKey, String sourceSnapshotHash) {
        requireText(eventId, "eventId");
        requireText(dedupeKey, "dedupeKey");
        requireHash(sourceSnapshotHash, "sourceSnapshotHash");
        String receiptKey = domain.name() + ":" + dedupeKey;
        ReplayReceipt existing = replayReceipts.get(receiptKey);
        if (existing != null) return existing.withState(ReplayState.DUPLICATE);
        ReplayReceipt receipt = new ReplayReceipt(eventId, dedupeKey, domain, sourceSnapshotHash,
                ReplayState.RECEIVED, true, true);
        replayReceipts.put(receiptKey, receipt);
        return receipt;
    }

    public synchronized ShadowComparison reconcile(String comparisonRef) {
        ShadowComparison comparison = comparisons.get(comparisonRef);
        if (comparison == null) throw new IllegalArgumentException("comparison not found");
        return comparison;
    }

    /** Switches only the compatibility route; this method cannot alter domain facts. */
    public synchronized RouteState switchRoute(
            Domain domain, RouteMode requestedMode, String targetVersion,
            String reasonCode, String idempotencyKey) {
        Objects.requireNonNull(domain, "domain");
        Objects.requireNonNull(requestedMode, "requestedMode");
        requireText(targetVersion, "targetVersion");
        requireText(reasonCode, "reasonCode");
        requireText(idempotencyKey, "idempotencyKey");
        RouteState current = routes.get(domain);
        if (requestedMode == RouteMode.TARGET && !hasMatch(domain)) {
            throw new IllegalStateException("target route requires a matching shadow comparison");
        }
        String rollbackVersion = current.targetVersion();
        RouteState next = new RouteState(requestedMode, targetVersion, rollbackVersion, reasonCode);
        routes.put(domain, next);
        return next;
    }

    /** Reverts to the previous safe target, or to legacy fallback when no target exists. */
    public synchronized RouteState rollback(Domain domain, String reasonCode, String idempotencyKey) {
        Objects.requireNonNull(domain, "domain");
        requireText(reasonCode, "reasonCode");
        requireText(idempotencyKey, "idempotencyKey");
        RouteState current = routes.get(domain);
        String fallbackVersion = current.rollbackVersion() == null ? "legacy" : current.rollbackVersion();
        RouteState next = new RouteState(RouteMode.FALLBACK, fallbackVersion, current.targetVersion(), reasonCode);
        routes.put(domain, next);
        return next;
    }

    public synchronized RouteState route(Domain domain) {
        return routes.get(Objects.requireNonNull(domain, "domain"));
    }

    /** Rejects any caller-supplied growth or balance fact at the migration boundary. */
    public static void rejectClientFacts(Map<String, ?> fields) {
        if (fields == null) return;
        for (String field : fields.keySet()) {
            if (FORBIDDEN_CLIENT_FACTS.contains(field)) {
                throw new IllegalArgumentException("client domain fact is not accepted: " + field);
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

    private boolean hasMatch(Domain domain) {
        return comparisons.values().stream()
                .anyMatch(item -> item.domain() == domain && item.state() == ReconciliationState.MATCH);
    }

    private static void requireText(String value, String name) {
        if (value == null || value.isBlank()) throw new IllegalArgumentException(name + " is required");
    }

    private static void requireHash(String value, String name) {
        requireText(value, name);
        if (!value.matches("^[A-Fa-f0-9]{64}$")) throw new IllegalArgumentException(name + " must be sha256");
    }

    public enum Domain { GAMIFICATION, SOCIAL, NOTIFICATION }
    public enum RouteMode { LEGACY, SHADOW, TARGET, FALLBACK }
    public enum ReconciliationState { MATCH, MISMATCH, LEGACY_ONLY, TARGET_ONLY, UNAVAILABLE, NOT_COMPARED }
    public enum ReplayState { RECEIVED, DUPLICATE, MISMATCH, REJECTED }

    public record ShadowComparison(
            String comparisonRef,
            Domain domain,
            String aggregateRef,
            String legacySnapshotHash,
            String targetSnapshotHash,
            ReconciliationState state,
            boolean readOnly,
            boolean domainFactsUntouched,
            String fixtureVersion) {
        public ShadowComparison {
            Objects.requireNonNull(domain, "domain");
            Objects.requireNonNull(state, "state");
            if (!readOnly || !domainFactsUntouched) throw new IllegalArgumentException("B12 compatibility must be read-only");
        }
    }

    public record ReplayReceipt(
            String eventId,
            String dedupeKey,
            Domain domain,
            String sourceSnapshotHash,
            ReplayState state,
            boolean readOnly,
            boolean domainFactsUntouched) {
        private ReplayReceipt withState(ReplayState replacement) {
            return new ReplayReceipt(eventId, dedupeKey, domain, sourceSnapshotHash, replacement,
                    readOnly, domainFactsUntouched);
        }
    }

    public record RouteState(RouteMode mode, String targetVersion, String rollbackVersion, String reasonCode) {
        public RouteState {
            Objects.requireNonNull(mode, "mode");
            if (targetVersion == null || targetVersion.isBlank()) throw new IllegalArgumentException("targetVersion is required");
        }
    }
}
