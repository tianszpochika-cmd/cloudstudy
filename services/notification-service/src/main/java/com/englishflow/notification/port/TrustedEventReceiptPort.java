package com.englishflow.notification.port;

import com.englishflow.notification.domain.TrustedEventReceipt;

/** Atomic service-owned consumer receipt boundary for event id and dedupe key. */
public interface TrustedEventReceiptPort {

    ReceiptClaim claim(TrustedEventReceipt candidate);

    void save(TrustedEventReceipt receipt);

    record ReceiptClaim(boolean created, TrustedEventReceipt existing) {
        public ReceiptClaim {
            if (created == (existing != null)) {
                throw new IllegalArgumentException("receipt claim must be created or existing");
            }
        }

        public static ReceiptClaim newClaim() {
            return new ReceiptClaim(true, null);
        }

        public static ReceiptClaim existingClaim(TrustedEventReceipt receipt) {
            return new ReceiptClaim(false, receipt);
        }
    }
}
