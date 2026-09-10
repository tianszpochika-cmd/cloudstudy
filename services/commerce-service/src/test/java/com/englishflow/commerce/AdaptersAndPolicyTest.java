package com.englishflow.commerce;

import com.englishflow.commerce.adapter.failclosed.FailClosedAuditPort;
import com.englishflow.commerce.adapter.failclosed.FailClosedCommerceStore;
import com.englishflow.commerce.adapter.failclosed.FailClosedIdempotencyPort;
import com.englishflow.commerce.adapter.failclosed.FailClosedOutboxPort;
import com.englishflow.commerce.application.ports.AuditPort;
import com.englishflow.commerce.application.ports.IdempotencyPort;
import com.englishflow.commerce.application.ports.OutboxPort;
import com.englishflow.commerce.application.ports.PaymentProviderRegistry;
import com.englishflow.commerce.application.security.CommerceAccessPolicy;
import com.englishflow.commerce.domain.CommerceException;
import com.englishflow.commerce.domain.CommercePrincipal;
import com.englishflow.commerce.domain.EntitlementStatus;
import com.englishflow.commerce.domain.OrderStatus;
import com.englishflow.commerce.domain.PaymentGate;
import com.englishflow.commerce.domain.PaymentAttemptStatus;
import com.englishflow.commerce.domain.PaymentProvider;
import com.englishflow.commerce.domain.RefundStatus;
import com.englishflow.commerce.domain.SkuStatus;
import java.time.Instant;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** Fail-closed adapters, provider registry and the default-deny access policy. */
class AdaptersAndPolicyTest {
    private static final Instant NOW = Instant.parse("2026-01-01T00:00:00Z");

    private static void assertFailClosed(String code, Runnable action) {
        CommerceException ex = assertThrows(CommerceException.class, action::run);
        assertEquals(code, ex.code());
    }

    @Test
    void failClosedCommerceStoreNeverReturnsEmptyOrNull() {
        FailClosedCommerceStore store = new FailClosedCommerceStore(null);
        assertFailClosed("COMMERCE_PERSISTENCE_REQUIRED", () -> store.findSku("t", "s"));
        assertFailClosed("COMMERCE_PERSISTENCE_REQUIRED", () -> store.listSkus("t"));
        assertFailClosed("COMMERCE_PERSISTENCE_REQUIRED", () -> store.saveSku(sampleSku()));
        assertFailClosed("COMMERCE_PERSISTENCE_REQUIRED", () -> store.findOrder("t", "o"));
        assertFailClosed("COMMERCE_PERSISTENCE_REQUIRED", () -> store.findOrderById("o"));
        assertFailClosed("COMMERCE_PERSISTENCE_REQUIRED", () -> store.saveOrder(sampleOrder()));
        assertFailClosed("COMMERCE_PERSISTENCE_REQUIRED", () -> store.listOrders("t", "s"));
        assertFailClosed("COMMERCE_PERSISTENCE_REQUIRED", () -> store.findPaymentAttempt("t", "a"));
        assertFailClosed("COMMERCE_PERSISTENCE_REQUIRED", () -> store.listPaymentAttempts("t", "o"));
        assertFailClosed("COMMERCE_PERSISTENCE_REQUIRED", () -> store.savePaymentAttempt(sampleAttempt()));
        assertFailClosed("COMMERCE_PERSISTENCE_REQUIRED", () -> store.findPaymentCallback("t", "SANDBOX", "e"));
        assertFailClosed("COMMERCE_PERSISTENCE_REQUIRED", () -> store.savePaymentCallback(samplePaymentReceipt()));
        assertFailClosed("COMMERCE_PERSISTENCE_REQUIRED", () -> store.listEntitlements("t", "s"));
        assertFailClosed("COMMERCE_PERSISTENCE_REQUIRED", () -> store.findEntitlementBySource("t", "s", "ORDER", "o"));
        assertFailClosed("COMMERCE_PERSISTENCE_REQUIRED", () -> store.saveEntitlement(sampleEntitlement()));
        assertFailClosed("COMMERCE_PERSISTENCE_REQUIRED", () -> store.findActivationCode("t", "hash"));
        assertFailClosed("COMMERCE_PERSISTENCE_REQUIRED", () -> store.saveActivationCode(sampleActivationCode()));
        assertFailClosed("COMMERCE_PERSISTENCE_REQUIRED", () -> store.findRefund("t", "r"));
        assertFailClosed("COMMERCE_PERSISTENCE_REQUIRED", () -> store.findRefundById("r"));
        assertFailClosed("COMMERCE_PERSISTENCE_REQUIRED", () -> store.listRefunds("t", "o"));
        assertFailClosed("COMMERCE_PERSISTENCE_REQUIRED", () -> store.saveRefund(sampleRefund()));
        assertFailClosed("COMMERCE_PERSISTENCE_REQUIRED", () -> store.findRefundCallback("t", "SANDBOX", "e"));
        assertFailClosed("COMMERCE_PERSISTENCE_REQUIRED", () -> store.saveRefundCallback(sampleRefundReceipt()));
    }

