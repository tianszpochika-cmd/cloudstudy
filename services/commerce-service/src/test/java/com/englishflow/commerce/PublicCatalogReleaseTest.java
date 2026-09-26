package com.englishflow.commerce;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.englishflow.commerce.domain.PaymentGate;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.Test;

class PublicCatalogReleaseTest {
    @Test
    void activeSkuRequiresExplicitPublicationAndOpenPaymentGate() {
        var bundle = new CommerceTestFixtures.Bundle(PaymentGate.disabled());
        bundle.seedCatalog();

        assertEquals(0, plans(bundle.service.publicCatalog(CommerceTestFixtures.TENANT_A,
                Set.of(CommerceTestFixtures.SKU))).size());

        var sandbox = CommerceTestFixtures.reopen(bundle, PaymentGate.sandbox());
        assertEquals(0, plans(sandbox.publicCatalog(CommerceTestFixtures.TENANT_A, Set.of())).size());
        var released = sandbox.publicCatalog(CommerceTestFixtures.TENANT_A, Set.of(CommerceTestFixtures.SKU));
        assertEquals(1, plans(released).size());
        assertEquals("COMING_SOON", plans(released).getFirst().get("availability"));
        assertEquals("PERPETUAL", plans(released).getFirst().get("billingPeriod"));
        assertEquals(false, released.get("productionPaymentEnabled"));
        assertEquals(0, plans(sandbox.publicCatalog(CommerceTestFixtures.TENANT_B,
                Set.of(CommerceTestFixtures.SKU))).size());
    }

    @SuppressWarnings("unchecked")
    private static List<Map<String, Object>> plans(Map<String, Object> catalog) {
        return (List<Map<String, Object>>) catalog.get("plans");
    }
}
