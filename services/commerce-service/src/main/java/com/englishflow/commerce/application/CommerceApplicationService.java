package com.englishflow.commerce.application;

import com.englishflow.commerce.application.CommerceCommands.CreateOrder;
import com.englishflow.commerce.application.CommerceCommands.IssueActivationCode;
import com.englishflow.commerce.application.CommerceCommands.PaymentCallback;
import com.englishflow.commerce.application.CommerceCommands.RefundCallback;
import com.englishflow.commerce.application.CommerceCommands.RedeemActivationCode;
import com.englishflow.commerce.application.CommerceCommands.RequestRefund;
import com.englishflow.commerce.application.CommerceCommands.StartPayment;
import com.englishflow.commerce.application.ports.AuditPort;
import com.englishflow.commerce.application.ports.CommerceClock;
import com.englishflow.commerce.application.ports.CommerceStore;
import com.englishflow.commerce.application.ports.IdempotencyPort;
import com.englishflow.commerce.application.ports.OutboxPort;
import com.englishflow.commerce.application.ports.PaymentProviderPort;
import com.englishflow.commerce.application.ports.PaymentProviderRegistry;
import com.englishflow.commerce.application.security.CommerceAccessPolicy;
import com.englishflow.commerce.domain.ActivationCode;
import com.englishflow.commerce.domain.ActivationCodeStatus;
import com.englishflow.commerce.domain.CommerceException;
import com.englishflow.commerce.domain.CommercePrincipal;
import com.englishflow.commerce.domain.CommerceStateMachine;
import com.englishflow.commerce.domain.CommerceViews;
import com.englishflow.commerce.domain.Entitlement;
import com.englishflow.commerce.domain.EntitlementStatus;
import com.englishflow.commerce.domain.Order;
import com.englishflow.commerce.domain.OrderStatus;
import com.englishflow.commerce.domain.PaymentAttempt;
import com.englishflow.commerce.domain.PaymentAttemptStatus;
import com.englishflow.commerce.domain.PaymentCallbackReceipt;
import com.englishflow.commerce.domain.PaymentGate;
import com.englishflow.commerce.domain.PaymentProvider;
import com.englishflow.commerce.domain.PriceSnapshot;
import com.englishflow.commerce.domain.Refund;
import com.englishflow.commerce.domain.RefundCallbackReceipt;
import com.englishflow.commerce.domain.RefundStatus;
import com.englishflow.commerce.domain.ReconciliationReport;
import com.englishflow.commerce.domain.ReconciliationStatus;
import com.englishflow.commerce.domain.Sku;
import com.englishflow.commerce.domain.SkuStatus;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.HexFormat;
import java.util.List;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.function.Supplier;

/**
 * Transaction/application boundary for COM-001 and COM-002.
 * Persistence, payment SDKs, audit and event delivery are replaceable ports.
 */
public final class CommerceApplicationService {
    private static final String ORDER_WRITE = "commerce:order:write";
    private static final String ORDER_READ = "commerce:order:read";
    private static final String PAYMENT_WRITE = "commerce:payment:write";
    private static final String ENTITLEMENT_READ = "commerce:entitlement:read";
    private static final String REFUND_WRITE = "commerce:refund:write";
    private static final String SKU_WRITE = "commerce:sku:write";
    private static final String ACTIVATION_WRITE = "commerce:activation:write";
    private static final String ACTIVATION_REDEEM = "commerce:activation:redeem";
    private static final String RECONCILIATION_READ = "commerce:reconciliation:read";

    private final CommerceStore store;
    private final IdempotencyPort idempotency;
    private final AuditPort audit;
    private final OutboxPort outbox;
    private final PaymentProviderRegistry providers;
    private final CommerceAccessPolicy access;
    private final PaymentGate paymentGate;
    private final CommerceClock clock;
    private final SecureRandom random;

    public CommerceApplicationService(CommerceStore store, IdempotencyPort idempotency,
            AuditPort audit, OutboxPort outbox, PaymentProviderRegistry providers,
            CommerceAccessPolicy access, PaymentGate paymentGate, CommerceClock clock) {
        this(store, idempotency, audit, outbox, providers, access, paymentGate, clock, new SecureRandom());
    }

    public CommerceApplicationService(CommerceStore store, IdempotencyPort idempotency,
            AuditPort audit, OutboxPort outbox, PaymentProviderRegistry providers,
            CommerceAccessPolicy access, PaymentGate paymentGate, CommerceClock clock,
            SecureRandom random) {
        this.store = Objects.requireNonNull(store);
        this.idempotency = Objects.requireNonNull(idempotency);
        this.audit = Objects.requireNonNull(audit);
        this.outbox = Objects.requireNonNull(outbox);
        this.providers = Objects.requireNonNull(providers);
        this.access = Objects.requireNonNull(access);
        this.paymentGate = Objects.requireNonNull(paymentGate);
        this.clock = Objects.requireNonNull(clock);
        this.random = Objects.requireNonNull(random);
    }

    public void registerSku(CommercePrincipal actor, Sku sku) {
        access.requireStaff(actor, SKU_WRITE);
        if (!actor.tenantId().equals(sku.tenantId())) throw CommerceException.forbidden("SKU tenant mismatch");
        Sku current = store.findSku(sku.tenantId(), sku.skuId()).orElse(null);
        if (current != null && sku.version() <= current.version()) {
            throw CommerceException.conflict("SKU_IMMUTABLE", "existing SKU price/version cannot be mutated");
        }
        store.saveSku(sku);
        audit(actor, "commerce.sku.registered", "SKU", sku.skuId(), "APPLIED", Map.of("version", String.valueOf(sku.version())));
    }

    public List<CommerceViews.SkuView> listSkus(CommercePrincipal principal) {
        access.requirePermission(principal, ORDER_READ);
        return store.listSkus(principal.tenantId()).stream().map(this::skuView).toList();
    }

