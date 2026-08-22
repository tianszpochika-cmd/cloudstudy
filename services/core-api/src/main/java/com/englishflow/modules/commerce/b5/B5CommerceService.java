package com.englishflow.modules.commerce.b5;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.time.Instant;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.concurrent.atomic.AtomicLong;

import com.englishflow.modules.b5.B5Exception;
import org.springframework.stereotype.Service;

/**
 * B5 commerce boundary.  It deliberately keeps provider credentials and raw
 * signed payloads outside the Core API.  The in-memory adapter makes the
 * state machine executable before the MySQL/outbox adapter is wired.
 */
@Service
public final class B5CommerceService {
    private static final String CURRENCY = "CNY";
    private final AtomicLong sequence = new AtomicLong(1000);
    private final Map<String, Sku> skus = new LinkedHashMap<>();
    private final ConcurrentMap<String, Order> orders = new ConcurrentHashMap<>();
    private final ConcurrentMap<Long, List<Entitlement>> entitlements = new ConcurrentHashMap<>();
    private final ConcurrentMap<String, Household> households = new ConcurrentHashMap<>();
    private final ConcurrentMap<String, String> invitationToHousehold = new ConcurrentHashMap<>();
    private final ConcurrentMap<String, ActivationCode> activationCodes = new ConcurrentHashMap<>();
    private final ConcurrentMap<String, Map<String, Object>> idempotentResults = new ConcurrentHashMap<>();
    private final ConcurrentMap<String, Map<String, Object>> callbacks = new ConcurrentHashMap<>();
    private final ConcurrentMap<String, Map<String, Object>> appleTransactions = new ConcurrentHashMap<>();
    private final ConcurrentMap<String, Map<String, Object>> invoices = new ConcurrentHashMap<>();

    public B5CommerceService() {
        seedSku("free", "Free", "FREE", 0, "LIFETIME");
        seedSku("pro-monthly", "Pro monthly", "PRO", 1990, "MONTH");
        seedSku("pro-yearly", "Pro yearly", "PRO", 19900, "YEAR");
        seedSku("household-yearly", "Household yearly", "HOUSEHOLD", 29900, "YEAR");
        activationCodes.put(hash("B5-DEMO-PRO"), new ActivationCode("pro-yearly", Instant.now().plus(Duration.ofDays(30))));
    }

    public Map<String, Object> listSkus() {
        List<Map<String, Object>> values = skus.values().stream().map(Sku::view).toList();
        return reply(Map.of("items", values, "paymentChannelsEnabled", false, "sandboxMode", true));
    }

    public Map<String, Object> getSku(String skuId) {
        return reply(requireSku(skuId).view());
    }

    public synchronized Map<String, Object> createOrder(long userId, Map<String, Object> body, String key) {
        requireKey(key);
        String replayKey = "order:" + userId + ":" + key;
        Map<String, Object> replay = idempotentResults.get(replayKey);
        if (replay != null) return replay;
        Sku sku = requireSku(text(body, "skuId", null));
        String requestedPrice = text(body, "priceId", sku.id + "-price");
        String channel = text(body, "channelCode", "WECHAT").toUpperCase();
        if (!List.of("WECHAT", "ALIPAY", "APPLE", "ACTIVATION_CODE").contains(channel)) throw bad("SKU_NOT_PURCHASABLE", "unsupported payment channel");
        Order order = new Order("ord_" + sequence.incrementAndGet(), userId, sku.id, requestedPrice, sku.amountMinor, channel);
        orders.put(order.id, order);
        Map<String, Object> result = reply(order.view());
        idempotentResults.put(replayKey, result);
        return result;
    }

    public Map<String, Object> listOrders(long userId, String cursor, int limit) {
        int bounded = Math.max(1, Math.min(limit, 100));
        List<Map<String, Object>> values = orders.values().stream().filter(order -> order.userId == userId).sorted((a, b) -> b.createdAt.compareTo(a.createdAt)).limit(bounded).map(Order::view).toList();
        return reply(Map.of("items", values, "nextCursor", values.size() == bounded ? "b5-next" : ""));
    }

