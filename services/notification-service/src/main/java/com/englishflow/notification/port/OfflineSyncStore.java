package com.englishflow.notification.port;

import com.englishflow.notification.domain.OfflineChange;
import com.englishflow.notification.domain.OfflineSyncReceipt;
import com.englishflow.notification.domain.NotificationPrincipalContext;
import com.englishflow.notification.domain.SyncCursor;
import com.englishflow.notification.domain.SyncFailureState;

import java.util.Optional;

/**
 * Port for the offline cursor/receipt boundary. The owned table is metadata and
 * dedupe state; source services own the actual learning/content facts.
 */
public interface OfflineSyncStore {

    Optional<OfflineSyncReceipt> findByClientEventId(NotificationPrincipalContext context,
            String clientEventId);

    Optional<OfflineSyncReceipt> findByClientSequence(NotificationPrincipalContext context, long clientSeq);

    SyncCursor cursor(NotificationPrincipalContext context);

    /** Atomically appends a receipt and advances the expected cursor. */
    void accept(NotificationPrincipalContext context, OfflineChange change,
            SyncCursor expectedCursor, OfflineSyncReceipt receipt, SyncCursor nextCursor);

    Optional<SyncFailureState> failureState();
}
