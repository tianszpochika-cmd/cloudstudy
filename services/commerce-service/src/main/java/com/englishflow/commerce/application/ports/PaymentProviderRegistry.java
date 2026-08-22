package com.englishflow.commerce.application.ports;

import com.englishflow.commerce.domain.CommerceException;
import com.englishflow.commerce.domain.PaymentProvider;
import java.util.Map;
import java.util.Optional;

public final class PaymentProviderRegistry {
    private final Map<PaymentProvider, PaymentProviderPort> providers;

    public PaymentProviderRegistry(Iterable<PaymentProviderPort> ports) {
        Map<PaymentProvider, PaymentProviderPort> values = new java.util.EnumMap<>(PaymentProvider.class);
        for (PaymentProviderPort port : ports) {
            if (port == null || port.provider() == null) throw CommerceException.bad("PAYMENT_PROVIDER_INVALID", "provider port is incomplete");
            values.put(port.provider(), port);
        }
        this.providers = Map.copyOf(values);
    }

    public PaymentProviderPort require(PaymentProvider provider) {
        PaymentProviderPort port = providers.get(provider);
        if (port == null) throw CommerceException.unavailable("PAYMENT_PROVIDER_UNAVAILABLE", "provider adapter is not configured");
        return port;
    }

    public Optional<PaymentProviderPort> find(PaymentProvider provider) {
        return Optional.ofNullable(providers.get(provider));
    }
}
