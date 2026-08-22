package com.englishflow.notification.adapter.memory;

import com.englishflow.notification.domain.NotificationChannel;
import com.englishflow.notification.domain.NotificationMessage;
import com.englishflow.notification.port.DeliveryTransport;

/** Deterministic local channel adapter; it never logs message text. */
public final class InMemoryDeliveryTransport implements DeliveryTransport {

    private String nextFailureCode;
    private DeliveryTransport.FailureDisposition nextFailureDisposition;

    @Override
    public synchronized DeliveryOutcome deliver(NotificationMessage message, NotificationChannel channel) {
        if (nextFailureCode != null) {
            String failure = nextFailureCode;
            DeliveryTransport.FailureDisposition disposition = nextFailureDisposition;
            nextFailureCode = null;
            nextFailureDisposition = null;
            return new DeliveryOutcome(false, failure, disposition);
        }
        return DeliveryOutcome.success();
    }

    public synchronized void failNext(String failureCode) {
        if (failureCode == null || failureCode.isBlank()) {
            throw new IllegalArgumentException("failure code is required");
        }
        nextFailureCode = failureCode;
        nextFailureDisposition = DeliveryTransport.FailureDisposition.RETRYABLE;
    }

    public synchronized void failNextTerminal(String failureCode) {
        if (failureCode == null || failureCode.isBlank()) {
            throw new IllegalArgumentException("failure code is required");
        }
        nextFailureCode = failureCode;
        nextFailureDisposition = DeliveryTransport.FailureDisposition.TERMINAL;
    }
}
