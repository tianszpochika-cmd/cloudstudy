package com.englishflow.iam.domain;

/**
 * Fail-closed handoff used outside local/test until a real transport is provisioned. The request
 * endpoint still returns its uniform accepted result so the missing transport cannot become an
 * account-enumeration signal; the denied handoff is recorded in audit instead.
 */
public final class UnprovisionedPasswordResetDelivery implements PasswordResetDeliveryPort {

    @Override
    public boolean provisioned() {
        return false;
    }

    @Override
    public void deliver(PasswordResetDelivery delivery) {
        throw new IllegalStateException("password reset delivery transport is not provisioned");
    }
}
