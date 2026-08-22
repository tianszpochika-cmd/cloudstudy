package com.englishflow.notification.domain;

import java.util.List;

/** Sync result with explicit status plus compatibility projections for older clients. */
public final class OfflineSyncResult {

    private final SyncStatus status;
    private final String clientEventId;
    private final long clientSeq;
    private final long serverVersion;
    private final SyncCursor cursor;
    private final SyncConflict conflict;
    private final SyncFailureState failureState;
    private final boolean replayed;
    private final String traceId;
    private final String nextCursor;
    private final List<String> acceptedClientEventIds;
    private final List<OfflineConflict> conflicts;
    private final List<String> recoveryCodes;

    public OfflineSyncResult(SyncStatus status, String clientEventId, long clientSeq, long serverVersion,
            SyncCursor cursor, SyncConflict conflict, SyncFailureState failureState,
            boolean replayed, String traceId) {
        if (status == null || clientEventId == null || clientEventId.isBlank() || clientSeq < 1
                || cursor == null || traceId == null || traceId.isBlank()) {
            throw NotificationDomainException.invalid("offline sync result is invalid");
        }
        if (status == SyncStatus.CONFLICT && conflict == null) {
            throw NotificationDomainException.invalid("conflict result must include an explanation");
        }
        if (status == SyncStatus.FAILED && failureState == null) {
            throw NotificationDomainException.invalid("failed result must include a failure state");
        }
        this.status = status;
        this.clientEventId = clientEventId;
        this.clientSeq = clientSeq;
        this.serverVersion = serverVersion;
        this.cursor = cursor;
        this.conflict = conflict;
        this.failureState = failureState;
        this.replayed = replayed;
        this.traceId = traceId;
        this.nextCursor = Long.toString(cursor.lastClientSeq());
        this.acceptedClientEventIds = status == SyncStatus.APPLIED || status == SyncStatus.REPLAYED
                ? List.of(clientEventId) : List.of();
        this.conflicts = List.of();
        this.recoveryCodes = failureState == null ? List.of() : List.of(failureState.name());
    }

    /** Compatibility constructor for a batched B3 sync response. */
    public OfflineSyncResult(String nextCursor, List<String> acceptedClientEventIds,
            List<OfflineConflict> conflicts, List<String> recoveryCodes) {
        if (nextCursor == null || nextCursor.isBlank()) {
            throw NotificationDomainException.invalid("nextCursor is required");
        }
        this.status = conflicts == null || conflicts.isEmpty() ? SyncStatus.APPLIED : SyncStatus.CONFLICT;
        this.clientEventId = acceptedClientEventIds == null || acceptedClientEventIds.isEmpty()
                ? "batch" : acceptedClientEventIds.get(0);
        this.clientSeq = parseCursor(nextCursor);
        this.serverVersion = parseCursor(nextCursor);
        this.cursor = null;
        this.conflict = null;
        this.failureState = null;
        this.replayed = false;
        this.traceId = "compatibility";
        this.nextCursor = nextCursor;
        this.acceptedClientEventIds = acceptedClientEventIds == null ? List.of() : List.copyOf(acceptedClientEventIds);
        this.conflicts = conflicts == null ? List.of() : List.copyOf(conflicts);
        this.recoveryCodes = recoveryCodes == null ? List.of() : List.copyOf(recoveryCodes);
    }

    public static OfflineSyncResult applied(OfflineChange change, SyncCursor cursor, String traceId) {
        return new OfflineSyncResult(SyncStatus.APPLIED, change.clientEventId(), change.clientSeq(),
                cursor.serverVersion(), cursor, null, null, false, traceId);
    }

    public static OfflineSyncResult replayed(OfflineChange change, SyncCursor cursor, long serverVersion,
            String traceId) {
        return new OfflineSyncResult(SyncStatus.REPLAYED, change.clientEventId(), change.clientSeq(),
                serverVersion, cursor, null, null, true, traceId);
    }

    public static OfflineSyncResult conflict(OfflineChange change, SyncCursor cursor, SyncConflict conflict,
            String traceId) {
        return new OfflineSyncResult(SyncStatus.CONFLICT, change.clientEventId(), change.clientSeq(),
                cursor.serverVersion(), cursor, conflict, null, false, traceId);
    }

    public static OfflineSyncResult failed(OfflineChange change, SyncCursor cursor,
            SyncFailureState failureState, String traceId) {
        return new OfflineSyncResult(SyncStatus.FAILED, change.clientEventId(), change.clientSeq(),
                cursor.serverVersion(), cursor, null, failureState, false, traceId);
    }

    public SyncStatus status() { return status; }
    public String clientEventId() { return clientEventId; }
    public long clientSeq() { return clientSeq; }
    public long serverVersion() { return serverVersion; }
    public SyncCursor cursor() { return cursor; }
    public SyncConflict conflict() { return conflict; }
    public SyncFailureState failureState() { return failureState; }
    public boolean replayed() { return replayed; }
    public String traceId() { return traceId; }
    public String nextCursor() { return nextCursor; }
    public List<String> acceptedClientEventIds() { return acceptedClientEventIds; }
    public List<OfflineConflict> conflicts() { return conflicts; }
    public List<String> recoveryCodes() { return recoveryCodes; }

    // JavaBean accessors keep HTTP JSON serialization explicit for this non-record aggregate.
    public SyncStatus getStatus() { return status; }
    public String getClientEventId() { return clientEventId; }
    public long getClientSeq() { return clientSeq; }
    public long getServerVersion() { return serverVersion; }
    public SyncCursor getCursor() { return cursor; }
    public SyncConflict getConflict() { return conflict; }
    public SyncFailureState getFailureState() { return failureState; }
    public boolean isReplayed() { return replayed; }
    public String getTraceId() { return traceId; }
    public String getNextCursor() { return nextCursor; }
    public List<String> getAcceptedClientEventIds() { return acceptedClientEventIds; }
    public List<OfflineConflict> getConflicts() { return conflicts; }
    public List<String> getRecoveryCodes() { return recoveryCodes; }

    private static long parseCursor(String value) {
        try {
            return Long.parseLong(value);
        } catch (NumberFormatException exception) {
            throw NotificationDomainException.invalid("cursor is invalid");
        }
    }
}
