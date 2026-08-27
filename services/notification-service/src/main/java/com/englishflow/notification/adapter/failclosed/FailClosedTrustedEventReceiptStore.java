package com.englishflow.notification.adapter.failclosed;

import com.englishflow.notification.domain.NotificationDomainException;
import com.englishflow.notification.domain.TrustedEventReceipt;
import com.englishflow.notification.port.TrustedEventReceiptPort;

/** Trusted event dedupe cannot proceed without a durable receipt ledger. */
public final class FailClosedTrustedEventReceiptStore implements TrustedEventReceiptPort {

    @Override
    public ReceiptClaim claim(TrustedEventReceipt candidate) {
        throw unavailable();
    }

    @Override
    public void save(TrustedEventReceipt receipt) {
        throw unavailable();
    }

    private static NotificationDomainException unavailable() {
        return new NotificationDomainException(NotificationDomainException.Code.NETWORK_UNAVAILABLE,
                "notification trusted-event persistence is not configured");
    }
}
