package com.englishflow.commerce.domain;

import java.time.Instant;

public record RefundCallbackReceipt(String tenantId, PaymentProvider provider, String providerEventId,
        String refundId, String payloadHash, long amountMinor, String currency,
        String verificationState, Instant receivedAt) { }
