package com.englishflow.commerce.domain;

import java.time.Instant;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

/** Order / payment / refund / activation / reconciliation / entitlement state machines. */
class CommerceStateMachineTest {

    @Test
    void orderLegalTransitionsSucceed() {
        CommerceStateMachine.requireOrderTransition(OrderStatus.CREATED, OrderStatus.PAYMENT_PENDING);
        CommerceStateMachine.requireOrderTransition(OrderStatus.PAYMENT_PENDING, OrderStatus.PAID);
        CommerceStateMachine.requireOrderTransition(OrderStatus.PAID, OrderStatus.REFUND_PENDING);
        CommerceStateMachine.requireOrderTransition(OrderStatus.REFUND_PENDING, OrderStatus.REFUNDED);
        CommerceStateMachine.requireOrderTransition(OrderStatus.CREATED, OrderStatus.CANCELLED);
        CommerceStateMachine.requireOrderTransition(OrderStatus.PAYMENT_FAILED, OrderStatus.PAYMENT_PENDING);
    }

    @Test
    void orderIllegalTransitionThrows() {
        CommerceException ex = assertThrows(CommerceException.class,
                () -> CommerceStateMachine.requireOrderTransition(OrderStatus.CREATED, OrderStatus.PAID));
        assertEquals("ORDER_STATE_INVALID", ex.code());
    }

    @Test
    void terminalOrderStateRejectsAllTransitions() {
        CommerceException ex = assertThrows(CommerceException.class,
                () -> CommerceStateMachine.requireOrderTransition(OrderStatus.REFUNDED, OrderStatus.CREATED));
        assertEquals("ORDER_STATE_INVALID", ex.code());

        CommerceException cancelled = assertThrows(CommerceException.class,
                () -> CommerceStateMachine.requireOrderTransition(OrderStatus.CANCELLED, OrderStatus.PAID));
        assertEquals("ORDER_STATE_INVALID", cancelled.code());
    }

    @Test
    void sameStateIsRejected() {
        CommerceException ex = assertThrows(CommerceException.class,
                () -> CommerceStateMachine.requireOrderTransition(OrderStatus.PAID, OrderStatus.PAID));
        assertEquals("ORDER_STATE_INVALID", ex.code());
    }

    @Test
    void paymentAttemptStateMachineEnforced() {
        CommerceStateMachine.requirePaymentTransition(PaymentAttemptStatus.PENDING, PaymentAttemptStatus.SUCCEEDED);
        CommerceException ex = assertThrows(CommerceException.class,
                () -> CommerceStateMachine.requirePaymentTransition(PaymentAttemptStatus.DISABLED, PaymentAttemptStatus.SUCCEEDED));
        assertEquals("PAYMENT_STATE_INVALID", ex.code());
    }

    @Test
    void refundStateMachineEnforced() {
        CommerceStateMachine.requireRefundTransition(RefundStatus.REQUESTED, RefundStatus.PROCESSING);
        CommerceStateMachine.requireRefundTransition(RefundStatus.PROCESSING, RefundStatus.COMPLETED);
        CommerceException ex = assertThrows(CommerceException.class,
                () -> CommerceStateMachine.requireRefundTransition(RefundStatus.REQUESTED, RefundStatus.COMPLETED));
        assertEquals("REFUND_STATE_INVALID", ex.code());
    }

    @Test
    void activationCodeStateMachineEnforced() {
        CommerceStateMachine.requireActivationTransition(ActivationCodeStatus.AVAILABLE, ActivationCodeStatus.REDEEMED);
        CommerceException ex = assertThrows(CommerceException.class,
                () -> CommerceStateMachine.requireActivationTransition(ActivationCodeStatus.REDEEMED, ActivationCodeStatus.AVAILABLE));
        assertEquals("ACTIVATION_CODE_STATE_INVALID", ex.code());
    }

    @Test
    void reconciliationStateMachineEnforced() {
        CommerceStateMachine.requireReconciliationTransition(ReconciliationStatus.PENDING, ReconciliationStatus.MATCH);
        CommerceException ex = assertThrows(CommerceException.class,
                () -> CommerceStateMachine.requireReconciliationTransition(ReconciliationStatus.MATCH, ReconciliationStatus.MISMATCH));
        assertEquals("RECONCILIATION_STATE_INVALID", ex.code());
    }