    public Map<String, Object> getOrder(long userId, String orderId) {
        return reply(requireOrder(userId, orderId).view());
    }

    public synchronized Map<String, Object> createPaymentAttempt(long userId, String orderId, Map<String, Object> body, String key) {
        requireKey(key);
        Order order = requireOrder(userId, orderId);
        String channel = text(body, "channelCode", order.channel).toUpperCase();
        String replayKey = "attempt:" + order.id + ":" + channel + ":" + key;
        Map<String, Object> replay = idempotentResults.get(replayKey);
        if (replay != null) return replay;
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("orderId", order.id);
        data.put("channelCode", channel);
        data.put("paymentEnabled", false);
        data.put("sandboxMode", true);
        if (!"ACTIVATION_CODE".equals(channel)) {
            data.put("status", "DISABLED");
            data.put("errorCode", "PAYMENT_CHANNEL_DISABLED");
            data.put("message", "provider credentials and sandbox verification are not enabled");
        } else {
            data.put("status", "READY");
            data.put("checkoutMode", "ACTIVATION_CODE");
        }
        Map<String, Object> result = reply(data);
        idempotentResults.put(replayKey, result);
        return result;
    }

    public synchronized Map<String, Object> receiveWechatCallback(Map<String, Object> body) { return receiveProviderCallback("WECHAT", body); }
    public synchronized Map<String, Object> receiveAlipayNotify(Map<String, Object> body) { return receiveProviderCallback("ALIPAY", body); }

    private Map<String, Object> receiveProviderCallback(String provider, Map<String, Object> body) {
        String eventId = required(body, "callbackEventId");
        String callbackKey = provider + ":" + eventId;
        Map<String, Object> previous = callbacks.get(callbackKey);
        if (previous != null) return previous;
        String orderId = required(body, "orderId");
        Order order = requireOrderById(orderId);
        long amount = longValue(body.get("amountMinor"), -1);
        if (amount != order.amountMinor) throw conflict("PAYMENT_AMOUNT_MISMATCH", "callback amount does not match order snapshot");
        String payloadHash = required(body, "payloadHash");
        String signatureSerial = required(body, "signatureSerial");
        if (!isSha256(payloadHash) || !signatureSerial.startsWith("sandbox-valid-")) throw conflict("PAYMENT_SIGNATURE_INVALID", "sandbox callback proof is invalid");
        order.status = "PAID";
        order.paidAt = Instant.now();
        activateEntitlement(order.userId, order.skuId, "ORDER", order.id, order.amountMinor);
        Map<String, Object> result = reply(new LinkedHashMap<>(Map.of("provider", provider, "callbackEventId", eventId, "orderId", order.id, "status", order.status, "verificationStatus", "VERIFIED")));
        callbacks.put(callbackKey, result);
        return result;
    }

    public synchronized Map<String, Object> verifyAppleTransaction(long userId, Map<String, Object> body) {
        String transaction = required(body, "transactionId");
        Map<String, Object> previous = appleTransactions.get(transaction);
        if (previous != null) return previous;
        String environment = text(body, "environment", "");
        if (!"Sandbox".equalsIgnoreCase(environment)) throw conflict("APPLE_PRODUCTION_DISABLED", "production Apple verification is disabled until provider readiness approval");
        if (!isSha256(required(body, "payloadHash"))) throw conflict("APPLE_JWS_INVALID", "signed payload hash is invalid");
        String bundleId = required(body, "bundleId");
        if (!"com.englishflow.app".equals(bundleId)) throw conflict("APPLE_BUNDLE_MISMATCH", "bundle id does not match the app contract");
        Sku sku = requireSku(text(body, "productId", "pro-monthly"));
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("transactionId", transaction);
        data.put("originalTransactionId", required(body, "originalTransactionId"));
        data.put("productId", sku.id);
        data.put("environment", "Sandbox");
        data.put("status", "VERIFIED");
        data.put("entitlementCode", sku.entitlementCode);
        data.put("userId", userId);
        activateEntitlement(userId, sku.id, "APPLE", transaction, sku.amountMinor);
        Map<String, Object> result = reply(data);
        appleTransactions.put(transaction, result);
        return result;
    }