    /**
     * Public, published-only projection. The tenant is supplied by server configuration; no
     * request header, query parameter, or client body can choose the commerce tenant.
     */
    public Map<String, Object> publicCatalog(String serverTenantId) {
        if (serverTenantId == null || serverTenantId.isBlank()) {
            throw CommerceException.unavailable("PUBLIC_CATALOG_UNAVAILABLE", "public catalog tenant is not configured");
        }
        List<Map<String, Object>> plans = store.listSkus(serverTenantId).stream()
                .filter(sku -> sku.status() == SkuStatus.ACTIVE)
                .map(sku -> {
                    Map<String, Object> plan = new LinkedHashMap<>();
                    plan.put("planId", sku.skuId());
                    plan.put("name", sku.title());
                    plan.put("displayPrice", String.format(Locale.ROOT, "%s %.2f", sku.currency(), sku.amountMinor() / 100.0));
                    plan.put("unit", "ONE_TIME");
                    plan.put("features", List.of(sku.entitlementCode()));
                    plan.put("availability", "available");
                    plan.put("entitlementCode", sku.entitlementCode());
                    plan.put("priceSnapshotId", sku.skuId() + "-v" + sku.version());
                    return plan;
                }).toList();
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("catalogVersion", "commerce-public-v1");
        result.put("uiLocale", "zh-CN");
        result.put("contentLocale", "en-US");
        result.put("plans", plans);
        result.put("publishedAt", clock.now().toString());
        result.put("checkoutPath", "/pricing");
        return result;
    }

    public CommerceViews.OrderView createOrder(CommercePrincipal principal, CreateOrder command, String key) {
        access.requirePermission(principal, ORDER_WRITE);
        requireKey(key);
        if (command == null || command.skuId() == null || command.skuId().isBlank()) {
            throw CommerceException.bad("SKU_REQUIRED", "skuId is required");
        }
        String fingerprint = fingerprint(command.skuId());
        return idempotent(principal, "order.create", key, fingerprint, () -> {
            Sku sku = requireActiveSku(principal.tenantId(), command.skuId());
            Instant now = clock.now();
            Order order = new Order(principal.tenantId(), newId("ord"), principal.subjectId(), sku.snapshot(now),
                    OrderStatus.CREATED, null, now, now, null);
            store.saveOrder(order);
            audit(principal, "commerce.order.created", "ORDER", order.orderId(), "APPLIED",
                    Map.of("amountMinor", String.valueOf(order.priceSnapshot().amountMinor()), "currency", order.priceSnapshot().currency()));
            emit(order.tenantId(), "ORDER", order.orderId(), "commerce.order.created",
                    Map.of("orderId", order.orderId(), "skuId", order.priceSnapshot().skuId(),
                            "priceSnapshotId", order.priceSnapshot().skuId() + "-v" + order.priceSnapshot().skuVersion(),
                            "amountMinor", String.valueOf(order.priceSnapshot().amountMinor()),
                            "currency", order.priceSnapshot().currency(), "state", order.status().name()));
            return orderView(order);
        });
    }

    public CommerceViews.OrderView getOrder(CommercePrincipal principal, String orderId) {
        access.requirePermission(principal, ORDER_READ);
        // Resolve by opaque id first so a cross-tenant/owner lookup is denied
        // by the PEP with the same indistinguishable resource outcome as any
        // other out-of-scope resource, rather than leaking tenant existence.
        Order order = requireGlobalOrder(orderId);
        access.requireOwner(principal, order.tenantId(), order.subjectId());
        return orderView(order);
    }

    public List<CommerceViews.OrderView> listOrders(CommercePrincipal principal) {
        access.requirePermission(principal, ORDER_READ);
        return store.listOrders(principal.tenantId(), principal.subjectId()).stream().map(this::orderView).toList();
    }

    public CommerceViews.PaymentStartView startPayment(CommercePrincipal principal, StartPayment command, String key) {
        access.requirePermission(principal, PAYMENT_WRITE);
        requireKey(key);
        if (command == null || command.orderId() == null || command.provider() == null) {
            throw CommerceException.bad("PAYMENT_COMMAND_INVALID", "orderId and provider are required");
        }
        return idempotent(principal, "payment.start", key,
                fingerprint(command.orderId(), command.provider().name()),
                () -> startPaymentInternal(principal, command, key, false));
    }

    public CommerceViews.PaymentStartView recoverPayment(CommercePrincipal principal, String orderId, String key) {
        access.requirePermission(principal, PAYMENT_WRITE);
        requireKey(key);
        if (orderId == null || orderId.isBlank()) throw CommerceException.bad("ORDER_REQUIRED", "orderId is required");
        return idempotent(principal, "payment.recover", key, fingerprint(orderId), () -> {
            Order order = requireOwnedOrder(principal, orderId);
            Instant now = clock.now();
            for (PaymentAttempt attempt : store.listPaymentAttempts(order.tenantId(), order.orderId())) {
                if (attempt.status() == PaymentAttemptStatus.PENDING) {
                    store.savePaymentAttempt(attempt.transition(PaymentAttemptStatus.CANCELLED, now));
                }
            }
            PaymentProvider provider = order.provider() == null ? PaymentProvider.SANDBOX : order.provider();
            return startPaymentInternal(principal, new StartPayment(orderId, provider), key, true);
        });
    }