    @Test
    void entitlementStateMachineEnforced() {
        CommerceStateMachine.requireEntitlementTransition(EntitlementStatus.PENDING, EntitlementStatus.ACTIVE);
        CommerceStateMachine.requireEntitlementTransition(EntitlementStatus.ACTIVE, EntitlementStatus.GRACE);
        CommerceException ex = assertThrows(CommerceException.class,
                () -> CommerceStateMachine.requireEntitlementTransition(EntitlementStatus.REVOKED, EntitlementStatus.ACTIVE));
        assertEquals("ENTITLEMENT_STATE_INVALID", ex.code());
    }

    @Test
    void orderRecordTransitionAppliesStateMachine() {
        Instant now = Instant.parse("2026-01-01T00:00:00Z");
        Order order = new Order("t", "o", "s",
                new PriceSnapshot("sku", 1, "Title", "CODE", "CNY", 9900, now),
                OrderStatus.CREATED, null, now, now, null);
        Order pending = order.transition(OrderStatus.PAYMENT_PENDING, now);
        assertEquals(OrderStatus.PAYMENT_PENDING, pending.status());
        Order paid = pending.transition(OrderStatus.PAID, now);
        assertEquals(OrderStatus.PAID, paid.status());
        assertEquals(now, paid.paidAt());
    }

    @Test
    void orderRecordTransitionRejectsIllegalMove() {
        Instant now = Instant.parse("2026-01-01T00:00:00Z");
        Order order = new Order("t", "o", "s",
                new PriceSnapshot("sku", 1, "Title", "CODE", "CNY", 9900, now),
                OrderStatus.CREATED, null, now, now, null);
        assertThrows(CommerceException.class, () -> order.transition(OrderStatus.PAID, now));
    }

    @Test
    void entitlementRecordTransitionEnforced() {
        Entitlement entitlement = sampleEntitlement(EntitlementStatus.ACTIVE);
        Entitlement grace = entitlement.transition(EntitlementStatus.GRACE, "DOWNGRADE", Instant.parse("2026-01-02T00:00:00Z"));
        assertEquals(EntitlementStatus.GRACE, grace.status());
        assertEquals("DOWNGRADE", grace.reasonCode());
    }

    @Test
    void activationCodeRedeemAndExpire() {
        Instant now = Instant.parse("2026-01-01T00:00:00Z");
        ActivationCode code = new ActivationCode("t", codeHash(), "sku", snapshot(), ActivationCodeStatus.AVAILABLE, now.plusSeconds(3600), null, null);
        ActivationCode redeemed = code.redeem("subject", now);
        assertEquals(ActivationCodeStatus.REDEEMED, redeemed.status());

        ActivationCode expired = code.expire(now.plusSeconds(7200));
        assertEquals(ActivationCodeStatus.EXPIRED, expired.status());
    }

    @Test
    void activationCodeRedeemAfterExpiryFails() {
        Instant now = Instant.parse("2026-01-01T00:00:00Z");
        ActivationCode code = new ActivationCode("t", codeHash(), "sku", snapshot(), ActivationCodeStatus.AVAILABLE, now.minusSeconds(1), null, null);
        assertThrows(CommerceException.class, () -> code.redeem("subject", now));
    }

    private static String codeHash() {
        try {
            java.security.MessageDigest md = java.security.MessageDigest.getInstance("SHA-256");
            return java.util.HexFormat.of().formatHex(md.digest("secret-code".getBytes(java.nio.charset.StandardCharsets.UTF_8)));
        } catch (Exception exception) {
            throw new IllegalStateException(exception);
        }
    }

    private static PriceSnapshot snapshot() {
        return new PriceSnapshot("sku", 1, "Title", "CODE", "CNY", 9900, Instant.parse("2026-01-01T00:00:00Z"));
    }

    private static Entitlement sampleEntitlement(EntitlementStatus status) {
        Instant now = Instant.parse("2026-01-01T00:00:00Z");
        return new Entitlement("t", "e", "s", "sku", "CODE", "ORDER", "o", snapshot(), status, now, null, "");
    }
}
