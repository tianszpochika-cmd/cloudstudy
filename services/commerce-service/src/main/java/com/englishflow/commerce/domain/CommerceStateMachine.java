package com.englishflow.commerce.domain;

import java.util.EnumSet;
import java.util.Map;
import java.util.Set;

/** Explicit transition tables prevent callback/retry code from silently mutating facts. */
public final class CommerceStateMachine {
    private static final Map<OrderStatus, Set<OrderStatus>> ORDER = Map.of(
            OrderStatus.CREATED, EnumSet.of(OrderStatus.PAYMENT_PENDING, OrderStatus.CANCELLED),
            OrderStatus.PAYMENT_PENDING, EnumSet.of(OrderStatus.PAID, OrderStatus.PAYMENT_FAILED, OrderStatus.CANCELLED),
            OrderStatus.PAYMENT_FAILED, EnumSet.of(OrderStatus.PAYMENT_PENDING, OrderStatus.CANCELLED),
            OrderStatus.PAID, EnumSet.of(OrderStatus.REFUND_PENDING),
            OrderStatus.REFUND_PENDING, EnumSet.of(OrderStatus.REFUNDED, OrderStatus.REFUND_FAILED),
            OrderStatus.REFUND_FAILED, EnumSet.of(OrderStatus.REFUND_PENDING, OrderStatus.CANCELLED),
            OrderStatus.CANCELLED, Set.of(),
            OrderStatus.REFUNDED, Set.of());

    private static final Map<PaymentAttemptStatus, Set<PaymentAttemptStatus>> PAYMENT = Map.of(
            PaymentAttemptStatus.DISABLED, EnumSet.of(PaymentAttemptStatus.PENDING, PaymentAttemptStatus.CANCELLED),
            PaymentAttemptStatus.PENDING, EnumSet.of(PaymentAttemptStatus.SUCCEEDED, PaymentAttemptStatus.FAILED, PaymentAttemptStatus.CANCELLED),
            PaymentAttemptStatus.FAILED, EnumSet.of(PaymentAttemptStatus.PENDING, PaymentAttemptStatus.CANCELLED),
            PaymentAttemptStatus.SUCCEEDED, Set.of(),
            PaymentAttemptStatus.CANCELLED, Set.of());

    private static final Map<RefundStatus, Set<RefundStatus>> REFUND = Map.of(
            RefundStatus.REQUESTED, EnumSet.of(RefundStatus.PROCESSING, RefundStatus.CANCELLED, RefundStatus.FAILED),
            RefundStatus.PROCESSING, EnumSet.of(RefundStatus.COMPLETED, RefundStatus.FAILED),
            RefundStatus.FAILED, EnumSet.of(RefundStatus.PROCESSING, RefundStatus.CANCELLED),
            RefundStatus.COMPLETED, Set.of(),
            RefundStatus.CANCELLED, Set.of());

    private static final Map<ActivationCodeStatus, Set<ActivationCodeStatus>> ACTIVATION = Map.of(
            ActivationCodeStatus.AVAILABLE, EnumSet.of(ActivationCodeStatus.REDEEMED,
                    ActivationCodeStatus.EXPIRED, ActivationCodeStatus.REVOKED),
            ActivationCodeStatus.REDEEMED, Set.of(),
            ActivationCodeStatus.EXPIRED, Set.of(),
            ActivationCodeStatus.REVOKED, Set.of());

    private static final Map<ReconciliationStatus, Set<ReconciliationStatus>> RECONCILIATION = Map.of(
            ReconciliationStatus.PENDING, EnumSet.of(ReconciliationStatus.MATCH, ReconciliationStatus.MISMATCH),
            ReconciliationStatus.MISMATCH, EnumSet.of(ReconciliationStatus.REPAIR_PENDING, ReconciliationStatus.RESOLVED),
            ReconciliationStatus.REPAIR_PENDING, EnumSet.of(ReconciliationStatus.RESOLVED),
            ReconciliationStatus.MATCH, Set.of(),
            ReconciliationStatus.RESOLVED, Set.of());

    private static final Map<EntitlementStatus, Set<EntitlementStatus>> ENTITLEMENT = Map.of(
            EntitlementStatus.PENDING, EnumSet.of(EntitlementStatus.ACTIVE, EntitlementStatus.REVOKED),
            EntitlementStatus.ACTIVE, EnumSet.of(EntitlementStatus.GRACE, EntitlementStatus.EXPIRED, EntitlementStatus.REVOKED),
            EntitlementStatus.GRACE, EnumSet.of(EntitlementStatus.ACTIVE, EntitlementStatus.EXPIRED, EntitlementStatus.REVOKED),
            EntitlementStatus.EXPIRED, EnumSet.of(EntitlementStatus.ACTIVE, EntitlementStatus.REVOKED),
            EntitlementStatus.REVOKED, Set.of());

    private CommerceStateMachine() { }

    public static void requireOrderTransition(OrderStatus current, OrderStatus next) {
        require(ORDER, current, next, "ORDER_STATE_INVALID");
    }

    public static void requirePaymentTransition(PaymentAttemptStatus current, PaymentAttemptStatus next) {
        require(PAYMENT, current, next, "PAYMENT_STATE_INVALID");
    }

    public static void requireRefundTransition(RefundStatus current, RefundStatus next) {
        require(REFUND, current, next, "REFUND_STATE_INVALID");
    }

    public static void requireActivationTransition(ActivationCodeStatus current, ActivationCodeStatus next) {
        require(ACTIVATION, current, next, "ACTIVATION_CODE_STATE_INVALID");
    }

    public static void requireReconciliationTransition(ReconciliationStatus current, ReconciliationStatus next) {
        require(RECONCILIATION, current, next, "RECONCILIATION_STATE_INVALID");
    }

    public static void requireEntitlementTransition(EntitlementStatus current, EntitlementStatus next) {
        require(ENTITLEMENT, current, next, "ENTITLEMENT_STATE_INVALID");
    }

    private static <T extends Enum<T>> void require(Map<T, Set<T>> transitions, T current, T next, String code) {
        if (current == next || !transitions.getOrDefault(current, Set.of()).contains(next)) {
            throw CommerceException.conflict(code, "illegal transition " + current + " -> " + next);
        }
    }
}
