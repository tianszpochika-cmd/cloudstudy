package com.englishflow.commerce.application.ports;

import com.englishflow.commerce.domain.ActivationCode;
import com.englishflow.commerce.domain.Entitlement;
import com.englishflow.commerce.domain.Order;
import com.englishflow.commerce.domain.PaymentAttempt;
import com.englishflow.commerce.domain.PaymentCallbackReceipt;
import com.englishflow.commerce.domain.Refund;
import com.englishflow.commerce.domain.RefundCallbackReceipt;
import com.englishflow.commerce.domain.Sku;
import java.util.List;
import java.util.Optional;

/** Persistence boundary. The production adapter owns the commerce schema only. */
public interface CommerceStore {
    Optional<Sku> findSku(String tenantId, String skuId);
    void saveSku(Sku sku);
    List<Sku> listSkus(String tenantId);

    Optional<Order> findOrder(String tenantId, String orderId);
    Optional<Order> findOrderById(String orderId);
    void saveOrder(Order order);
    List<Order> listOrders(String tenantId, String subjectId);

    Optional<PaymentAttempt> findPaymentAttempt(String tenantId, String attemptId);
    List<PaymentAttempt> listPaymentAttempts(String tenantId, String orderId);
    void savePaymentAttempt(PaymentAttempt attempt);

    Optional<PaymentCallbackReceipt> findPaymentCallback(String tenantId, String provider, String providerEventId);
    void savePaymentCallback(PaymentCallbackReceipt receipt);

    List<Entitlement> listEntitlements(String tenantId, String subjectId);
    Optional<Entitlement> findEntitlementBySource(String tenantId, String subjectId, String sourceType, String sourceRef);
    void saveEntitlement(Entitlement entitlement);

    Optional<ActivationCode> findActivationCode(String tenantId, String codeHash);
    void saveActivationCode(ActivationCode code);

    Optional<Refund> findRefund(String tenantId, String refundId);
    Optional<Refund> findRefundById(String refundId);
    List<Refund> listRefunds(String tenantId, String orderId);
    void saveRefund(Refund refund);

    Optional<RefundCallbackReceipt> findRefundCallback(String tenantId, String provider, String providerEventId);
    void saveRefundCallback(RefundCallbackReceipt receipt);
}
