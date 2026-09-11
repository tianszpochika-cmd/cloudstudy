package com.englishflow.iam.domain;

import java.util.List;
import java.util.Queue;
import java.util.concurrent.ConcurrentLinkedQueue;

/**
 * Explicit local/test delivery sink. It exists so local onboarding and tests can read the
 * one-time token; it is not delivery evidence and must never be selected outside an explicit
 * local/test profile.
 */
public final class InMemoryPasswordResetDelivery implements PasswordResetDeliveryPort {

    private final Queue<PasswordResetDelivery> deliveries = new ConcurrentLinkedQueue<>();

    @Override
    public boolean provisioned() {
        return true;
    }

    @Override
    public void deliver(PasswordResetDelivery delivery) {
        deliveries.add(delivery);
    }

    public List<PasswordResetDelivery> deliveries() {
        return List.copyOf(deliveries);
    }

    public int deliveredCount() {
        return deliveries.size();
    }
}