    public Map<String, Object> scanAppleRecovery(long userId, Map<String, Object> body) {
        List<Map<String, Object>> recovered = appleTransactions.values().stream().filter(item -> longValue(item.get("userId"), -1) == userId).toList();
        return reply(Map.of("status", "COMPLETED", "items", recovered, "productionScan", false));
    }

    public synchronized Map<String, Object> receiveAppleNotification(Map<String, Object> body) {
        String notificationId = required(body, "callbackEventId");
        Map<String, Object> previous = callbacks.get("APPLE:" + notificationId);
        if (previous != null) return previous;
        Map<String, Object> result = reply(new LinkedHashMap<>(Map.of("notificationId", notificationId, "status", "RECORDED", "payloadHash", required(body, "payloadHash"))));
        callbacks.put("APPLE:" + notificationId, result);
        return result;
    }

    public Map<String, Object> entitlements(long userId) {
        List<Map<String, Object>> values = entitlements.getOrDefault(userId, List.of()).stream().map(Entitlement::view).toList();
        return reply(Map.of("items", values));
    }

    public synchronized Map<String, Object> createHousehold(long userId, Map<String, Object> body, String key) {
        requireKey(key);
        String replayKey = "household:" + userId + ":" + key;
        Map<String, Object> replay = idempotentResults.get(replayKey);
        if (replay != null) return replay;
        Household existing = households.values().stream().filter(value -> value.ownerId == userId && "ACTIVE".equals(value.status)).findFirst().orElse(null);
        if (existing != null) return reply(existing.view());
        Household household = new Household("hsh_" + sequence.incrementAndGet(), userId);
        households.put(household.id, household);
        Map<String, Object> result = reply(household.view());
        idempotentResults.put(replayKey, result);
        return result;
    }

    public synchronized Map<String, Object> createInvitation(long userId, String householdId, Map<String, Object> body, String key) {
        requireKey(key);
        Household household = requireHousehold(householdId);
        if (household.ownerId != userId) throw conflict("HOUSEHOLD_OWNER_REQUIRED", "only household owner may invite members");
        if (household.members.size() >= 3) throw conflict("HOUSEHOLD_LIMIT_REACHED", "household supports at most three active members");
        String invitationId = "inv_" + sequence.incrementAndGet();
        invitationToHousehold.put(invitationId, householdId);
        return reply(Map.of("invitationId", invitationId, "householdId", householdId, "status", "PENDING", "memberRefHash", required(body, "memberRefHash")));
    }

    public synchronized Map<String, Object> acceptInvitation(long userId, Map<String, Object> body, String key) {
        requireKey(key);
        String invitationId = required(body, "invitationId");
        Household household = requireHousehold(invitationToHousehold.get(invitationId));
        if (household.members.size() >= 3) throw conflict("HOUSEHOLD_LIMIT_REACHED", "household supports at most three active members");
        household.members.add(userId);
        invitationToHousehold.remove(invitationId);
        return reply(household.view());
    }

    public synchronized Map<String, Object> removeMember(long userId, String householdId, long memberUserId) {
        Household household = requireHousehold(householdId);
        if (household.ownerId != userId) throw conflict("HOUSEHOLD_OWNER_REQUIRED", "only household owner may remove members");
        household.members.remove(memberUserId);
        return reply(household.view());
    }

    public synchronized Map<String, Object> redeemActivationCode(long userId, String code, String key) {
        requireKey(key);
        String replayKey = "redeem:" + userId + ":" + key;
        Map<String, Object> replay = idempotentResults.get(replayKey);
        if (replay != null) return replay;
        ActivationCode activation = activationCodes.get(hash(code));
        if (activation == null) throw conflict("ACTIVATION_CODE_INVALID", "activation code is invalid");
        if (!"AVAILABLE".equals(activation.status) || activation.expiresAt.isBefore(Instant.now())) throw conflict("ACTIVATION_CODE_EXPIRED", "activation code is unavailable");
        activation.status = "REDEEMED";
        activation.redeemedBy = userId;
        activateEntitlement(userId, activation.skuId, "ACTIVATION_CODE", hash(code), requireSku(activation.skuId).amountMinor);
        Map<String, Object> result = reply(Map.of("status", "REDEEMED", "entitlementCode", requireSku(activation.skuId).entitlementCode, "codeRef", hash(code).substring(0, 12)));
        idempotentResults.put(replayKey, result);
        return result;
    }

