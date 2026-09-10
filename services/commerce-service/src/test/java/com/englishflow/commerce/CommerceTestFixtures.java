package com.englishflow.commerce;

import com.englishflow.commerce.adapter.memory.HmacPaymentSignatureVerifier;
import com.englishflow.commerce.adapter.memory.InMemoryAuditPort;
import com.englishflow.commerce.adapter.memory.InMemoryCommerceStore;
import com.englishflow.commerce.adapter.memory.InMemoryIdempotencyPort;
import com.englishflow.commerce.adapter.memory.InMemoryOutboxPort;
import com.englishflow.commerce.adapter.memory.SandboxPaymentProvider;
import com.englishflow.commerce.application.CommerceApplicationService;
import com.englishflow.commerce.application.CommerceCommands.CreateOrder;
import com.englishflow.commerce.application.CommerceCommands.PaymentCallback;
import com.englishflow.commerce.application.CommerceCommands.RefundCallback;
import com.englishflow.commerce.application.CommerceCommands.StartPayment;
import com.englishflow.commerce.application.PaymentPayloads;
import com.englishflow.commerce.application.ports.CommerceClock;
import com.englishflow.commerce.application.ports.PaymentProviderRegistry;
import com.englishflow.commerce.application.security.CommerceAccessPolicy;
import com.englishflow.commerce.domain.CommercePrincipal;
import com.englishflow.commerce.domain.PaymentGate;
import com.englishflow.commerce.domain.PaymentProvider;
import com.englishflow.commerce.domain.Sku;
import com.englishflow.commerce.domain.SkuStatus;
import java.time.Instant;
import java.util.List;

/** Shared, dependency-free fixtures for commerce-service unit tests. */
public final class CommerceTestFixtures {
    public static final String TENANT_A = "tenant-a";
    public static final String TENANT_B = "tenant-b";
    public static final String SKU = "pro-monthly-v2";
    public static final String SECRET = "test-secret";
    public static final Instant NOW = Instant.parse("2026-01-01T00:00:00Z");
    public static final long AMOUNT = 9900L;

    private CommerceTestFixtures() { }

    public static CommercePrincipal staff() {
        return CommercePrincipal.staff(TENANT_A, "finance-1",
                "commerce:sku:write", "commerce:activation:write", "commerce:reconciliation:read");
    }

    public static CommercePrincipal user() {
        return CommercePrincipal.user(TENANT_A, "user-1",
                "commerce:order:read", "commerce:order:write", "commerce:payment:write",
                "commerce:entitlement:read", "commerce:activation:redeem", "commerce:refund:write");
    }

    public static CommercePrincipal otherTenantUser() {
        return CommercePrincipal.user(TENANT_B, "user-2",
                "commerce:order:read", "commerce:order:write", "commerce:payment:write",
                "commerce:entitlement:read", "commerce:activation:redeem", "commerce:refund:write");
    }

    public static Sku sku(String tenantId, String skuId, int version, long amount, Instant at) {
        return new Sku(tenantId, skuId, version, "Pro Monthly", "PRO_MONTHLY", "CNY", amount, SkuStatus.ACTIVE, at);
    }

    /** Clock whose value can be advanced between calls. */
    public static final class MutableClock implements CommerceClock {
        private Instant value;
        public MutableClock(Instant value) { this.value = value; }
        @Override public Instant now() { return value; }
        public void set(Instant value) { this.value = value; }
    }

    /** Wires the in-memory ports + sandbox provider onto a single application service. */
    public static final class Bundle {
        public final InMemoryCommerceStore store;
        public final InMemoryIdempotencyPort idempotency;
        public final InMemoryAuditPort audit;
        public final InMemoryOutboxPort outbox;
        public final HmacPaymentSignatureVerifier verifier;
        public final SandboxPaymentProvider sandbox;
        public final MutableClock clock;
        public final CommerceApplicationService service;

        public Bundle(PaymentGate gate) {
            this.store = new InMemoryCommerceStore();
            this.idempotency = new InMemoryIdempotencyPort();
            this.audit = new InMemoryAuditPort();
            this.outbox = new InMemoryOutboxPort();
            this.verifier = new HmacPaymentSignatureVerifier(SECRET);
            this.sandbox = new SandboxPaymentProvider(verifier);
            this.clock = new MutableClock(NOW);
            this.service = new CommerceApplicationService(store, idempotency, audit, outbox,
                    new PaymentProviderRegistry(List.of(sandbox)), new CommerceAccessPolicy(), gate, clock);
        }

        public void seedCatalog() {
            service.registerSku(staff(), sku(TENANT_A, SKU, 1, AMOUNT, NOW));
        }

        /** Creates an order and a PENDING payment attempt for the sandbox provider. */
        public String openOrder(String orderKey, String payKey) {
            var order = service.createOrder(user(), new CreateOrder(SKU), orderKey);
            service.startPayment(user(), new StartPayment(order.orderId(), PaymentProvider.SANDBOX), payKey);
            return order.orderId();
        }
    }

    public static PaymentCallback paymentCallback(SandboxPaymentProvider sandbox, String orderId, String eventId, long amount, String resultCode) {
        PaymentCallback unsigned = new PaymentCallback(eventId, orderId, PaymentProvider.SANDBOX, amount, "CNY", "", "", resultCode);
        String payload = PaymentPayloads.payment(unsigned);
        return new PaymentCallback(eventId, orderId, PaymentProvider.SANDBOX, amount, "CNY", payload, sandbox.sign(payload), resultCode);
    }

    public static RefundCallback refundCallback(SandboxPaymentProvider sandbox, String refundId, String eventId, long amount, String resultCode) {
        RefundCallback unsigned = new RefundCallback(eventId, refundId, PaymentProvider.SANDBOX, amount, "CNY", "", "", resultCode);
        String payload = PaymentPayloads.refund(unsigned);
        return new RefundCallback(eventId, refundId, PaymentProvider.SANDBOX, amount, "CNY", payload, sandbox.sign(payload), resultCode);
    }

    /** Rebuilds an application service on the same in-memory ports but with a different gate. */
    public static CommerceApplicationService reopen(Bundle bundle, PaymentGate gate) {
        return new CommerceApplicationService(bundle.store, bundle.idempotency, bundle.audit, bundle.outbox,
                new PaymentProviderRegistry(List.of(bundle.sandbox)), new CommerceAccessPolicy(), gate, bundle.clock);
    }
}