    public CommerceViews.OrderView cancelOrder(CommercePrincipal principal, String orderId, String key) {
        access.requirePermission(principal, ORDER_WRITE);
        requireKey(key);
        return idempotent(principal, "order.cancel", key, fingerprint(orderId), () -> {
            Order order = requireOwnedOrder(principal, orderId);
            if (order.status() != OrderStatus.CREATED && order.status() != OrderStatus.PAYMENT_PENDING
                    && order.status() != OrderStatus.PAYMENT_FAILED && order.status() != OrderStatus.REFUND_FAILED) {
                throw CommerceException.conflict("ORDER_CANCEL_NOT_ALLOWED", "order cannot be cancelled from " + order.status());
            }
            Instant now = clock.now();
            for (PaymentAttempt attempt : store.listPaymentAttempts(order.tenantId(), order.orderId())) {
                if (attempt.status() == PaymentAttemptStatus.PENDING) {
                    store.savePaymentAttempt(attempt.transition(PaymentAttemptStatus.CANCELLED, now));
                }
            }
            Order cancelled = order.transition(OrderStatus.CANCELLED, now);
            store.saveOrder(cancelled);
            audit(principal, "commerce.order.cancelled", "ORDER", order.orderId(), "APPLIED", Map.of());
            emit(order.tenantId(), "ORDER", order.orderId(), "commerce.order.cancelled", Map.of("orderId", order.orderId()));
            return orderView(cancelled);
        });
    }

    public synchronized CommerceViews.PaymentCallbackView receivePaymentCallback(PaymentCallback command) {
        validatePaymentCallback(command);
        Order order = requireGlobalOrder(command.orderId());
        String rawPayloadHash = hash(command.payload());
        PaymentCallbackReceipt previous = store.findPaymentCallback(order.tenantId(), command.provider().name(), command.providerEventId()).orElse(null);
        if (previous != null && !previous.payloadHash().equals(rawPayloadHash)) {
            throw CommerceException.conflict("PAYMENT_CALLBACK_REPLAY_CONFLICT", "provider event was rebound to another payload");
        }

        PaymentProviderPort port = providers.find(command.provider()).orElse(null);
        if (port == null && !paymentGate.allows(command.provider())) {
            return rejectPaymentCallbackByGate(order, command, rawPayloadHash);
        }
        if (port == null) port = providers.require(command.provider());
        PaymentProviderPort.Verification verification = port.verifyPaymentCallback(command);
        if (!verification.valid()) {
            auditSystem(order.tenantId(), "commerce.payment.callback.rejected", "ORDER", order.orderId(),
                    verification.reasonCode(), Map.of("provider", command.provider().name()));
            throw CommerceException.conflict(verification.reasonCode(), "payment callback verification failed");
        }
        if (!verification.payloadHash().equals(rawPayloadHash)) {
            throw CommerceException.conflict("PAYMENT_CALLBACK_PAYLOAD_HASH_MISMATCH", "provider verification did not bind the signed payload");
        }
        if (previous != null) {
            // A Gate rejection is recorded for audit but is not settlement. The same
            // provider event may be retried after the release Gate opens.
            if (!previous.verificationState().startsWith("GATE_REJECTED")) {
                return new CommerceViews.PaymentCallbackView(command.providerEventId(), order.orderId(), "DUPLICATE", true,
                        order.status(), entitlementIdForOrder(order));
            }
        }
        if (!paymentGate.allows(command.provider())) {
            return rejectPaymentCallbackByGate(order, command, verification.payloadHash());
        }
        if (order.provider() != null && order.provider() != command.provider()) throw CommerceException.conflict("PAYMENT_PROVIDER_MISMATCH", "callback provider differs from order");
        if (command.amountMinor() != order.priceSnapshot().amountMinor()
                || !command.currency().equals(order.priceSnapshot().currency())) {
            throw CommerceException.conflict("PAYMENT_AMOUNT_MISMATCH", "callback amount or currency differs from price snapshot");
        }
        PaymentAttempt latest = latestPendingAttempt(order);
        if (latest == null || latest.status() != PaymentAttemptStatus.PENDING) {
            throw CommerceException.conflict("PAYMENT_ATTEMPT_NOT_PENDING", "callback has no pending payment attempt");
        }
        Instant now = clock.now();
        boolean success = "SUCCESS".equalsIgnoreCase(command.resultCode());
        Order settled = order;
        String entitlementId = "";
        if (success) {
            settled = order.transition(OrderStatus.PAID, now);
            store.savePaymentAttempt(latest.transition(PaymentAttemptStatus.SUCCEEDED, now));
            Entitlement entitlement = activateEntitlement(order, "ORDER", order.orderId(), now);
            entitlementId = entitlement.entitlementId();
            emit(order.tenantId(), "ORDER", order.orderId(), "commerce.entitlement.activated",
                    entitlementEventPayload(entitlement, "VERIFIED_PAYMENT"));
        } else {
            settled = order.transition(OrderStatus.PAYMENT_FAILED, now);
            store.savePaymentAttempt(latest.transition(PaymentAttemptStatus.FAILED, now));
        }
        store.saveOrder(settled);
        store.savePaymentCallback(new PaymentCallbackReceipt(order.tenantId(), command.provider(), command.providerEventId(),
                order.orderId(), verification.payloadHash(), command.amountMinor(), command.currency(),
                success ? "VERIFIED_SUCCESS" : "VERIFIED_FAILURE", now));
        auditSystem(order.tenantId(), "commerce.payment.callback.accepted", "ORDER", order.orderId(),
                success ? "APPLIED" : "PAYMENT_FAILED", Map.of("providerEventId", command.providerEventId()));
        emit(order.tenantId(), "ORDER", order.orderId(), "commerce.payment.callback_received",
                Map.of("providerEventRef", command.providerEventId(), "orderRef", order.orderId(),
                        "callbackState", success ? "VERIFIED_PAID" : "REJECTED",
                        "amountMinor", String.valueOf(command.amountMinor()), "currency", command.currency(),
                        "verificationRef", verification.payloadHash()));
        return new CommerceViews.PaymentCallbackView(command.providerEventId(), order.orderId(), success ? "APPLIED" : "FAILED",
                false, settled.status(), entitlementId);
    }

