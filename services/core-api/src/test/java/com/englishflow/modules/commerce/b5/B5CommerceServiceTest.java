package com.englishflow.modules.commerce.b5;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.Map;

import com.englishflow.modules.b5.B5Exception;
import org.junit.jupiter.api.Test;

class B5CommerceServiceTest {
    private static final long USER_ID = 42L;
    private static final String HASH = "0000000000000000000000000000000000000000000000000000000000000000";

    @Test
    void orderUsesServerPriceAndPaymentRemainsDisabledByDefault() {
        B5CommerceService service = new B5CommerceService();
        Map<String, Object> order = service.createOrder(USER_ID, Map.of("skuId", "pro-monthly", "priceId", "client-tampered", "channelCode", "WECHAT"), "b5-order-key-001");

        assertEquals("pro-monthly", order.get("skuId"));
        assertEquals(1990L, ((Number) order.get("amountMinor")).longValue());
        Map<String, Object> payment = service.createPaymentAttempt(USER_ID, String.valueOf(order.get("orderId")), Map.of("channelCode", "WECHAT"), "b5-payment-key-001");
        assertEquals("DISABLED", payment.get("status"));
        assertEquals(false, payment.get("paymentEnabled"));
    }

    @Test
    void providerCallbackChecksAmountAndIsIdempotent() {
        B5CommerceService service = new B5CommerceService();
        Map<String, Object> order = service.createOrder(USER_ID, Map.of("skuId", "pro-monthly", "priceId", "pro-monthly-price", "channelCode", "WECHAT"), "b5-order-key-002");
        String orderId = String.valueOf(order.get("orderId"));

        B5Exception mismatch = assertThrows(B5Exception.class, () -> service.receiveWechatCallback(Map.of(
                "callbackEventId", "wechat-event-001", "orderId", orderId, "channelTradeNo", "trade-001",
                "amountMinor", 1, "currency", "CNY", "payloadHash", HASH, "signatureSerial", "sandbox-valid-001")));
        assertEquals("PAYMENT_AMOUNT_MISMATCH", mismatch.code());

        Map<String, Object> callback = service.receiveWechatCallback(Map.of(
                "callbackEventId", "wechat-event-001", "orderId", orderId, "channelTradeNo", "trade-001",
                "amountMinor", 1990, "currency", "CNY", "payloadHash", HASH, "signatureSerial", "sandbox-valid-001"));
        Map<String, Object> replay = service.receiveWechatCallback(Map.of(
                "callbackEventId", "wechat-event-001", "orderId", orderId, "channelTradeNo", "trade-001",
                "amountMinor", 1990, "currency", "CNY", "payloadHash", HASH, "signatureSerial", "sandbox-valid-001"));
        assertSame(callback, replay);
        assertEquals("PAID", callback.get("status"));
        assertEquals(1, service.entitlements(USER_ID).get("items") instanceof java.util.List<?> items ? items.size() : 0);
    }

    @Test
    void appleSandboxVerificationRejectsProductionAndReplaysTransaction() {
        B5CommerceService service = new B5CommerceService();
        Map<String, Object> request = Map.of("transactionId", "apple-tx-001", "originalTransactionId", "apple-original-001", "productId", "pro-monthly", "environment", "Sandbox", "bundleId", "com.englishflow.app", "payloadHash", HASH);
        Map<String, Object> verified = service.verifyAppleTransaction(USER_ID, request);
        Map<String, Object> replay = service.verifyAppleTransaction(USER_ID, request);
        assertSame(verified, replay);
        assertEquals("VERIFIED", verified.get("status"));

        Map<String, Object> production = new java.util.LinkedHashMap<>(request);
        production.put("transactionId", "apple-tx-prod");
        production.put("environment", "Production");
        B5Exception exception = assertThrows(B5Exception.class, () -> service.verifyAppleTransaction(USER_ID, production));
        assertEquals("APPLE_PRODUCTION_DISABLED", exception.code());
    }

    @Test
    void householdHasThreeMemberCeilingAndActivationIsOneTime() {
        B5CommerceService service = new B5CommerceService();
        Map<String, Object> household = service.createHousehold(10L, Map.of(), "b5-household-key-001");
        String householdId = String.valueOf(household.get("householdId"));
        String inviteOne = String.valueOf(service.createInvitation(10L, householdId, Map.of("memberRefHash", HASH), "b5-invite-key-001").get("invitationId"));
        String inviteTwo = String.valueOf(service.createInvitation(10L, householdId, Map.of("memberRefHash", HASH), "b5-invite-key-002").get("invitationId"));
        service.acceptInvitation(11L, Map.of("invitationId", inviteOne), "b5-accept-key-001");
        service.acceptInvitation(12L, Map.of("invitationId", inviteTwo), "b5-accept-key-002");
        B5Exception full = assertThrows(B5Exception.class, () -> service.createInvitation(10L, householdId, Map.of("memberRefHash", HASH), "b5-invite-key-003"));
        assertEquals("HOUSEHOLD_LIMIT_REACHED", full.code());

        Map<String, Object> redeemed = service.redeemActivationCode(20L, "B5-DEMO-PRO", "b5-redeem-key-001");
        assertEquals("REDEEMED", redeemed.get("status"));
        B5Exception consumed = assertThrows(B5Exception.class, () -> service.redeemActivationCode(21L, "B5-DEMO-PRO", "b5-redeem-key-002"));
        assertTrue(consumed.code().startsWith("ACTIVATION_CODE_"));
    }
}
