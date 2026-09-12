package com.englishflow.learning.security;

/**
 * Startup guard for services that activate flows depending on dynamic policy facts: without a
 * provisioned PDP the process must not start, so a missing policy source can never be silently
 * treated as an allow.
 */
public final class PdpActivationGuard {

    private PdpActivationGuard() {
    }

    public static void requireProvisioned(boolean dynamicFactsRequired, PdpPort pdp) {
        if (!dynamicFactsRequired) {
            return;
        }
        if (pdp == null || pdp instanceof UnavailablePdpPort) {
            throw new IllegalStateException(
                    "dynamic policy facts are required but no PDP is provisioned; refusing to start");
        }
    }
}
