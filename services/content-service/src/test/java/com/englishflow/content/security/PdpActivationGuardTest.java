package com.englishflow.content.security;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;

class PdpActivationGuardTest {

    @Test
    void dynamicFactsWithoutAProvisionedPdpRefuseToStart() {
        assertThrows(IllegalStateException.class,
                () -> PdpActivationGuard.requireProvisioned(true, new UnavailablePdpPort()));
        assertThrows(IllegalStateException.class,
                () -> PdpActivationGuard.requireProvisioned(true, null));
    }

    @Test
    void provisionedPdpOrNonDynamicServiceStarts() {
        PdpPort provisioned = (request, timeout) -> PdpDecision.denied("denied");
        assertDoesNotThrow(() -> PdpActivationGuard.requireProvisioned(true, provisioned));
        assertDoesNotThrow(() -> PdpActivationGuard.requireProvisioned(false, new UnavailablePdpPort()));
    }
}