    public synchronized Map<String, Object> requestRefund(long userId, String orderId, Map<String, Object> body, String key) {
        requireKey(key);
        Order order = requireOrder(userId, orderId);
        String replayKey = "refund:" + orderId + ":" + key;
        Map<String, Object> replay = idempotentResults.get(replayKey);
        if (replay != null) return replay;
        if (!"PAID".equals(order.status)) throw conflict("REFUND_ORDER_NOT_PAID", "only paid orders can be refunded");
        order.status = "REFUND_PENDING";
        Map<String, Object> result = reply(Map.of("refundId", "rfd_" + sequence.incrementAndGet(), "orderId", orderId, "status", "REQUESTED", "amountMinor", order.amountMinor, "reasonCode", text(body, "reasonCode", "USER_REQUEST")));
        idempotentResults.put(replayKey, result);
        return result;
    }

    public Map<String, Object> listInvoices(long userId) {
        return reply(Map.of("items", invoices.values().stream().filter(value -> longValue(value.get("userId"), -1) == userId).toList()));
    }

    public synchronized Map<String, Object> createInvoice(long userId, Map<String, Object> body, String key) {
        requireKey(key);
        String orderId = required(body, "orderId");
        Order order = requireOrder(userId, orderId);
        String replayKey = "invoice:" + orderId + ":" + key;
        Map<String, Object> replay = idempotentResults.get(replayKey);
        if (replay != null) return replay;
        Map<String, Object> invoice = new LinkedHashMap<>(Map.of("invoiceId", "inv_" + sequence.incrementAndGet(), "orderId", order.id, "userId", userId, "status", "REQUESTED", "invoiceType", text(body, "invoiceType", "PERSONAL")));
        invoice.put("recipientRefHash", required(body, "recipientRefHash"));
        invoices.put(String.valueOf(invoice.get("invoiceId")), invoice);
        Map<String, Object> result = reply(invoice);
        idempotentResults.put(replayKey, result);
        return result;
    }

    public synchronized Map<String, Object> createActivationBatch(long actorId, Map<String, Object> body, String key) {
        requireKey(key);
        String replayKey = "activation-batch:" + actorId + ":" + key;
        Map<String, Object> replay = idempotentResults.get(replayKey);
        if (replay != null) return replay;
        Sku sku = requireSku(text(body, "skuId", null));
        int count = Math.max(1, Math.min((int) longValue(body.get("count"), 1), 10000));
        String batchRef = "bat_" + sequence.incrementAndGet();
        for (int index = 0; index < count; index++) {
            String code = batchRef + "-" + index + "-" + UUID.randomUUID();
            activationCodes.put(hash(code), new ActivationCode(sku.id, Instant.now().plus(Duration.ofDays(30))));
        }
        Map<String, Object> result = reply(Map.of("batchRef", batchRef, "skuId", sku.id, "count", count, "status", "ACTIVE", "codeExportMode", "SECURE_OUT_OF_BAND"));
        idempotentResults.put(replayKey, result);
        return result;
    }

    public synchronized Map<String, Object> revokeActivationCode(String code) {
        ActivationCode activation = activationCodes.get(hash(code));
        if (activation == null) throw notFound("ACTIVATION_CODE_NOT_FOUND", "activation code does not exist");
        activation.status = "REVOKED";
        return reply(Map.of("codeRef", hash(code).substring(0, 12), "status", activation.status));
    }

    public synchronized Map<String, Object> adjustOrder(long actorId, String orderId, Map<String, Object> body, String key) {
        requireKey(key);
        Order order = requireOrderById(orderId);
        String action = text(body, "actionCode", "");
        if ("GRANT_ENTITLEMENT".equals(action)) activateEntitlement(order.userId, order.skuId, "MANUAL", "adjust:" + order.id + ":" + key, order.amountMinor);
        if ("REVOKE_ENTITLEMENT".equals(action)) revokeEntitlement(order.userId, order.skuId, "MANUAL_ADJUSTMENT");
        return reply(Map.of("orderId", order.id, "actionCode", action, "actorId", actorId, "status", "APPLIED"));
    }

