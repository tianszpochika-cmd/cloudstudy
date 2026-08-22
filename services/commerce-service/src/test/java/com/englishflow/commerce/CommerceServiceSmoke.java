package com.englishflow.commerce;

import com.englishflow.commerce.adapter.memory.HmacPaymentSignatureVerifier;
import com.englishflow.commerce.adapter.memory.InMemoryAuditPort;
import com.englishflow.commerce.adapter.memory.InMemoryCommerceStore;
import com.englishflow.commerce.adapter.memory.InMemoryIdempotencyPort;
import com.englishflow.commerce.adapter.memory.InMemoryOutboxPort;
import com.englishflow.commerce.adapter.memory.SandboxPaymentProvider;
import com.englishflow.commerce.application.CommerceApplicationService;
import com.englishflow.commerce.application.CommerceCommands.CreateOrder;
import com.englishflow.commerce.application.CommerceCommands.IssueActivationCode;
import com.englishflow.commerce.application.CommerceCommands.PaymentCallback;
import com.englishflow.commerce.application.CommerceCommands.RefundCallback;
import com.englishflow.commerce.application.CommerceCommands.RedeemActivationCode;
import com.englishflow.commerce.application.CommerceCommands.RequestRefund;
import com.englishflow.commerce.application.CommerceCommands.StartPayment;
import com.englishflow.commerce.application.PaymentPayloads;
import com.englishflow.commerce.application.ports.CommerceClock;
import com.englishflow.commerce.application.ports.PaymentProviderPort;
import com.englishflow.commerce.application.ports.PaymentProviderRegistry;
import com.englishflow.commerce.application.security.CommerceAccessPolicy;
import com.englishflow.commerce.domain.CommerceException;
import com.englishflow.commerce.domain.CommercePrincipal;
import com.englishflow.commerce.domain.CommerceStateMachine;
import com.englishflow.commerce.domain.CommerceViews;
import com.englishflow.commerce.domain.EntitlementStatus;
import com.englishflow.commerce.domain.OrderStatus;
import com.englishflow.commerce.domain.PaymentAttemptStatus;
import com.englishflow.commerce.domain.PaymentGate;
import com.englishflow.commerce.domain.PaymentProvider;
import com.englishflow.commerce.domain.PriceSnapshot;
import com.englishflow.commerce.domain.RefundStatus;
import com.englishflow.commerce.domain.Sku;
import com.englishflow.commerce.domain.SkuStatus;
import java.time.Instant;
import java.util.List;
import java.util.Set;

/**
 * Dependency-free B13-COM-001/002 smoke. Compile main domain + adapters and this class with Java 24.
 */
public final class CommerceServiceSmoke {
    private static final String TENANT_A = "tenant-a";
    private static final String TENANT_B = "tenant-b";
    private static final String SKU = "pro-monthly-v2";
    private static final Instant NOW = Instant.parse("2026-01-01T00:00:00Z");