    public List<CommerceViews.EntitlementView> listEntitlements(CommercePrincipal principal) {
        access.requirePermission(principal, ENTITLEMENT_READ);
        return store.listEntitlements(principal.tenantId(), principal.subjectId()).stream().map(this::entitlementView).toList();
    }

    public CommerceViews.ActivationCodeIssueView issueActivationCode(CommercePrincipal principal,
            IssueActivationCode command, String key) {
        access.requirePermission(principal, ACTIVATION_WRITE);
        requireKey(key);
        if (command == null || command.skuId() == null || command.expiresAt() == null) {
            throw CommerceException.bad("ACTIVATION_COMMAND_INVALID", "skuId and expiresAt are required");
        }
        return idempotent(principal, "activation.issue", key, fingerprint(command.skuId(), command.expiresAt().toString()), () -> {
            Sku sku = requireActiveSku(principal.tenantId(), command.skuId());
            if (!command.expiresAt().isAfter(clock.now())) throw CommerceException.bad("ACTIVATION_EXPIRY_INVALID", "expiresAt must be in the future");
            String rawCode = generateActivationCode();
            String hash = hash(rawCode);
            ActivationCode code = new ActivationCode(principal.tenantId(), hash, sku.skuId(), sku.snapshot(clock.now()),
                    ActivationCodeStatus.AVAILABLE, command.expiresAt(), null, null);
            store.saveActivationCode(code);
            String codeRef = hash.substring(0, 12);
            audit(principal, "commerce.activation_code.issued", "ACTIVATION_CODE", codeRef, "APPLIED", Map.of("skuId", sku.skuId()));
            emit(principal.tenantId(), "ACTIVATION_CODE", codeRef, "commerce.activation_code.issued", Map.of("codeRef", codeRef, "skuId", sku.skuId()));
            return new CommerceViews.ActivationCodeIssueView(newId("batch"), rawCode, codeRef, sku.skuId(), command.expiresAt());
        });
    }

    public CommerceViews.ActivationRedeemView redeemActivationCode(CommercePrincipal principal,
            RedeemActivationCode command, String key) {
        access.requirePermission(principal, ACTIVATION_REDEEM);
        requireKey(key);
        if (command == null || command.code() == null || command.code().isBlank()) {
            throw CommerceException.bad("ACTIVATION_CODE_REQUIRED", "code is required");
        }
        String fingerprint = fingerprint(command.code());
        IdempotencyPort.Record previous = idempotency.find(principal.tenantId(), principal.subjectId(),
                "activation.redeem", key).orElse(null);
        if (previous != null) {
            if (!previous.requestFingerprint().equals(fingerprint)) {
                throw CommerceException.conflict("IDEMPOTENCY_KEY_REUSED", "Idempotency-Key was reused with another request");
            }
            if (previous.response() instanceof CommerceViews.ActivationRedeemView replay) {
                return new CommerceViews.ActivationRedeemView(replay.codeRef(), replay.entitlementId(), replay.state(), true);
            }
        }
        return idempotent(principal, "activation.redeem", key, fingerprint(command.code()), () -> {
            String codeHash = hash(command.code());
            ActivationCode code = store.findActivationCode(principal.tenantId(), codeHash)
                    .orElseThrow(() -> CommerceException.conflict("ACTIVATION_CODE_INVALID", "activation code is invalid"));
            ActivationCode redeemed = code.redeem(principal.subjectId(), clock.now());
            store.saveActivationCode(redeemed);
            Entitlement entitlement = activateEntitlement(principal.tenantId(), principal.subjectId(), redeemed.skuId(),
                    redeemed.priceSnapshot(), "ACTIVATION_CODE", codeHash, clock.now());
            audit(principal, "commerce.activation_code.redeemed", "ACTIVATION_CODE", codeHash.substring(0, 12), "APPLIED", Map.of());
            emit(principal.tenantId(), "ENTITLEMENT", entitlement.entitlementId(), "commerce.entitlement.activated",
                    entitlementEventPayload(entitlement, "ACTIVATION_CODE"));
            return new CommerceViews.ActivationRedeemView(codeHash.substring(0, 12), entitlement.entitlementId(), "REDEEMED", false);
        });
    }

    public CommerceViews.RefundView requestRefund(CommercePrincipal principal, RequestRefund command, String key) {
        access.requirePermission(principal, REFUND_WRITE);
        requireKey(key);
        if (command == null || command.orderId() == null) throw CommerceException.bad("REFUND_COMMAND_INVALID", "orderId is required");
        return idempotent(principal, "refund.request", key, fingerprint(command.orderId(), command.reasonCode()), () -> {
            Order order = requireOwnedOrder(principal, command.orderId());
            if (order.status() != OrderStatus.PAID && order.status() != OrderStatus.REFUND_FAILED) {
                throw CommerceException.conflict("REFUND_ORDER_NOT_REFUNDABLE", "only a paid or recoverable refund order can be refunded");
            }
            Instant now = clock.now();
            Refund refund = new Refund(order.tenantId(), newId("rfd"), order.orderId(), order.subjectId(), order.provider(),
                    order.priceSnapshot().amountMinor(), order.priceSnapshot().currency(), RefundStatus.REQUESTED,
                    command.reasonCode() == null || command.reasonCode().isBlank() ? "USER_REQUEST" : command.reasonCode(), now, now, null);
            store.saveRefund(refund);
            store.saveOrder(order.transition(OrderStatus.REFUND_PENDING, now));
            if (paymentGate.allows(order.provider())) {
                PaymentProviderPort port = providers.require(order.provider());
                port.requestRefund(new PaymentProviderPort.RefundRequest(refund.refundId(), order.orderId(), refund.amountMinor(), refund.currency(), key));
                refund = refund.transition(RefundStatus.PROCESSING, now);
                store.saveRefund(refund);
            }
            audit(principal, "commerce.refund.requested", "REFUND", refund.refundId(), "APPLIED", Map.of("orderId", order.orderId()));
            emit(order.tenantId(), "REFUND", refund.refundId(), "commerce.refund.requested",
                    Map.of("refundId", refund.refundId(), "orderId", order.orderId(), "amountMinor", String.valueOf(refund.amountMinor())));
            return refundView(refund);
        });
    }

