package com.englishflow.commerce.domain;

import java.time.Instant;

public record Order(String tenantId, String orderId, String subjectId, PriceSnapshot priceSnapshot,
        OrderStatus status, PaymentProvider provider, Instant createdAt, Instant updatedAt, Instant paidAt) {
    public Order {
        if (tenantId == null || tenantId.isBlank() || orderId == null || orderId.isBlank() || subjectId == null || subjectId.isBlank() || priceSnapshot == null || status == null || createdAt == null || updatedAt == null) throw CommerceException.bad("ORDER_INVALID", "order fields are incomplete");
    }
    public Order transition(OrderStatus next, Instant at) {
        CommerceStateMachine.requireOrderTransition(status, next);
        return new Order(tenantId, orderId, subjectId, priceSnapshot, next, provider, createdAt, at, next == OrderStatus.PAID ? at : paidAt);
    }
    public Order withProvider(PaymentProvider next, Instant at) { return new Order(tenantId, orderId, subjectId, priceSnapshot, status, next, createdAt, at, paidAt); }
}