    public static void main(String[] args) {
        InMemoryCommerceStore store = new InMemoryCommerceStore();
        InMemoryIdempotencyPort idempotency = new InMemoryIdempotencyPort();
        InMemoryAuditPort audit = new InMemoryAuditPort();
        InMemoryOutboxPort outbox = new InMemoryOutboxPort();
        HmacPaymentSignatureVerifier verifier = new HmacPaymentSignatureVerifier("smoke-secret");
        SandboxPaymentProvider sandbox = new SandboxPaymentProvider(verifier);
        PaymentProviderRegistry registry = new PaymentProviderRegistry(List.<PaymentProviderPort>of(sandbox));
        CommerceClock clock = () -> NOW;
        CommercePrincipal staff = CommercePrincipal.staff(TENANT_A, "finance-1",
                "commerce:sku:write", "commerce:activation:write", "commerce:reconciliation:read");
        CommercePrincipal user = CommercePrincipal.user(TENANT_A, "user-1",
                "commerce:order:read", "commerce:order:write", "commerce:payment:write",
                "commerce:entitlement:read", "commerce:activation:redeem", "commerce:refund:write");
        CommercePrincipal otherTenant = CommercePrincipal.user(TENANT_B, "user-2",
                "commerce:order:read", "commerce:order:write", "commerce:payment:write",
                "commerce:entitlement:read", "commerce:activation:redeem", "commerce:refund:write");

        CommerceApplicationService closed = service(store, idempotency, audit, outbox, registry, clock, PaymentGate.disabled());
        CommerceStateMachine.requireEntitlementTransition(EntitlementStatus.PENDING, EntitlementStatus.ACTIVE);
        expectCode("ENTITLEMENT_STATE_INVALID", () -> CommerceStateMachine.requireEntitlementTransition(EntitlementStatus.ACTIVE, EntitlementStatus.PENDING));
        closed.registerSku(staff, sku(TENANT_A, SKU, 1, 9900));
        expectCode("SKU_IMMUTABLE", () -> closed.registerSku(staff, sku(TENANT_A, SKU, 1, 1)));

        CommerceViews.OrderView closedOrder = closed.createOrder(user, new CreateOrder(SKU), "order-key-001");
        CommerceViews.OrderView replayOrder = closed.createOrder(user, new CreateOrder(SKU), "order-key-001");
        check(closedOrder.orderId().equals(replayOrder.orderId()), "create order must be idempotent");
        check(closedOrder.amountMinor() == 9900, "order must capture the immutable price snapshot");
        CommerceViews.PaymentStartView gateClosed = closed.startPayment(user,
                new StartPayment(closedOrder.orderId(), PaymentProvider.SANDBOX), "pay-key-001");
        check(gateClosed.status() == PaymentAttemptStatus.DISABLED && gateClosed.recoverable(), "payment Gate must be disabled by default");
        PaymentCallback gatePaymentCallback = callback(closedOrder.orderId(), "payment-event-gate-001", 9900, "SUCCESS", sandbox);
        CommerceViews.PaymentCallbackView gateCallback = closed.receivePaymentCallback(gatePaymentCallback);
        check("GATE_REJECTED".equals(gateCallback.state()) && closed.listEntitlements(user).isEmpty(), "closed Gate must never activate entitlement");
        PaymentCallback closedRealUnsigned = new PaymentCallback("payment-event-real-closed", closedOrder.orderId(),
                PaymentProvider.WECHAT, 9900, "CNY", "", "", "SUCCESS");
        String closedRealPayload = PaymentPayloads.payment(closedRealUnsigned);
        CommerceViews.PaymentCallbackView closedRealCallback = closed.receivePaymentCallback(new PaymentCallback(
                closedRealUnsigned.providerEventId(), closedRealUnsigned.orderId(), closedRealUnsigned.provider(),
                closedRealUnsigned.amountMinor(), closedRealUnsigned.currency(), closedRealPayload, "unverified", closedRealUnsigned.resultCode()));
        check("GATE_REJECTED".equals(closedRealCallback.state()) && closedRealCallback.orderStatus() == OrderStatus.CREATED,
                "a disabled real provider must be rejected safely even without a provider adapter");
        expectCode("RESOURCE_NOT_FOUND", () -> closed.getOrder(otherTenant, closedOrder.orderId()));
        expectCode("UNAUTHORIZED", () -> closed.createOrder(new CommercePrincipal(TENANT_A, "anonymous", Set.of(), false, false, false), new CreateOrder(SKU), "unauth-001"));

        CommerceApplicationService sandboxService = service(store, idempotency, audit, outbox, registry, clock, PaymentGate.sandbox());
        sandboxService.startPayment(user, new StartPayment(closedOrder.orderId(), PaymentProvider.SANDBOX), "pay-key-gate-retry");
        CommerceViews.PaymentCallbackView retriedGateCallback = sandboxService.receivePaymentCallback(gatePaymentCallback);
        check("APPLIED".equals(retriedGateCallback.state()) && retriedGateCallback.orderStatus() == OrderStatus.PAID,
                "a Gate-rejected callback must remain retryable after the Gate opens");

        CommerceViews.OrderView paidOrder = sandboxService.createOrder(user, new CreateOrder(SKU), "order-key-002");
        CommerceViews.PaymentStartView pending = sandboxService.startPayment(user,
                new StartPayment(paidOrder.orderId(), PaymentProvider.SANDBOX), "pay-key-002");
        check(pending.status() == PaymentAttemptStatus.PENDING, "sandbox payment must enter PENDING");

        PaymentCallback acceptedCommand = callback(paidOrder.orderId(), "payment-event-001", 9900, "SUCCESS", sandbox);
        CommerceViews.PaymentCallbackView accepted = sandboxService.receivePaymentCallback(acceptedCommand);
        check("APPLIED".equals(accepted.state()) && accepted.orderStatus() == OrderStatus.PAID, "verified payment must settle order");
        CommerceViews.PaymentCallbackView duplicate = sandboxService.receivePaymentCallback(acceptedCommand);
        check(duplicate.replayed() && "DUPLICATE".equals(duplicate.state()), "duplicate provider callback must replay stored result");
        PaymentCallback rebound = callback(paidOrder.orderId(), "payment-event-001", 9800, "SUCCESS", sandbox);
        expectCode("PAYMENT_CALLBACK_REPLAY_CONFLICT", () -> sandboxService.receivePaymentCallback(rebound));

        CommerceViews.OrderView amountOrder = sandboxService.createOrder(user, new CreateOrder(SKU), "order-key-003");
        sandboxService.startPayment(user, new StartPayment(amountOrder.orderId(), PaymentProvider.SANDBOX), "pay-key-003");
        expectCode("PAYMENT_AMOUNT_MISMATCH", () -> sandboxService.receivePaymentCallback(callback(amountOrder.orderId(), "payment-event-002", 9800, "SUCCESS", sandbox)));

        CommerceViews.OrderView badSignatureOrder = sandboxService.createOrder(user, new CreateOrder(SKU), "order-key-004");
        sandboxService.startPayment(user, new StartPayment(badSignatureOrder.orderId(), PaymentProvider.SANDBOX), "pay-key-004");
        PaymentCallback invalid = callback(badSignatureOrder.orderId(), "payment-event-003", 9900, "SUCCESS", sandbox);
        expectCode("PAYMENT_SIGNATURE_INVALID", () -> sandboxService.receivePaymentCallback(new PaymentCallback(invalid.providerEventId(), invalid.orderId(), invalid.provider(), invalid.amountMinor(), invalid.currency(), invalid.payload(), "sha256=00", invalid.resultCode())));

        CommerceViews.OrderView recoverableOrder = sandboxService.createOrder(user, new CreateOrder(SKU), "order-key-005");
        sandboxService.startPayment(user, new StartPayment(recoverableOrder.orderId(), PaymentProvider.SANDBOX), "pay-key-005");
        CommerceViews.PaymentStartView recovered = sandboxService.recoverPayment(user, recoverableOrder.orderId(), "recover-key-005");
        check(recovered.status() == PaymentAttemptStatus.PENDING, "pending payment must have a recovery path");
        check(sandboxService.cancelOrder(user, recoverableOrder.orderId(), "cancel-key-005").status() == OrderStatus.CANCELLED, "pending order must be cancellable");

        CommerceViews.ActivationCodeIssueView issued = sandboxService.issueActivationCode(staff,
                new IssueActivationCode(SKU, NOW.plusSeconds(3600)), "activation-issue-01");
        CommerceViews.ActivationRedeemView redeemed = sandboxService.redeemActivationCode(user,
                new RedeemActivationCode(issued.code()), "activation-redeem-01");
        check("REDEEMED".equals(redeemed.state()), "activation code must grant entitlement");
        check(sandboxService.redeemActivationCode(user, new RedeemActivationCode(issued.code()), "activation-redeem-01").replayed(), "activation redemption must be idempotent");
        expectCode("ACTIVATION_CODE_UNAVAILABLE", () -> sandboxService.redeemActivationCode(user, new RedeemActivationCode(issued.code()), "activation-redeem-02"));

        CommerceViews.RefundView requested = sandboxService.requestRefund(user, new RequestRefund(paidOrder.orderId(), "USER_REQUEST"), "refund-key-001");
        check(requested.status() == RefundStatus.PROCESSING, "sandbox refund must enter PROCESSING");
        RefundCallback refundCallback = refundCallback(requested.refundId(), "refund-event-001", requested.amountMinor(), "SUCCESS", sandbox);
        CommerceViews.RefundCallbackView refundCompleted = sandboxService.receiveRefundCallback(refundCallback);
        check(refundCompleted.refundStatus() == RefundStatus.COMPLETED && refundCompleted.orderStatus() == OrderStatus.REFUNDED, "refund must compensate order and entitlement");
        check(sandboxService.receiveRefundCallback(refundCallback).replayed(), "duplicate refund callback must be idempotent");
        check("MATCH".equals(sandboxService.reconcileOrder(staff, paidOrder.orderId()).state()), "settled order must reconcile");

        CommerceViews.OrderView gateRefundOrder = sandboxService.createOrder(user, new CreateOrder(SKU), "order-key-gate-refund");
        sandboxService.startPayment(user, new StartPayment(gateRefundOrder.orderId(), PaymentProvider.SANDBOX), "pay-key-gate-refund");
        sandboxService.receivePaymentCallback(callback(gateRefundOrder.orderId(), "payment-event-gate-refund", 9900, "SUCCESS", sandbox));
        CommerceViews.RefundView gateRefund = closed.requestRefund(user,
                new RequestRefund(gateRefundOrder.orderId(), "GATE_RETRY"), "refund-key-gate-retry");
        RefundCallback gateRefundCallback = refundCallback(gateRefund.refundId(), "refund-event-gate-retry", 9900, "SUCCESS", sandbox);
        CommerceViews.RefundCallbackView rejectedRefund = closed.receiveRefundCallback(gateRefundCallback);
        check("GATE_REJECTED".equals(rejectedRefund.state()) && rejectedRefund.refundStatus() == RefundStatus.REQUESTED,
                "closed Gate must not settle a refund callback");
        CommerceViews.RefundCallbackView retriedRefund = sandboxService.receiveRefundCallback(gateRefundCallback);
        check(retriedRefund.refundStatus() == RefundStatus.COMPLETED && retriedRefund.orderStatus() == OrderStatus.REFUNDED,
                "a Gate-rejected refund callback must remain retryable after the Gate opens");

        CommerceViews.OrderView failedRefundOrder = sandboxService.createOrder(user, new CreateOrder(SKU), "order-key-failed-refund");
        sandboxService.startPayment(user, new StartPayment(failedRefundOrder.orderId(), PaymentProvider.SANDBOX), "pay-key-failed-refund");
        sandboxService.receivePaymentCallback(callback(failedRefundOrder.orderId(), "payment-event-failed-refund", 9900, "SUCCESS", sandbox));
        CommerceViews.RefundView failedRefund = sandboxService.requestRefund(user,
                new RequestRefund(failedRefundOrder.orderId(), "PROVIDER_FAILURE"), "refund-key-failed-refund");
        CommerceViews.RefundCallbackView refundFailure = sandboxService.receiveRefundCallback(
                refundCallback(failedRefund.refundId(), "refund-event-failed", 9900, "FAILED", sandbox));
        check(refundFailure.refundStatus() == RefundStatus.FAILED && refundFailure.orderStatus() == OrderStatus.REFUND_FAILED,
                "a failed refund must leave an explicit recoverable state");
        CommerceViews.RefundView retriedRefundRequest = sandboxService.requestRefund(user,
                new RequestRefund(failedRefundOrder.orderId(), "RETRY"), "refund-key-failed-retry");
        CommerceViews.RefundCallbackView recoveredRefund = sandboxService.receiveRefundCallback(
                refundCallback(retriedRefundRequest.refundId(), "refund-event-recovered", 9900, "SUCCESS", sandbox));
        check(recoveredRefund.refundStatus() == RefundStatus.COMPLETED && recoveredRefund.orderStatus() == OrderStatus.REFUNDED,
                "a failed refund must be recoverable with a new refund attempt");

        check(!audit.records().isEmpty(), "business actions must produce audit records");
        check(!outbox.events().isEmpty(), "business facts must expose an outbox seam");
        check(outbox.events().stream().flatMap(event -> event.payload().values().stream()).noneMatch(value -> value.contains("smoke-secret")), "outbox must not expose payment secrets");
        System.out.println("commerce-service B13-COM-001/002 smoke: PASS");
    }