    @Test
    void failClosedIdempotencyPortThrows() {
        FailClosedIdempotencyPort port = new FailClosedIdempotencyPort();
        assertFailClosed("COMMERCE_IDEMPOTENCY_UNAVAILABLE",
                () -> port.find("t", "s", "op", "k"));
        assertFailClosed("COMMERCE_IDEMPOTENCY_UNAVAILABLE",
                () -> port.save(new IdempotencyPort.Record("t", "s", "op", "k", "fp", "resp", NOW)));
    }

    @Test
    void failClosedAuditPortThrows() {
        FailClosedAuditPort port = new FailClosedAuditPort();
        assertFailClosed("COMMERCE_AUDIT_UNAVAILABLE", () ->
                port.append(new AuditPort.AuditRecord("a", "t", "s", "act", "TYPE", "id", "OUTCOME", NOW, Map.of())));
    }

    @Test
    void failClosedOutboxPortThrows() {
        FailClosedOutboxPort port = new FailClosedOutboxPort();
        assertFailClosed("COMMERCE_OUTBOX_UNAVAILABLE", () ->
                port.append(new OutboxPort.Event("e", "t", "TYPE", "id", "evt", 1, NOW, Map.of())));
    }

    @Test
    void registryRejectsIncompletePort() {
        CommerceException ex = assertThrows(CommerceException.class,
                () -> new PaymentProviderRegistry(java.util.Collections.singletonList(null)));
        assertEquals("PAYMENT_PROVIDER_INVALID", ex.code());
    }

    @Test
    void registryReturnsUnavailableForMissingProvider() {
        PaymentProviderRegistry registry = new PaymentProviderRegistry(java.util.List.of());
        assertFalse(registry.find(PaymentProvider.SANDBOX).isPresent());
        CommerceException ex = assertThrows(CommerceException.class, () -> registry.require(PaymentProvider.WECHAT));
        assertEquals("PAYMENT_PROVIDER_UNAVAILABLE", ex.code());
    }

    @Test
    void registryResolvesConfiguredProvider() {
        PaymentProviderRegistry registry = new PaymentProviderRegistry(java.util.List.of(
                new CommerceTestFixtures.Bundle(PaymentGate.sandbox()).sandbox));
        assertTrue(registry.find(PaymentProvider.SANDBOX).isPresent());
        assertEquals(PaymentProvider.SANDBOX, registry.require(PaymentProvider.SANDBOX).provider());
    }

    @Test
    void accessPolicyDeniesUnauthenticated() {
        CommerceAccessPolicy policy = new CommerceAccessPolicy();
        CommercePrincipal anonymous = new CommercePrincipal("t", "s", Set.of(), false, false, false);
        CommerceException ex = assertThrows(CommerceException.class,
                () -> policy.requirePermission(anonymous, "commerce:order:read"));
        assertEquals("UNAUTHORIZED", ex.code());
    }

    @Test
    void accessPolicyDeniesMissingPermission() {
        CommerceAccessPolicy policy = new CommerceAccessPolicy();
        CommerceException ex = assertThrows(CommerceException.class,
                () -> policy.requirePermission(CommerceTestFixtures.user(), "commerce:sku:write"));
        assertEquals("FORBIDDEN", ex.code());
    }