    public Map<String, Object> readiness() {
        return reply(Map.of("paymentChannelsEnabled", false, "sandboxMode", true, "providers", Map.of("WECHAT", "OFF", "ALIPAY", "OFF", "APPLE", "SANDBOX_ONLY"), "reasonCode", "PROVIDER_READINESS_PENDING"));
    }

    public Map<String, Object> commerceSnapshot() {
        long paid = orders.values().stream().filter(order -> "PAID".equals(order.status)).count();
        return Map.of("ordersTotal", orders.size(), "ordersPaid", paid, "entitlementsActive", entitlements.values().stream().flatMap(List::stream).filter(value -> "ACTIVE".equals(value.status)).count(), "paymentChannelsEnabled", false);
    }

    public Map<String, Object> listAdminOrders(String cursor, int limit) {
        int bounded = Math.max(1, Math.min(limit, 100));
        return reply(Map.of("items", orders.values().stream().sorted((left, right) -> right.createdAt.compareTo(left.createdAt)).limit(bounded).map(Order::view).toList(), "nextCursor", ""));
    }

    public Map<String, Object> adminEntitlements(long userId) { return entitlements(userId); }

    private void activateEntitlement(long userId, String skuId, String sourceType, String sourceRef, long amountMinor) {
        Sku sku = requireSku(skuId);
        List<Entitlement> userEntitlements = entitlements.computeIfAbsent(userId, ignored -> new ArrayList<>());
        synchronized (userEntitlements) {
            if (userEntitlements.stream().anyMatch(value -> value.sourceRef.equals(sourceRef))) return;
            userEntitlements.removeIf(value -> value.entitlementCode.equals(sku.entitlementCode) && "ACTIVE".equals(value.status) && "APPLE".equals(sourceType));
            userEntitlements.add(new Entitlement(sku.entitlementCode, sourceType, sourceRef, Instant.now(), Instant.now().plus(Duration.ofDays(sku.billingPeriod.equals("MONTH") ? 31 : 366)), amountMinor));
        }
    }

    private void revokeEntitlement(long userId, String skuId, String reason) {
        Sku sku = requireSku(skuId);
        for (Entitlement entitlement : entitlements.getOrDefault(userId, List.of())) if (entitlement.entitlementCode.equals(sku.entitlementCode)) { entitlement.status = "REVOKED"; entitlement.reasonCode = reason; }
    }

