package com.englishflow.commerce;

import com.englishflow.commerce.adapter.memory.SandboxPaymentProvider;
import com.englishflow.commerce.application.CommerceApplicationService;
import com.englishflow.commerce.application.CommerceCommands;
import com.englishflow.commerce.application.CommerceCommands.CreateOrder;
import com.englishflow.commerce.application.CommerceCommands.StartPayment;
import com.englishflow.commerce.domain.CommerceException;
import com.englishflow.commerce.domain.CommerceViews.PaymentCallbackView;
import com.englishflow.commerce.domain.OrderStatus;
import com.englishflow.commerce.domain.PaymentGate;
import com.englishflow.commerce.domain.PaymentProvider;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** Idempotency and deduplication of payment callbacks (same provider event delivered more than once). */
class PaymentCallbackDeduplicationTest {
    private final CommerceTestFixtures.Bundle bundle = new CommerceTestFixtures.Bundle(PaymentGate.sandbox());
    private final CommerceApplicationService service = bundle.service;

    private String paidOrderKey() {
        bundle.seedCatalog();
        String orderId = bundle.openOrder("order-key", "pay-key");
        service.receivePaymentCallback(CommerceTestFixtures.paymentCallback(bundle.sandbox, orderId, "evt-paid", 9900, "SUCCESS"));
        return orderId;
    }

    @Test
    void duplicateEventIdProcessesSettlementOnce() {
        bundle.seedCatalog();
        String orderId = bundle.openOrder("order-key-dup", "pay-key-dup");

        PaymentCallbackView first = service.receivePaymentCallback(
                CommerceTestFixtures.paymentCallback(bundle.sandbox, orderId, "evt-dup", 9900, "SUCCESS"));
        assertEquals("APPLIED", first.state());
        assertEquals(OrderStatus.PAID, first.orderStatus());
        assertEquals(1, service.listEntitlements(CommerceTestFixtures.user()).size());

        PaymentCallbackView second = service.receivePaymentCallback(
                CommerceTestFixtures.paymentCallback(bundle.sandbox, orderId, "evt-dup", 9900, "SUCCESS"));
        assertTrue(second.replayed());
        assertEquals("DUPLICATE", second.state());
        // No second entitlement was minted on the replay.
        assertEquals(1, service.listEntitlements(CommerceTestFixtures.user()).size());
    }

    @Test
    void reboundEventWithDifferentPayloadConflicts() {
        bundle.seedCatalog();
        String orderId = bundle.openOrder("order-key-rebound", "pay-key-rebound");

        service.receivePaymentCallback(CommerceTestFixtures.paymentCallback(bundle.sandbox, orderId, "evt-r", 9900, "SUCCESS"));

        CommerceException ex = assertThrows(CommerceException.class, () ->
                service.receivePaymentCallback(CommerceTestFixtures.paymentCallback(bundle.sandbox, orderId, "evt-r", 9800, "SUCCESS")));
        assertEquals("PAYMENT_CALLBACK_REPLAY_CONFLICT", ex.code());
    }

    @Test
    void gateRejectedCallbackRetriesAfterGateOpens() {
        CommerceTestFixtures.Bundle closed = new CommerceTestFixtures.Bundle(PaymentGate.disabled());
        closed.seedCatalog();
        String orderId = closed.openOrder("order-key-gate", "pay-key-gate");

        PaymentCallbackView rejected = closed.service.receivePaymentCallback(
                CommerceTestFixtures.paymentCallback(closed.sandbox, orderId, "evt-gate", 9900, "SUCCESS"));
        assertEquals("GATE_REJECTED", rejected.state());
        assertEquals(0, closed.service.listEntitlements(CommerceTestFixtures.user()).size());

        // Open the gate on the same durable store and retry the exact same provider event.
        CommerceApplicationService opened = CommerceTestFixtures.reopen(closed, PaymentGate.sandbox());
        opened.startPayment(CommerceTestFixtures.user(), new StartPayment(orderId, PaymentProvider.SANDBOX), "pay-key-gate-retry");

        PaymentCallbackView retried = opened.receivePaymentCallback(
                CommerceTestFixtures.paymentCallback(closed.sandbox, orderId, "evt-gate", 9900, "SUCCESS"));
        assertEquals("APPLIED", retried.state());
        assertEquals(OrderStatus.PAID, retried.orderStatus());
        assertEquals(1, opened.listEntitlements(CommerceTestFixtures.user()).size());
    }

    @Test
    void closedGateRejectsRealProviderWithoutAdapter() {
        CommerceTestFixtures.Bundle closed = new CommerceTestFixtures.Bundle(PaymentGate.disabled());
        closed.seedCatalog();
        String orderId = closed.openOrder("order-key-real", "pay-key-real");

        CommerceCommands.PaymentCallback real = new CommerceCommands.PaymentCallback(
                "evt-real", orderId, PaymentProvider.WECHAT, 9900, "CNY", "payload", "unverified", "SUCCESS");
        PaymentCallbackView rejected = closed.service.receivePaymentCallback(real);
        assertEquals("GATE_REJECTED", rejected.state());
        assertEquals(OrderStatus.CREATED, rejected.orderStatus());
        assertEquals(0, closed.service.listEntitlements(CommerceTestFixtures.user()).size());
    }
}
