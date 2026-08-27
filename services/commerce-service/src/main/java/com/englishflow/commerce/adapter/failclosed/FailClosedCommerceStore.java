package com.englishflow.commerce.adapter.failclosed;

import com.englishflow.commerce.application.ports.CommerceStore;
import com.englishflow.commerce.domain.ActivationCode;
import com.englishflow.commerce.domain.CommerceException;
import com.englishflow.commerce.domain.Entitlement;
import com.englishflow.commerce.domain.Order;
import com.englishflow.commerce.domain.PaymentAttempt;
import com.englishflow.commerce.domain.PaymentCallbackReceipt;
import com.englishflow.commerce.domain.Refund;
import com.englishflow.commerce.domain.RefundCallbackReceipt;
import com.englishflow.commerce.domain.Sku;
import java.util.List;
import java.util.Optional;

/**
 * Explicit local-real boundary used when a durable commerce adapter is not selected.
 * Returning an empty result here would make missing persistence look like valid business state.
 */
public final class FailClosedCommerceStore implements CommerceStore {
    private final String reason;

    public FailClosedCommerceStore(String reason) {
        this.reason = reason == null || reason.isBlank() ? "durable commerce persistence is unavailable" : reason;
    }

    @Override public Optional<Sku> findSku(String tenantId, String skuId) { return fail(); }
    @Override public void saveSku(Sku sku) { failVoid(); }
    @Override public List<Sku> listSkus(String tenantId) { return fail(); }
    @Override public Optional<Order> findOrder(String tenantId, String orderId) { return fail(); }
    @Override public Optional<Order> findOrderById(String orderId) { return fail(); }
    @Override public void saveOrder(Order order) { failVoid(); }
    @Override public List<Order> listOrders(String tenantId, String subjectId) { return fail(); }
    @Override public Optional<PaymentAttempt> findPaymentAttempt(String tenantId, String attemptId) { return fail(); }
    @Override public List<PaymentAttempt> listPaymentAttempts(String tenantId, String orderId) { return fail(); }
    @Override public void savePaymentAttempt(PaymentAttempt attempt) { failVoid(); }
    @Override public Optional<PaymentCallbackReceipt> findPaymentCallback(String tenantId, String provider, String providerEventId) { return fail(); }
    @Override public void savePaymentCallback(PaymentCallbackReceipt receipt) { failVoid(); }
    @Override public List<Entitlement> listEntitlements(String tenantId, String subjectId) { return fail(); }
    @Override public Optional<Entitlement> findEntitlementBySource(String tenantId, String subjectId, String sourceType, String sourceRef) { return fail(); }
    @Override public void saveEntitlement(Entitlement entitlement) { failVoid(); }
    @Override public Optional<ActivationCode> findActivationCode(String tenantId, String codeHash) { return fail(); }
    @Override public void saveActivationCode(ActivationCode code) { failVoid(); }
    @Override public Optional<Refund> findRefund(String tenantId, String refundId) { return fail(); }
    @Override public Optional<Refund> findRefundById(String refundId) { return fail(); }
    @Override public List<Refund> listRefunds(String tenantId, String orderId) { return fail(); }
    @Override public void saveRefund(Refund refund) { failVoid(); }
    @Override public Optional<RefundCallbackReceipt> findRefundCallback(String tenantId, String provider, String providerEventId) { return fail(); }
    @Override public void saveRefundCallback(RefundCallbackReceipt receipt) { failVoid(); }

    private <T> T fail() {
        throw CommerceException.unavailable("COMMERCE_PERSISTENCE_REQUIRED", reason);
    }

    private void failVoid() { fail(); }
}
