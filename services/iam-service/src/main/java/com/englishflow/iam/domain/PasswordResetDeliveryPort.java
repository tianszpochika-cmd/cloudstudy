package com.englishflow.iam.domain;

/**
 * Out-of-band password-reset delivery handoff. IAM owns the one-time challenge; a provisioned
 * adapter owns transport. Reliable retries and provider receipts belong to the later
 * Outbox/notification work, so this port deliberately claims no delivery guarantee.
 */
public interface PasswordResetDeliveryPort {

    /** Whether a deployment-provisioned transport is wired for this process. */
    boolean provisioned();

    /** Hands the one-time token to the transport. Must not log or persist raw token material. */
    void deliver(PasswordResetDelivery delivery);
}