    private static CommerceApplicationService service(InMemoryCommerceStore store, InMemoryIdempotencyPort idempotency,
            InMemoryAuditPort audit, InMemoryOutboxPort outbox, PaymentProviderRegistry registry, CommerceClock clock, PaymentGate gate) {
        return new CommerceApplicationService(store, idempotency, audit, outbox, registry, new CommerceAccessPolicy(), gate, clock);
    }

    private static Sku sku(String tenant, String id, int version, long amount) {
        return new Sku(tenant, id, version, "Pro Monthly", "PRO_MONTHLY", "CNY", amount, SkuStatus.ACTIVE, NOW);
    }

    private static PaymentCallback callback(String orderId, String eventId, long amount, String resultCode, SandboxPaymentProvider sandbox) {
        PaymentCallback unsigned = new PaymentCallback(eventId, orderId, PaymentProvider.SANDBOX, amount, "CNY", "", "", resultCode);
        String payload = PaymentPayloads.payment(unsigned);
        return new PaymentCallback(eventId, orderId, PaymentProvider.SANDBOX, amount, "CNY", payload, sandbox.sign(payload), resultCode);
    }

    private static RefundCallback refundCallback(String refundId, String eventId, long amount, String resultCode, SandboxPaymentProvider sandbox) {
        RefundCallback unsigned = new RefundCallback(eventId, refundId, PaymentProvider.SANDBOX, amount, "CNY", "", "", resultCode);
        String payload = PaymentPayloads.refund(unsigned);
        return new RefundCallback(eventId, refundId, PaymentProvider.SANDBOX, amount, "CNY", payload, sandbox.sign(payload), resultCode);
    }

    private static void expectCode(String code, Runnable action) {
        try {
            action.run();
            throw new AssertionError("expected " + code);
        } catch (CommerceException exception) {
            if (!code.equals(exception.code())) throw new AssertionError("expected " + code + " but got " + exception.code(), exception);
        }
    }

    private static void check(boolean condition, String message) {
        if (!condition) throw new AssertionError(message);
    }
}