    private Sku requireSku(String id) { if (id == null || !skus.containsKey(id)) throw notFound("SKU_NOT_FOUND", "sku does not exist"); return skus.get(id); }
    private Order requireOrder(long userId, String orderId) { Order order = requireOrderById(orderId); if (order.userId != userId) throw notFound("ORDER_NOT_FOUND", "order does not belong to current user"); return order; }
    private Order requireOrderById(String orderId) { Order order = orders.get(orderId); if (order == null) throw notFound("ORDER_NOT_FOUND", "order does not exist"); return order; }
    private Household requireHousehold(String id) { Household household = id == null ? null : households.get(id); if (household == null) throw notFound("HOUSEHOLD_NOT_FOUND", "household does not exist"); return household; }
    private void seedSku(String id, String title, String entitlementCode, long amountMinor, String billingPeriod) { skus.put(id, new Sku(id, title, entitlementCode, amountMinor, billingPeriod)); }
    private static void requireKey(String key) { if (key == null || key.trim().length() < 8) throw bad("IDEMPOTENCY_KEY_REQUIRED", "Idempotency-Key is required"); }
    private static String required(Map<String, Object> body, String key) { String value = text(body, key, null); if (value == null || value.isBlank()) throw bad("SCHEMA_INVALID", key + " is required"); return value; }
    private static String text(Map<String, Object> body, String key, String fallback) { if (body == null || body.get(key) == null) return fallback; String value = String.valueOf(body.get(key)).trim(); return value.isBlank() ? fallback : value; }
    private static long longValue(Object value, long fallback) { if (value == null) return fallback; if (value instanceof Number number) return number.longValue(); try { return Long.parseLong(String.valueOf(value)); } catch (NumberFormatException ignored) { return fallback; } }
    private static boolean isSha256(String value) { return value != null && value.matches("[a-fA-F0-9]{64}"); }
    private static String hash(String value) { try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8))); } catch (NoSuchAlgorithmException exception) { throw new IllegalStateException(exception); } }
    private static String now() { return DateTimeFormatter.ISO_INSTANT.format(Instant.now()); }
    private static Map<String, Object> reply(Map<String, Object> data) { Map<String, Object> result = new LinkedHashMap<>(); result.put("requestId", "req_b5"); result.put("data", data); result.putAll(data); result.put("generatedAt", now()); return result; }
    private static B5Exception bad(String code, String message) { return new B5Exception(code, message, 400, false); }
    private static B5Exception conflict(String code, String message) { return new B5Exception(code, message, 409, false); }
    private static B5Exception notFound(String code, String message) { return new B5Exception(code, message, 404, false); }

    private record Sku(String id, String title, String entitlementCode, long amountMinor, String billingPeriod) {
        Map<String, Object> view() { return Map.of("skuId", id, "title", title, "entitlementCode", entitlementCode, "billingPeriod", billingPeriod, "amountMinor", amountMinor, "currency", CURRENCY, "status", "ACTIVE"); }
    }

    private static final class Order {
        final String id, skuId, priceId, channel;
        final long userId, amountMinor;
        final Instant createdAt = Instant.now();
        Instant paidAt;
        String status = "CREATED";
        Order(String id, long userId, String skuId, String priceId, long amountMinor, String channel) { this.id = id; this.userId = userId; this.skuId = skuId; this.priceId = priceId; this.amountMinor = amountMinor; this.channel = channel; }
        Map<String, Object> view() { Map<String, Object> result = new LinkedHashMap<>(); result.put("orderId", id); result.put("userId", userId); result.put("skuId", skuId); result.put("priceId", priceId); result.put("channelCode", channel); result.put("amountMinor", amountMinor); result.put("currency", CURRENCY); result.put("status", status); result.put("createdAt", createdAt.toString()); result.put("paidAt", paidAt == null ? "" : paidAt.toString()); return result; }
    }

    private static final class Entitlement {
        final String entitlementCode, sourceType, sourceRef;
        final Instant activeFrom, expiresAt;
        final long amountMinor;
        String status = "ACTIVE", reasonCode = "";
        Entitlement(String entitlementCode, String sourceType, String sourceRef, Instant activeFrom, Instant expiresAt, long amountMinor) { this.entitlementCode = entitlementCode; this.sourceType = sourceType; this.sourceRef = sourceRef; this.activeFrom = activeFrom; this.expiresAt = expiresAt; this.amountMinor = amountMinor; }
        Map<String, Object> view() { String effective = expiresAt.isBefore(Instant.now()) ? "EXPIRED" : status; return Map.of("entitlementCode", entitlementCode, "sourceType", sourceType, "sourceRef", sourceRef, "status", effective, "activeFrom", activeFrom.toString(), "expiresAt", expiresAt.toString(), "amountMinor", amountMinor, "reasonCode", reasonCode); }
    }

    private static final class Household {
        final String id;
        final long ownerId;
        final List<Long> members = new ArrayList<>();
        String status = "ACTIVE";
        Household(String id, long ownerId) { this.id = id; this.ownerId = ownerId; members.add(ownerId); }
        Map<String, Object> view() { return Map.of("householdId", id, "ownerUserId", ownerId, "memberUserIds", List.copyOf(members), "memberCount", members.size(), "status", status); }
    }

    private static final class ActivationCode {
        final String skuId;
        final Instant expiresAt;
        String status = "AVAILABLE";
        long redeemedBy;
        ActivationCode(String skuId, Instant expiresAt) { this.skuId = skuId; this.expiresAt = expiresAt; }
    }
}