    @Test
    void accessPolicyDeniesCrossTenantOwner() {
        CommerceAccessPolicy policy = new CommerceAccessPolicy();
        CommerceException ex = assertThrows(CommerceException.class,
                () -> policy.requireOwner(CommerceTestFixtures.user(), "tenant-b", "user-1"));
        assertEquals("RESOURCE_NOT_FOUND", ex.code());
    }

    @Test
    void accessPolicyAllowsAuthorizedPrincipal() {
        CommerceAccessPolicy policy = new CommerceAccessPolicy();
        policy.requirePermission(CommerceTestFixtures.user(), "commerce:order:read");
        policy.requireOwner(CommerceTestFixtures.user(), "tenant-a", "user-1");
        policy.requireStaff(CommerceTestFixtures.staff(), "commerce:sku:write");
    }

    // --- sample domain objects (valid; fail-closed happens before they are used) ---

    private static com.englishflow.commerce.domain.Sku sampleSku() {
        return new com.englishflow.commerce.domain.Sku("t", "s", 1, "Title", "CODE", "CNY", 9900, SkuStatus.ACTIVE, NOW);
    }

    private static com.englishflow.commerce.domain.Order sampleOrder() {
        return new com.englishflow.commerce.domain.Order("t", "o", "s",
                new com.englishflow.commerce.domain.PriceSnapshot("s", 1, "Title", "CODE", "CNY", 9900, NOW),
                OrderStatus.CREATED, null, NOW, NOW, null);
    }

    private static com.englishflow.commerce.domain.PaymentAttempt sampleAttempt() {
        return new com.englishflow.commerce.domain.PaymentAttempt("t", "a", "o", "s", PaymentProvider.SANDBOX,
                PaymentAttemptStatus.PENDING, 9900, "CNY", "ref", NOW, NOW);
    }

    private static com.englishflow.commerce.domain.PaymentCallbackReceipt samplePaymentReceipt() {
        return new com.englishflow.commerce.domain.PaymentCallbackReceipt("t", PaymentProvider.SANDBOX, "e",
                "o", "hash", 9900, "CNY", "VERIFIED_SUCCESS", NOW);
    }

    private static com.englishflow.commerce.domain.Entitlement sampleEntitlement() {
        return new com.englishflow.commerce.domain.Entitlement("t", "e", "s", "s", "CODE", "ORDER", "o",
                new com.englishflow.commerce.domain.PriceSnapshot("s", 1, "Title", "CODE", "CNY", 9900, NOW),
                EntitlementStatus.ACTIVE, NOW, null, "");
    }

    private static com.englishflow.commerce.domain.ActivationCode sampleActivationCode() {
        return new com.englishflow.commerce.domain.ActivationCode("t", codeHash(), "s",
                new com.englishflow.commerce.domain.PriceSnapshot("s", 1, "Title", "CODE", "CNY", 9900, NOW),
                com.englishflow.commerce.domain.ActivationCodeStatus.AVAILABLE, NOW.plusSeconds(3600), null, null);
    }

    private static com.englishflow.commerce.domain.Refund sampleRefund() {
        return new com.englishflow.commerce.domain.Refund("t", "r", "o", "s", PaymentProvider.SANDBOX,
                9900, "CNY", RefundStatus.REQUESTED, "USER_REQUEST", NOW, NOW, null);
    }

    private static com.englishflow.commerce.domain.RefundCallbackReceipt sampleRefundReceipt() {
        return new com.englishflow.commerce.domain.RefundCallbackReceipt("t", PaymentProvider.SANDBOX, "e",
                "r", "hash", 9900, "CNY", "VERIFIED_SUCCESS", NOW);
    }

    private static String codeHash() {
        try {
            java.security.MessageDigest md = java.security.MessageDigest.getInstance("SHA-256");
            return java.util.HexFormat.of().formatHex(md.digest("secret".getBytes(java.nio.charset.StandardCharsets.UTF_8)));
        } catch (Exception exception) {
            throw new IllegalStateException(exception);
        }
    }
}
