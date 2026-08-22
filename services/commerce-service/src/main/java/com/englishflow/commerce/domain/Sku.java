package com.englishflow.commerce.domain;

import java.time.Instant;

public record Sku(String tenantId, String skuId, int version, String title, String entitlementCode,
        String currency, long amountMinor, SkuStatus status, Instant effectiveFrom) {
    public Sku {
        if (tenantId == null || tenantId.isBlank() || skuId == null || skuId.isBlank() || version < 1) throw CommerceException.bad("SKU_INVALID", "SKU identity is required");
        if (title == null || title.isBlank() || entitlementCode == null || entitlementCode.isBlank()) throw CommerceException.bad("SKU_INVALID", "SKU title and entitlement are required");
        if (currency == null || !currency.matches("[A-Z]{3}") || amountMinor < 0) throw CommerceException.bad("SKU_INVALID", "SKU price is invalid");
        if (status == null || effectiveFrom == null) throw CommerceException.bad("SKU_INVALID", "SKU status/time is required");
    }
    public PriceSnapshot snapshot(Instant capturedAt) {
        return new PriceSnapshot(skuId, version, title, entitlementCode, currency, amountMinor, capturedAt);
    }
}
