package com.englishflow.commerce.application.ports;

import com.englishflow.commerce.domain.PaymentProvider;

public interface PaymentSignatureVerifier {
    boolean verify(PaymentProvider provider, String payload, String signature);
    String payloadHash(String payload);
}