    public synchronized CommerceViews.RefundCallbackView receiveRefundCallback(RefundCallback command) {
        validateRefundCallback(command);
        Refund refund = requireGlobalRefund(command.refundId());
        String rawPayloadHash = hash(command.payload());
        RefundCallbackReceipt previous = store.findRefundCallback(refund.tenantId(), command.provider().name(), command.providerEventId()).orElse(null);
        if (previous != null && !previous.payloadHash().equals(rawPayloadHash)) {
            throw CommerceException.conflict("REFUND_CALLBACK_REPLAY_CONFLICT", "provider event payload changed");
        }
        Order order = requireGlobalOrder(refund.orderId());
        PaymentProviderPort port = providers.find(command.provider()).orElse(null);
        if (port == null && !paymentGate.allows(command.provider())) {
            return rejectRefundCallbackByGate(refund, order, command, rawPayloadHash);
        }
        if (port == null) port = providers.require(command.provider());
        PaymentProviderPort.Verification verification = port.verifyRefundCallback(command);
        if (!verification.valid()) {
            auditSystem(refund.tenantId(), "commerce.refund.callback.rejected", "REFUND", refund.refundId(),
                    verification.reasonCode(), Map.of("provider", command.provider().name()));
            throw CommerceException.conflict(verification.reasonCode(), "refund callback verification failed");
        }
        if (!verification.payloadHash().equals(rawPayloadHash)) {
            throw CommerceException.conflict("REFUND_CALLBACK_PAYLOAD_HASH_MISMATCH", "provider verification did not bind the signed payload");
        }
        if (previous != null && !previous.verificationState().startsWith("GATE_REJECTED")) {
            return new CommerceViews.RefundCallbackView(command.providerEventId(), refund.refundId(), "DUPLICATE", true, refund.status(), order.status());
        }
        if (!paymentGate.allows(command.provider())) {
            return rejectRefundCallbackByGate(refund, order, command, verification.payloadHash());
        }
        if (refund.provider() != command.provider()) throw CommerceException.conflict("REFUND_PROVIDER_MISMATCH", "callback provider differs from refund");
        if (command.amountMinor() != refund.amountMinor() || !command.currency().equals(refund.currency())) {
            throw CommerceException.conflict("REFUND_AMOUNT_MISMATCH", "refund callback amount or currency differs from request");
        }
        if (refund.status() != RefundStatus.REQUESTED && refund.status() != RefundStatus.PROCESSING && refund.status() != RefundStatus.FAILED) {
            throw CommerceException.conflict("REFUND_CALLBACK_NOT_PROCESSABLE", "refund is no longer recoverable");
        }
        Instant now = clock.now();
        boolean success = "SUCCESS".equalsIgnoreCase(command.resultCode());
        Refund settledRefund;
        Order settledOrder;
        if (success) {
            if (refund.status() != RefundStatus.PROCESSING) refund = refund.transition(RefundStatus.PROCESSING, now);
            settledRefund = refund.transition(RefundStatus.COMPLETED, now);
            settledOrder = order.transition(OrderStatus.REFUNDED, now);
            revokeOrderEntitlements(order, "REFUND_COMPLETED", now);
        } else {
            if (refund.status() == RefundStatus.FAILED) {
                throw CommerceException.conflict("REFUND_CALLBACK_NOT_PROCESSABLE", "refund failure is already recorded; recover before retrying");
            }
            settledRefund = refund.transition(RefundStatus.FAILED, now);
            settledOrder = order.transition(OrderStatus.REFUND_FAILED, now);
        }
        store.saveRefund(settledRefund);
        store.saveOrder(settledOrder);
        store.saveRefundCallback(new RefundCallbackReceipt(refund.tenantId(), command.provider(), command.providerEventId(), refund.refundId(),
                verification.payloadHash(), command.amountMinor(), command.currency(), success ? "VERIFIED_SUCCESS" : "VERIFIED_FAILURE", now));
        auditSystem(refund.tenantId(), "commerce.refund.callback.accepted", "REFUND", refund.refundId(), success ? "COMPLETED" : "FAILED", Map.of());
        emit(refund.tenantId(), "REFUND", refund.refundId(), success ? "commerce.refund.completed" : "commerce.refund.failed",
                Map.of("refundId", refund.refundId(), "orderRef", refund.orderId(),
                        "state", success ? "SUCCEEDED" : "REJECTED",
                        "amountMinor", String.valueOf(refund.amountMinor()), "currency", refund.currency(),
                        "completedAt", now.toString()));
        return new CommerceViews.RefundCallbackView(command.providerEventId(), refund.refundId(), success ? "COMPLETED" : "FAILED",
                false, settledRefund.status(), settledOrder.status());
    }

