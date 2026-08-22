package com.englishflow.commerce.domain;

import java.util.Set;

/** Explicit release gate. Real provider traffic is impossible unless both flags are opened. */
public record PaymentGate(boolean enabled, String environment, boolean realProvidersEnabled,
        Set<PaymentProvider> enabledProviders) {
    public PaymentGate {
        environment = environment == null || environment.isBlank() ? "DISABLED" : environment;
        enabledProviders = enabledProviders == null ? Set.of() : Set.copyOf(enabledProviders);
    }

    public static PaymentGate disabled() {
        return new PaymentGate(false, "DISABLED", false, Set.of());
    }

    public static PaymentGate sandbox() {
        return new PaymentGate(true, "SANDBOX", false, Set.of(PaymentProvider.SANDBOX));
    }

    public boolean allows(PaymentProvider provider) {
        return enabled && enabledProviders.contains(provider)
                && (provider == PaymentProvider.SANDBOX || realProvidersEnabled);
    }

    public String reason(PaymentProvider provider) {
        if (!enabled) return "PAYMENT_GATE_CLOSED";
        if (!enabledProviders.contains(provider)) return "PAYMENT_PROVIDER_NOT_ENABLED";
        if (provider != PaymentProvider.SANDBOX && !realProvidersEnabled) return "REAL_PAYMENT_DISABLED";
        return "READY";
    }
}
