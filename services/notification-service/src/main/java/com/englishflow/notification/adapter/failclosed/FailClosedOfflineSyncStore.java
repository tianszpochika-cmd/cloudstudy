package com.englishflow.notification.adapter.failclosed;

import com.englishflow.notification.domain.OfflineChange;
import com.englishflow.notification.domain.OfflineSyncReceipt;
import com.englishflow.notification.domain.NotificationDomainException;
import com.englishflow.notification.domain.NotificationPrincipalContext;
import com.englishflow.notification.domain.SyncCursor;
import com.englishflow.notification.domain.SyncFailureState;
import com.englishflow.notification.port.OfflineSyncStore;

import java.util.Optional;

/** Offline state is not represented as durable until its owner adapter is configured. */
public final class FailClosedOfflineSyncStore implements OfflineSyncStore {

    @Override
    public Optional<OfflineSyncReceipt> findByClientEventId(NotificationPrincipalContext context,
            String clientEventId) {
        throw unavailable();
    }

    @Override
    public Optional<OfflineSyncReceipt> findByClientSequence(NotificationPrincipalContext context, long clientSeq) {
        throw unavailable();
    }

    @Override
    public SyncCursor cursor(NotificationPrincipalContext context) {
        throw unavailable();
    }

    @Override
    public void accept(NotificationPrincipalContext context, OfflineChange change, SyncCursor expectedCursor,
            OfflineSyncReceipt receipt, SyncCursor nextCursor) {
        throw unavailable();
    }

    @Override
    public Optional<SyncFailureState> failureState() {
        throw unavailable();
    }

    private static NotificationDomainException unavailable() {
        return new NotificationDomainException(NotificationDomainException.Code.NETWORK_UNAVAILABLE,
                "notification offline-sync persistence is not configured");
    }
}
