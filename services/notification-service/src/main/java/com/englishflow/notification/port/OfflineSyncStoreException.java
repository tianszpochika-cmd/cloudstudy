package com.englishflow.notification.port;

import com.englishflow.notification.domain.SyncFailureState;

/** Infrastructure failure translated into an explicit offline recovery state. */
public final class OfflineSyncStoreException extends RuntimeException {

    private final SyncFailureState failureState;

    public OfflineSyncStoreException(SyncFailureState failureState) {
        super("offline sync store is temporarily unavailable: " + failureState);
        this.failureState = failureState;
    }

    public SyncFailureState failureState() {
        return failureState;
    }
}