    public CommerceViews.ReconciliationView reconcileOrder(CommercePrincipal principal, String orderId) {
        access.requireStaff(principal, RECONCILIATION_READ);
        Order order = requireOrder(principal.tenantId(), orderId);
        long paid = store.listPaymentAttempts(order.tenantId(), order.orderId()).stream()
                .filter(value -> value.status() == PaymentAttemptStatus.SUCCEEDED).mapToLong(PaymentAttempt::amountMinor).sum();
        long refunded = store.listRefunds(order.tenantId(), order.orderId()).stream()
                .filter(value -> value.status() == RefundStatus.COMPLETED).mapToLong(Refund::amountMinor).sum();
        List<Entitlement> orderEntitlements = store.listEntitlements(order.tenantId(), order.subjectId()).stream()
                .filter(value -> "ORDER".equals(value.sourceType()) && order.orderId().equals(value.sourceRef())).toList();
        String entitlementState = orderEntitlements.stream().findFirst().map(value -> value.status().name()).orElse("MISSING");
        boolean matched = switch (order.status()) {
            case PAID -> paid == order.priceSnapshot().amountMinor() && refunded == 0 && "ACTIVE".equals(entitlementState);
            case REFUNDED -> paid == order.priceSnapshot().amountMinor() && refunded == order.priceSnapshot().amountMinor()
                    && "REVOKED".equals(entitlementState);
            default -> paid == 0 && refunded == 0;
        };
        ReconciliationReport report = new ReconciliationReport(order.tenantId(), order.orderId(),
                matched ? ReconciliationStatus.MATCH : ReconciliationStatus.MISMATCH,
                order.priceSnapshot().amountMinor(), paid, refunded, entitlementState, !matched, clock.now());
        CommerceViews.ReconciliationView result = new CommerceViews.ReconciliationView(report.orderId(), report.status().name(),
                report.expectedAmountMinor(), report.paidAmountMinor(), report.refundedAmountMinor(), report.entitlementStatus(),
                report.repairRequired(), report.checkedAt());
        audit(principal, "commerce.reconciliation.checked", "ORDER", order.orderId(), result.state(), Map.of("repairRequired", String.valueOf(result.repairRequired())));
        return result;
    }

    public CommerceViews.ReadinessView readiness() {
        return new CommerceViews.ReadinessView(paymentGate.enabled(), paymentGate.realProvidersEnabled(), paymentGate.environment(),
                paymentGate.enabledProviders().stream().sorted().toList(), paymentGate.enabled() ? "READY" : "PAYMENT_PROVIDER_READINESS_PENDING");
    }

    private CommerceViews.PaymentStartView startPaymentInternal(CommercePrincipal principal, StartPayment command, String key, boolean recovery) {
        Order order = requireOwnedOrder(principal, command.orderId());
        if (order.status() == OrderStatus.PAID || order.status() == OrderStatus.REFUNDED) throw CommerceException.conflict("ORDER_ALREADY_SETTLED", "order is already settled");
        if (order.status() == OrderStatus.CANCELLED) throw CommerceException.conflict("ORDER_CANCELLED", "order is cancelled");
        if (order.status() == OrderStatus.REFUND_PENDING) throw CommerceException.conflict("ORDER_REFUND_PENDING", "order is being refunded");
        if (order.status() == OrderStatus.REFUND_FAILED) throw CommerceException.conflict("ORDER_REFUND_FAILED", "recover the refund instead of starting another payment");
        if (!paymentGate.allows(command.provider())) {
            PaymentAttempt disabled = new PaymentAttempt(order.tenantId(), newId("pay"), order.orderId(), order.subjectId(), command.provider(),
                    PaymentAttemptStatus.DISABLED, order.priceSnapshot().amountMinor(), order.priceSnapshot().currency(), "", clock.now(), clock.now());
            store.savePaymentAttempt(disabled);
            audit(principal, "commerce.payment.disabled", "ORDER", order.orderId(), paymentGate.reason(command.provider()), Map.of());
            return new CommerceViews.PaymentStartView(order.orderId(), disabled.attemptId(), command.provider(), disabled.status(), false, true, "");
        }
        if (order.status() == OrderStatus.PAYMENT_PENDING && !recovery) {
            PaymentAttempt pending = latestPendingAttempt(order);
            if (pending != null && pending.status() == PaymentAttemptStatus.PENDING) {
                return new CommerceViews.PaymentStartView(order.orderId(), pending.attemptId(), pending.provider(), pending.status(), true, true, pending.providerReference());
            }
        }
        Instant now = clock.now();
        Order pendingOrder = order.status() == OrderStatus.CREATED ? order.transition(OrderStatus.PAYMENT_PENDING, now)
                : order.status() == OrderStatus.PAYMENT_FAILED ? order.transition(OrderStatus.PAYMENT_PENDING, now) : order.withProvider(command.provider(), now);
        pendingOrder = pendingOrder.withProvider(command.provider(), now);
        PaymentProviderPort.PaymentIntent intent = providers.require(command.provider()).startPayment(
                new PaymentProviderPort.PaymentRequest(order.orderId(), order.priceSnapshot().amountMinor(), order.priceSnapshot().currency(), key));
        PaymentAttempt attempt = new PaymentAttempt(order.tenantId(), newId("pay"), order.orderId(), order.subjectId(), command.provider(),
                PaymentAttemptStatus.PENDING, order.priceSnapshot().amountMinor(), order.priceSnapshot().currency(), intent.providerReference(), now, now);
        store.saveOrder(pendingOrder);
        store.savePaymentAttempt(attempt);
        audit(principal, recovery ? "commerce.payment.recovered" : "commerce.payment.started", "ORDER", order.orderId(), "PENDING", Map.of());
        emit(order.tenantId(), "ORDER", order.orderId(), "commerce.payment.attempted", Map.of("orderId", order.orderId(), "attemptId", attempt.attemptId(), "provider", command.provider().name()));
        return new CommerceViews.PaymentStartView(order.orderId(), attempt.attemptId(), command.provider(), attempt.status(), true, true, intent.providerReference());
    }

    private Entitlement activateEntitlement(Order order, String sourceType, String sourceRef, Instant now) {
        return activateEntitlement(order.tenantId(), order.subjectId(), order.priceSnapshot().skuId(), order.priceSnapshot(), sourceType, sourceRef, now,
                order.priceSnapshot().entitlementCode());
    }

    private Entitlement activateEntitlement(String tenantId, String subjectId, String skuId, PriceSnapshot snapshot,
            String sourceType, String sourceRef, Instant now) {
        return activateEntitlement(tenantId, subjectId, skuId, snapshot, sourceType, sourceRef, now, "");
    }

