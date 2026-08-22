package com.englishflow.commerce.domain;

import java.time.Instant;

public record PriceSnapshot(String skuId, int skuVersion, String title, String entitlementCode,
        String currency, long amountMinor, Instant capturedAt) {
    public PriceSnapshot {
        if (skuId == null || skuId.isBlank() || skuVersion < 1 || title == null || title.isBlank()
                || entitlementCode == null || entitlementCode.isBlank()) throw CommerceException.bad("SNAPSHOT_INVALID", "price snapshot identity is required");
        if (currency == null || !currency.matches("[A-Z]{3}")) throw CommerceException.bad("CURRENCY_INVALID", "currency must be ISO-4217 uppercase");
        if (amountMinor < 0 || capturedAt == null) throw CommerceException.bad("SNAPSHOT_INVALID", "price snapshot amount/time is invalid");
    }
}
