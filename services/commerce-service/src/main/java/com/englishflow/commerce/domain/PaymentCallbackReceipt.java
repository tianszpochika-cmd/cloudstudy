package com.englishflow.commerce.domain;

import java.time.Instant;

public record PaymentCallbackReceipt(String tenantId, PaymentProvider provider, String providerEventId,
        String orderId, String payloadHash, long amountMinor, String currency,
        String verificationState, Instant receivedAt) { }