    private Entitlement activateEntitlement(String tenantId, String subjectId, String skuId, PriceSnapshot snapshot,
            String sourceType, String sourceRef, Instant now, String entitlementCode) {
        Entitlement existing = store.findEntitlementBySource(tenantId, subjectId, sourceType, sourceRef).orElse(null);
        if (existing != null) return existing;
        if (entitlementCode.isBlank()) entitlementCode = snapshot.entitlementCode();
        if (entitlementCode.isBlank()) entitlementCode = requireSku(tenantId, skuId).entitlementCode();
        Entitlement created = new Entitlement(tenantId, newId("ent"), subjectId, skuId, entitlementCode, sourceType, sourceRef,
                snapshot, EntitlementStatus.ACTIVE, now, null, "");
        store.saveEntitlement(created);
        return created;
    }

    private void revokeOrderEntitlements(Order order, String reason, Instant now) {
        for (Entitlement entitlement : store.listEntitlements(order.tenantId(), order.subjectId())) {
            if ("ORDER".equals(entitlement.sourceType()) && order.orderId().equals(entitlement.sourceRef())
                    && entitlement.status() != EntitlementStatus.REVOKED) {
                store.saveEntitlement(entitlement.transition(EntitlementStatus.REVOKED, reason, now));
            }
        }
    }

    private String entitlementIdForOrder(Order order) {
        return store.listEntitlements(order.tenantId(), order.subjectId()).stream()
                .filter(value -> "ORDER".equals(value.sourceType()) && order.orderId().equals(value.sourceRef()))
                .map(Entitlement::entitlementId).findFirst().orElse("");
    }

    private PaymentAttempt latestPendingAttempt(Order order) {
        return store.listPaymentAttempts(order.tenantId(), order.orderId()).stream()
                .filter(value -> value.status() == PaymentAttemptStatus.PENDING)
                .max((left, right) -> left.updatedAt().compareTo(right.updatedAt())).orElse(null);
    }

    private Sku requireActiveSku(String tenantId, String skuId) {
        Sku sku = requireSku(tenantId, skuId);
        if (sku.status() != SkuStatus.ACTIVE) throw CommerceException.conflict("SKU_INACTIVE", "SKU is not active");
        return sku;
    }

    private Sku requireSku(String tenantId, String skuId) {
        return store.findSku(tenantId, skuId).orElseThrow(() -> CommerceException.notFound("SKU_NOT_FOUND", "SKU does not exist"));
    }

    private Order requireOwnedOrder(CommercePrincipal principal, String orderId) {
        Order order = requireOrder(principal.tenantId(), orderId);
        access.requireOwner(principal, order.tenantId(), order.subjectId());
        return order;
    }

    private Order requireOrder(String tenantId, String orderId) {
        if (orderId == null || orderId.isBlank()) throw CommerceException.bad("ORDER_REQUIRED", "orderId is required");
        return store.findOrder(tenantId, orderId).orElseThrow(() -> CommerceException.notFound("ORDER_NOT_FOUND", "order does not exist"));
    }

    private Order requireGlobalOrder(String orderId) {
        return store.findOrderById(orderId).orElseThrow(() -> CommerceException.notFound("ORDER_NOT_FOUND", "order does not exist"));
    }

    private Refund requireGlobalRefund(String refundId) {
        return store.findRefundById(refundId).orElseThrow(() -> CommerceException.notFound("REFUND_NOT_FOUND", "refund does not exist"));
    }

    private CommerceViews.PaymentCallbackView rejectPaymentCallbackByGate(Order order, PaymentCallback command, String payloadHash) {
        Instant rejectedAt = clock.now();
        store.savePaymentCallback(new PaymentCallbackReceipt(order.tenantId(), command.provider(), command.providerEventId(),
                order.orderId(), payloadHash, command.amountMinor(), command.currency(), "GATE_REJECTED_" + paymentGate.reason(command.provider()), rejectedAt));
        auditSystem(order.tenantId(), "commerce.payment.callback.rejected", "ORDER", order.orderId(),
                "PAYMENT_GATE_CLOSED", Map.of("reasonCode", paymentGate.reason(command.provider())));
        return new CommerceViews.PaymentCallbackView(command.providerEventId(), order.orderId(), "GATE_REJECTED", false,
                order.status(), "");
    }

    private CommerceViews.RefundCallbackView rejectRefundCallbackByGate(Refund refund, Order order,
            RefundCallback command, String payloadHash) {
        Instant rejectedAt = clock.now();
        store.saveRefundCallback(new RefundCallbackReceipt(refund.tenantId(), command.provider(), command.providerEventId(), refund.refundId(),
                payloadHash, command.amountMinor(), command.currency(), "GATE_REJECTED_" + paymentGate.reason(command.provider()), rejectedAt));
        auditSystem(refund.tenantId(), "commerce.refund.callback.rejected", "REFUND", refund.refundId(),
                "REFUND_GATE_CLOSED", Map.of("reasonCode", paymentGate.reason(command.provider())));
        return new CommerceViews.RefundCallbackView(command.providerEventId(), refund.refundId(), "GATE_REJECTED", false,
                refund.status(), order.status());
    }

    private static void validatePaymentCallback(PaymentCallback command) {
        if (command == null || blank(command.providerEventId()) || blank(command.orderId()) || command.provider() == null
                || blank(command.currency()) || blank(command.payload()) || blank(command.signature()) || blank(command.resultCode())) {
            throw CommerceException.bad("PAYMENT_CALLBACK_INVALID", "provider event, order, signature and signed payload are required");
        }
        if (command.amountMinor() < 0) throw CommerceException.bad("AMOUNT_INVALID", "callback amount cannot be negative");
    }

