package com.englishflow.commerce.adapter.memory;

import com.englishflow.commerce.application.ports.CommerceStore;
import com.englishflow.commerce.domain.ActivationCode;
import com.englishflow.commerce.domain.Entitlement;
import com.englishflow.commerce.domain.Order;
import com.englishflow.commerce.domain.PaymentAttempt;
import com.englishflow.commerce.domain.PaymentCallbackReceipt;
import com.englishflow.commerce.domain.Refund;
import com.englishflow.commerce.domain.RefundCallbackReceipt;
import com.englishflow.commerce.domain.Sku;

import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Function;
import java.util.stream.Collectors;

/** Dependency-free store used by the Java 24 smoke and local wiring. */
public final class InMemoryCommerceStore implements CommerceStore {
    private final Map<String, Sku> skus = new ConcurrentHashMap<>();
    private final Map<String, Order> orders = new ConcurrentHashMap<>();
    private final Map<String, PaymentAttempt> paymentAttempts = new ConcurrentHashMap<>();
    private final Map<String, PaymentCallbackReceipt> paymentCallbacks = new ConcurrentHashMap<>();
    private final Map<String, Entitlement> entitlements = new ConcurrentHashMap<>();
    private final Map<String, ActivationCode> activationCodes = new ConcurrentHashMap<>();
    private final Map<String, Refund> refunds = new ConcurrentHashMap<>();
    private final Map<String, RefundCallbackReceipt> refundCallbacks = new ConcurrentHashMap<>();

    @Override
    public Optional<Sku> findSku(String tenantId, String skuId) {
        return skus.values().stream()
                .filter(value -> value.tenantId().equals(tenantId) && value.skuId().equals(skuId))
                .max(Comparator.comparingInt(Sku::version));
    }

    @Override
    public void saveSku(Sku sku) {
        if (skus.putIfAbsent(key(sku.tenantId(), sku.skuId(), String.valueOf(sku.version())), sku) != null) {
            throw com.englishflow.commerce.domain.CommerceException.conflict("SKU_IMMUTABLE", "SKU already exists");
        }
    }

    @Override
    public List<Sku> listSkus(String tenantId) {
        return skus.values().stream().filter(value -> value.tenantId().equals(tenantId))
                .collect(Collectors.toMap(Sku::skuId, Function.identity(), (left, right) -> left.version() >= right.version() ? left : right))
                .values().stream()
                .sorted(Comparator.comparing(Sku::skuId)).toList();
    }

    @Override
    public Optional<Order> findOrder(String tenantId, String orderId) {
        return Optional.ofNullable(orders.get(key(tenantId, orderId)));
    }

    @Override
    public Optional<Order> findOrderById(String orderId) {
        return orders.values().stream().filter(value -> value.orderId().equals(orderId)).findFirst();
    }

    @Override
    public void saveOrder(Order order) {
        orders.put(key(order.tenantId(), order.orderId()), order);
    }

    @Override
    public List<Order> listOrders(String tenantId, String subjectId) {
        return orders.values().stream()
                .filter(value -> value.tenantId().equals(tenantId) && value.subjectId().equals(subjectId))
                .sorted(Comparator.comparing(Order::createdAt).reversed()).toList();
    }

    @Override
    public Optional<PaymentAttempt> findPaymentAttempt(String tenantId, String attemptId) {
        return Optional.ofNullable(paymentAttempts.get(key(tenantId, attemptId)));
    }

    @Override
    public List<PaymentAttempt> listPaymentAttempts(String tenantId, String orderId) {
        return paymentAttempts.values().stream()
                .filter(value -> value.tenantId().equals(tenantId) && value.orderId().equals(orderId))
                .sorted(Comparator.comparing(PaymentAttempt::updatedAt).reversed()).toList();
    }

    @Override
    public void savePaymentAttempt(PaymentAttempt attempt) {
        paymentAttempts.put(key(attempt.tenantId(), attempt.attemptId()), attempt);
    }

    @Override
    public Optional<PaymentCallbackReceipt> findPaymentCallback(String tenantId, String provider,
                                                                String providerEventId) {
        return Optional.ofNullable(paymentCallbacks.get(key(tenantId, provider + "|" + providerEventId)));
    }

    @Override
    public void savePaymentCallback(PaymentCallbackReceipt receipt) {
        paymentCallbacks.put(key(receipt.tenantId(), receipt.provider().name() + "|" + receipt.providerEventId()), receipt);
    }

    @Override
    public List<Entitlement> listEntitlements(String tenantId, String subjectId) {
        return entitlements.values().stream()
                .filter(value -> value.tenantId().equals(tenantId) && value.subjectId().equals(subjectId))
                .sorted(Comparator.comparing(Entitlement::activeFrom).reversed()).toList();
    }

    @Override
    public Optional<Entitlement> findEntitlementBySource(String tenantId, String subjectId,
                                                          String sourceType, String sourceRef) {
        return entitlements.values().stream()
                .filter(value -> value.tenantId().equals(tenantId) && value.subjectId().equals(subjectId)
                        && value.sourceType().equals(sourceType) && value.sourceRef().equals(sourceRef))
                .findFirst();
    }

    @Override
    public void saveEntitlement(Entitlement entitlement) {
        entitlements.put(key(entitlement.tenantId(), entitlement.entitlementId()), entitlement);
    }

    @Override
    public Optional<ActivationCode> findActivationCode(String tenantId, String codeHash) {
        return Optional.ofNullable(activationCodes.get(key(tenantId, codeHash)));
    }

    @Override
    public void saveActivationCode(ActivationCode code) {
        activationCodes.put(key(code.tenantId(), code.codeHash()), code);
    }

    @Override
    public Optional<Refund> findRefund(String tenantId, String refundId) {
        return Optional.ofNullable(refunds.get(key(tenantId, refundId)));
    }

    @Override
    public Optional<Refund> findRefundById(String refundId) {
        return refunds.values().stream().filter(value -> value.refundId().equals(refundId)).findFirst();
    }

    @Override
    public List<Refund> listRefunds(String tenantId, String orderId) {
        return refunds.values().stream()
                .filter(value -> value.tenantId().equals(tenantId) && value.orderId().equals(orderId))
                .sorted(Comparator.comparing(Refund::createdAt).reversed()).toList();
    }

    @Override
    public void saveRefund(Refund refund) {
        refunds.put(key(refund.tenantId(), refund.refundId()), refund);
    }

    @Override
    public Optional<RefundCallbackReceipt> findRefundCallback(String tenantId, String provider,
                                                              String providerEventId) {
        return Optional.ofNullable(refundCallbacks.get(key(tenantId, provider + "|" + providerEventId)));
    }

    @Override
    public void saveRefundCallback(RefundCallbackReceipt receipt) {
        refundCallbacks.put(key(receipt.tenantId(), receipt.provider().name() + "|" + receipt.providerEventId()), receipt);
    }

    private static String key(String tenantId, String id) {
        return tenantId + "\u001f" + id;
    }

    private static String key(String tenantId, String id, String version) {
        return tenantId + "\u001f" + id + "\u001f" + version;
    }
}
