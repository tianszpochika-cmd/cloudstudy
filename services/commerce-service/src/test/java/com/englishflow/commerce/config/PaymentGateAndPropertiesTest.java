package com.englishflow.commerce.config;

import com.englishflow.commerce.domain.PaymentGate;
import com.englishflow.commerce.domain.PaymentProvider;
import java.util.Set;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** Production payment switch must default to OFF; nothing is released by accident. */
class PaymentGateAndPropertiesTest {

    @Test
    void paymentDefaultsToDisabledAndDisabledEnvironment() {
        CommerceProperties props = new CommerceProperties(null, null, null);
        assertFalse(props.payment().enabled());
        assertEquals("DISABLED", props.payment().environment());
        assertFalse(props.payment().realProvidersEnabled());
        assertEquals("change-me-in-test-only", props.payment().sandboxSecret());
    }

    @Test
    void securityDefaultsToResourceServerDisabled() {
        CommerceProperties props = new CommerceProperties(null, null, null);
        assertFalse(props.security().resourceServerEnabled());
    }

    @Test
    void publicTenantIdDefaultsToPlatform() {
        CommerceProperties props = new CommerceProperties(null, null, null);
        assertEquals("platform", props.publicTenantId());
    }

    @Test
    void paymentWithExplicitEnabledFalseStaysClosed() {
        CommerceProperties props = new CommerceProperties(null,
                new CommerceProperties.Payment(false, "DISABLED", false, "secret"), null);
        assertFalse(props.payment().enabled());
    }

    @Test
    void disabledGateAllowsNothing() {
        PaymentGate gate = PaymentGate.disabled();
        assertFalse(gate.allows(PaymentProvider.SANDBOX));
        assertFalse(gate.allows(PaymentProvider.WECHAT));
        assertEquals("PAYMENT_GATE_CLOSED", gate.reason(PaymentProvider.SANDBOX));
    }

    @Test
    void sandboxGateAllowsOnlySandboxProvider() {
        PaymentGate gate = PaymentGate.sandbox();
        assertTrue(gate.allows(PaymentProvider.SANDBOX));
        assertFalse(gate.allows(PaymentProvider.WECHAT));
        assertEquals("PAYMENT_PROVIDER_NOT_ENABLED", gate.reason(PaymentProvider.WECHAT));
    }

    @Test
    void realProviderBlockedWhileRealDisabled() {
        PaymentGate gate = new PaymentGate(true, "PRODUCTION", false, Set.of(PaymentProvider.WECHAT));
        assertFalse(gate.allows(PaymentProvider.WECHAT));
        assertEquals("REAL_PAYMENT_DISABLED", gate.reason(PaymentProvider.WECHAT));
    }

    @Test
    void realProviderAllowedWhenRealEnabled() {
        PaymentGate gate = new PaymentGate(true, "PRODUCTION", true, Set.of(PaymentProvider.WECHAT));
        assertTrue(gate.allows(PaymentProvider.WECHAT));
        assertEquals("READY", gate.reason(PaymentProvider.WECHAT));
    }

    @Test
    void readinessReflectsClosedGate() {
        CommerceProperties props = new CommerceProperties(null, null, null);
        PaymentGate gate = new PaymentGate(props.payment().enabled(), props.payment().environment(),
                props.payment().realProvidersEnabled(), Set.of());
        assertFalse(gate.allows(PaymentProvider.SANDBOX));
        assertFalse(gate.allows(PaymentProvider.WECHAT));
    }
}