    private static void validateRefundCallback(RefundCallback command) {
        if (command == null || blank(command.providerEventId()) || blank(command.refundId()) || command.provider() == null
                || blank(command.currency()) || blank(command.payload()) || blank(command.signature()) || blank(command.resultCode())) {
            throw CommerceException.bad("REFUND_CALLBACK_INVALID", "provider event, refund, signature and signed payload are required");
        }
        if (command.amountMinor() < 0) throw CommerceException.bad("AMOUNT_INVALID", "callback amount cannot be negative");
    }

    private static boolean blank(String value) { return value == null || value.isBlank(); }

    private static void requireKey(String key) {
        if (key == null || key.isBlank() || key.length() < 8 || key.length() > 128) {
            throw CommerceException.bad("IDEMPOTENCY_KEY_REQUIRED", "Idempotency-Key must be 8-128 characters");
        }
    }

    @SuppressWarnings("unchecked")
    private synchronized <T> T idempotent(CommercePrincipal principal, String operation, String key, String fingerprint, Supplier<T> action) {
        IdempotencyPort.Record previous = idempotency.find(principal.tenantId(), principal.subjectId(), operation, key).orElse(null);
        if (previous != null) {
            if (!previous.requestFingerprint().equals(fingerprint)) {
                throw CommerceException.conflict("IDEMPOTENCY_KEY_REUSED", "Idempotency-Key was reused with another request");
            }
            return (T) replayResponse(previous.response());
        }
        T response = action.get();
        idempotency.save(new IdempotencyPort.Record(principal.tenantId(), principal.subjectId(), operation, key, fingerprint, response, clock.now()));
        return response;
    }

    private static Object replayResponse(Object response) {
        if (response instanceof CommerceViews.ActivationRedeemView value) {
            return new CommerceViews.ActivationRedeemView(value.codeRef(), value.entitlementId(), value.state(), true);
        }
        if (response instanceof CommerceViews.PaymentCallbackView value) {
            return new CommerceViews.PaymentCallbackView(value.providerEventId(), value.orderId(), "DUPLICATE", true, value.orderStatus(), value.entitlementId());
        }
        if (response instanceof CommerceViews.RefundCallbackView value) {
            return new CommerceViews.RefundCallbackView(value.providerEventId(), value.refundId(), "DUPLICATE", true, value.refundStatus(), value.orderStatus());
        }
        return response;
    }

    private void audit(CommercePrincipal principal, String action, String aggregateType, String aggregateId,
            String outcome, Map<String, String> attributes) {
        auditSystem(principal.tenantId(), action, aggregateType, aggregateId, outcome, attributes, principal.subjectId());
    }

    private void auditSystem(String tenantId, String action, String aggregateType, String aggregateId,
            String outcome, Map<String, String> attributes) {
        auditSystem(tenantId, action, aggregateType, aggregateId, outcome, attributes, "system");
    }

    private void auditSystem(String tenantId, String action, String aggregateType, String aggregateId,
            String outcome, Map<String, String> attributes, String actorRef) {
        audit.append(new AuditPort.AuditRecord(newId("audit"), tenantId, actorRef, action, aggregateType, aggregateId, outcome, clock.now(), attributes));
    }

    private void emit(String tenantId, String aggregateType, String aggregateId, String eventType, Map<String, String> payload) {
        outbox.append(new OutboxPort.Event(newId("evt"), tenantId, aggregateType, aggregateId, eventType, 1, clock.now(), payload));
    }

    private String generateActivationCode() {
        byte[] bytes = new byte[18];
        random.nextBytes(bytes);
        return "EF-" + HexFormat.of().formatHex(bytes).toUpperCase();
    }

    private String newId(String prefix) { return prefix + "_" + UUID.randomUUID(); }

    private static String fingerprint(String... values) {
        return hash(String.join("\u001f", values == null ? new String[0] : values));
    }

    private static String hash(String value) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException(exception);
        }
    }

    private CommerceViews.SkuView skuView(Sku sku) {
        return new CommerceViews.SkuView(sku.skuId(), sku.version(), sku.title(), sku.entitlementCode(), sku.currency(), sku.amountMinor(), sku.status(), sku.effectiveFrom());
    }

    private CommerceViews.OrderView orderView(Order order) {
        PriceSnapshot price = order.priceSnapshot();
        return new CommerceViews.OrderView(order.orderId(), price.skuId(), price.skuVersion(), order.subjectId(), price.currency(), price.amountMinor(), order.status(), order.provider(), order.createdAt(), order.updatedAt(), order.paidAt());
    }

    private CommerceViews.EntitlementView entitlementView(Entitlement entitlement) {
        PriceSnapshot price = entitlement.priceSnapshot();
        return new CommerceViews.EntitlementView(entitlement.entitlementId(), entitlement.skuId(), entitlement.entitlementCode(), entitlement.sourceType(), entitlement.status(), price.currency(), price.amountMinor(), entitlement.activeFrom(), entitlement.expiresAt(), entitlement.reasonCode());
    }

    private CommerceViews.RefundView refundView(Refund refund) {
        return new CommerceViews.RefundView(refund.refundId(), refund.orderId(), refund.status(), refund.currency(), refund.amountMinor(), refund.reasonCode(), refund.status() != RefundStatus.COMPLETED);
    }

    private static Map<String, String> entitlementEventPayload(Entitlement entitlement, String activationReason) {
        Map<String, String> payload = new LinkedHashMap<>();
        payload.put("entitlementId", entitlement.entitlementId());
        payload.put("entitlementCode", entitlement.entitlementCode());
        payload.put("sourceRef", entitlement.sourceRef());
        payload.put("startsAt", entitlement.activeFrom().toString());
        if (entitlement.expiresAt() != null) payload.put("expiresAt", entitlement.expiresAt().toString());
        payload.put("activationReason", activationReason);
        return payload;
    }
}
