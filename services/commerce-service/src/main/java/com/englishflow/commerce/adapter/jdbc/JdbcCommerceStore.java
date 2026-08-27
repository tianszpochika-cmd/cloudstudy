package com.englishflow.commerce.adapter.jdbc;

import com.englishflow.commerce.application.ports.CommerceStore;
import com.englishflow.commerce.domain.ActivationCode;
import com.englishflow.commerce.domain.ActivationCodeStatus;
import com.englishflow.commerce.domain.Entitlement;
import com.englishflow.commerce.domain.EntitlementStatus;
import com.englishflow.commerce.domain.Order;
import com.englishflow.commerce.domain.OrderStatus;
import com.englishflow.commerce.domain.PaymentAttempt;
import com.englishflow.commerce.domain.PaymentAttemptStatus;
import com.englishflow.commerce.domain.PaymentCallbackReceipt;
import com.englishflow.commerce.domain.PaymentProvider;
import com.englishflow.commerce.domain.PriceSnapshot;
import com.englishflow.commerce.domain.Refund;
import com.englishflow.commerce.domain.RefundCallbackReceipt;
import com.englishflow.commerce.domain.RefundStatus;
import com.englishflow.commerce.domain.Sku;
import com.englishflow.commerce.domain.SkuStatus;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * Durable commerce owner for local-real and production-like development runs.
 * The adapter deliberately maps only commerce-owned tables; it never joins a
 * learner, IAM or content schema.
 */
public final class JdbcCommerceStore implements CommerceStore {
    private final JdbcTemplate jdbc;

    public JdbcCommerceStore(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public Optional<Sku> findSku(String tenantId, String skuId) {
        return one("SELECT tenant_id, sku_id, version, title, entitlement_code, currency, amount_minor, status, effective_from "
                + "FROM commerce_sku WHERE tenant_id = ? AND sku_id = ? ORDER BY version DESC LIMIT 1", this::sku, tenantId, skuId);
    }

    @Override
    public void saveSku(Sku value) {
        jdbc.update("INSERT INTO commerce_sku (tenant_id, sku_id, version, title, entitlement_code, currency, amount_minor, status, effective_from, created_at) "
                + "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE title = VALUES(title), entitlement_code = VALUES(entitlement_code), "
                + "currency = VALUES(currency), amount_minor = VALUES(amount_minor), status = VALUES(status), effective_from = VALUES(effective_from)",
                value.tenantId(), value.skuId(), value.version(), value.title(), value.entitlementCode(), value.currency(), value.amountMinor(),
                value.status().name(), timestamp(value.effectiveFrom()), timestamp(value.effectiveFrom()));
    }

    @Override
    public List<Sku> listSkus(String tenantId) {
        return jdbc.query("SELECT s.tenant_id, s.sku_id, s.version, s.title, s.entitlement_code, s.currency, s.amount_minor, s.status, s.effective_from "
                + "FROM commerce_sku s JOIN (SELECT sku_id, MAX(version) version FROM commerce_sku WHERE tenant_id = ? GROUP BY sku_id) latest "
                + "ON latest.sku_id = s.sku_id AND latest.version = s.version WHERE s.tenant_id = ? ORDER BY s.effective_from, s.sku_id",
                this::sku, tenantId, tenantId);
    }

    @Override
    public Optional<Order> findOrder(String tenantId, String orderId) {
        return one(orderSql("tenant_id = ? AND order_id = ?"), this::order, tenantId, orderId);
    }

    @Override
    public Optional<Order> findOrderById(String orderId) {
        return one(orderSql("order_id = ?"), this::order, orderId);
    }

    @Override
    public void saveOrder(Order value) {
        PriceSnapshot price = value.priceSnapshot();
        jdbc.update("INSERT INTO commerce_price_snapshot (tenant_id, sku_id, sku_version, title, entitlement_code, currency, amount_minor, captured_at) "
                + "VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE title = VALUES(title), entitlement_code = VALUES(entitlement_code), "
                + "currency = VALUES(currency), amount_minor = VALUES(amount_minor), captured_at = VALUES(captured_at)",
                value.tenantId(), price.skuId(), price.skuVersion(), price.title(), price.entitlementCode(), price.currency(), price.amountMinor(), timestamp(price.capturedAt()));
        jdbc.update("INSERT INTO commerce_order (tenant_id, order_id, subject_id, sku_id, sku_version, sku_title, entitlement_code, provider, currency, amount_minor, status, created_at, updated_at, paid_at) "
                + "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE provider = VALUES(provider), status = VALUES(status), updated_at = VALUES(updated_at), paid_at = VALUES(paid_at)",
                value.tenantId(), value.orderId(), value.subjectId(), price.skuId(), price.skuVersion(), price.title(), price.entitlementCode(),
                value.provider() == null ? null : value.provider().name(), price.currency(), price.amountMinor(), value.status().name(),
                timestamp(value.createdAt()), timestamp(value.updatedAt()), timestamp(value.paidAt()));
    }

    @Override
    public List<Order> listOrders(String tenantId, String subjectId) {
        return jdbc.query(orderSql("tenant_id = ? AND subject_id = ? ORDER BY created_at DESC"), this::order, tenantId, subjectId);
    }

    @Override
    public Optional<PaymentAttempt> findPaymentAttempt(String tenantId, String attemptId) {
        return one("SELECT tenant_id, attempt_id, order_id, subject_id, provider, status, amount_minor, currency, provider_reference, created_at, updated_at "
                + "FROM commerce_payment_attempt WHERE tenant_id = ? AND attempt_id = ?", this::paymentAttempt, tenantId, attemptId);
    }

    @Override
    public List<PaymentAttempt> listPaymentAttempts(String tenantId, String orderId) {
        return jdbc.query("SELECT tenant_id, attempt_id, order_id, subject_id, provider, status, amount_minor, currency, provider_reference, created_at, updated_at "
                + "FROM commerce_payment_attempt WHERE tenant_id = ? AND order_id = ? ORDER BY created_at DESC", this::paymentAttempt, tenantId, orderId);
    }

    @Override
    public void savePaymentAttempt(PaymentAttempt value) {
        jdbc.update("INSERT INTO commerce_payment_attempt (tenant_id, attempt_id, order_id, subject_id, provider, provider_reference, status, amount_minor, currency, created_at, updated_at) "
                + "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE provider_reference = VALUES(provider_reference), status = VALUES(status), updated_at = VALUES(updated_at)",
                value.tenantId(), value.attemptId(), value.orderId(), value.subjectId(), value.provider().name(), value.providerReference(), value.status().name(),
                value.amountMinor(), value.currency(), timestamp(value.createdAt()), timestamp(value.updatedAt()));
    }

    @Override
    public Optional<PaymentCallbackReceipt> findPaymentCallback(String tenantId, String provider, String providerEventId) {
        return one("SELECT tenant_id, provider, provider_event_id, order_id, payload_hash, amount_minor, currency, verification_state, received_at "
                + "FROM commerce_payment_callback WHERE tenant_id = ? AND provider = ? AND provider_event_id = ?", this::paymentCallback, tenantId, provider, providerEventId);
    }

    @Override
    public void savePaymentCallback(PaymentCallbackReceipt value) {
        jdbc.update("INSERT INTO commerce_payment_callback (tenant_id, provider, provider_event_id, order_id, provider_reference, payload_hash, amount_minor, currency, verification_state, received_at) "
                + "VALUES (?, ?, ?, ?, NULL, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE verification_state = VALUES(verification_state), received_at = VALUES(received_at)",
                value.tenantId(), value.provider().name(), value.providerEventId(), value.orderId(), value.payloadHash(), value.amountMinor(), value.currency(), value.verificationState(), timestamp(value.receivedAt()));
    }

    @Override
    public List<Entitlement> listEntitlements(String tenantId, String subjectId) {
        return jdbc.query("SELECT tenant_id, entitlement_id, subject_id, sku_id, sku_version, sku_title, entitlement_code, source_type, source_ref, currency, amount_minor, status, active_from, expires_at, reason_code "
                + "FROM commerce_entitlement WHERE tenant_id = ? AND subject_id = ? ORDER BY active_from DESC", this::entitlement, tenantId, subjectId);
    }

    @Override
    public Optional<Entitlement> findEntitlementBySource(String tenantId, String subjectId, String sourceType, String sourceRef) {
        return one("SELECT tenant_id, entitlement_id, subject_id, sku_id, sku_version, sku_title, entitlement_code, source_type, source_ref, currency, amount_minor, status, active_from, expires_at, reason_code "
                + "FROM commerce_entitlement WHERE tenant_id = ? AND subject_id = ? AND source_type = ? AND source_ref = ?", this::entitlement, tenantId, subjectId, sourceType, sourceRef);
    }

    @Override
    public void saveEntitlement(Entitlement value) {
        PriceSnapshot price = value.priceSnapshot();
        jdbc.update("INSERT INTO commerce_entitlement (tenant_id, entitlement_id, subject_id, sku_id, sku_version, sku_title, entitlement_code, source_type, source_ref, currency, amount_minor, status, active_from, expires_at, reason_code) "
                + "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE status = VALUES(status), expires_at = VALUES(expires_at), reason_code = VALUES(reason_code)",
                value.tenantId(), value.entitlementId(), value.subjectId(), price.skuId(), price.skuVersion(), price.title(), value.entitlementCode(), value.sourceType(), value.sourceRef(),
                price.currency(), price.amountMinor(), value.status().name(), timestamp(value.activeFrom()), timestamp(value.expiresAt()), value.reasonCode());
    }

    @Override
    public Optional<ActivationCode> findActivationCode(String tenantId, String codeHash) {
        return one("SELECT tenant_id, code_hash, sku_id, sku_version, sku_title, entitlement_code, amount_minor, currency, status, expires_at, redeemed_by, redeemed_at "
                + "FROM commerce_activation_code WHERE tenant_id = ? AND code_hash = ?", this::activationCode, tenantId, codeHash);
    }

    @Override
    public void saveActivationCode(ActivationCode value) {
        PriceSnapshot price = value.priceSnapshot();
        jdbc.update("INSERT INTO commerce_activation_code (tenant_id, code_hash, sku_id, sku_version, sku_title, entitlement_code, amount_minor, currency, status, expires_at, redeemed_by, redeemed_at) "
                + "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE status = VALUES(status), redeemed_by = VALUES(redeemed_by), redeemed_at = VALUES(redeemed_at)",
                value.tenantId(), value.codeHash(), price.skuId(), price.skuVersion(), price.title(), price.entitlementCode(), price.amountMinor(), price.currency(), value.status().name(),
                timestamp(value.expiresAt()), value.redeemedBy(), timestamp(value.redeemedAt()));
    }

    @Override
    public Optional<Refund> findRefund(String tenantId, String refundId) {
        return one(refundSql("tenant_id = ? AND refund_id = ?"), this::refund, tenantId, refundId);
    }

    @Override
    public Optional<Refund> findRefundById(String refundId) {
        return one(refundSql("refund_id = ?"), this::refund, refundId);
    }

    @Override
    public List<Refund> listRefunds(String tenantId, String orderId) {
        return jdbc.query(refundSql("tenant_id = ? AND order_id = ? ORDER BY created_at DESC"), this::refund, tenantId, orderId);
    }

    @Override
    public void saveRefund(Refund value) {
        jdbc.update("INSERT INTO commerce_refund (tenant_id, refund_id, order_id, subject_id, provider, amount_minor, currency, status, reason_code, created_at, updated_at, completed_at) "
                + "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE status = VALUES(status), reason_code = VALUES(reason_code), updated_at = VALUES(updated_at), completed_at = VALUES(completed_at)",
                value.tenantId(), value.refundId(), value.orderId(), value.subjectId(), value.provider().name(), value.amountMinor(), value.currency(), value.status().name(), value.reasonCode(),
                timestamp(value.createdAt()), timestamp(value.updatedAt()), timestamp(value.completedAt()));
    }

    @Override
    public Optional<RefundCallbackReceipt> findRefundCallback(String tenantId, String provider, String providerEventId) {
        return one("SELECT tenant_id, provider, provider_event_id, refund_id, payload_hash, amount_minor, currency, verification_state, received_at "
                + "FROM commerce_refund_callback WHERE tenant_id = ? AND provider = ? AND provider_event_id = ?", this::refundCallback, tenantId, provider, providerEventId);
    }

    @Override
    public void saveRefundCallback(RefundCallbackReceipt value) {
        jdbc.update("INSERT INTO commerce_refund_callback (tenant_id, provider, provider_event_id, refund_id, payload_hash, amount_minor, currency, verification_state, received_at) "
                + "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE verification_state = VALUES(verification_state), received_at = VALUES(received_at)",
                value.tenantId(), value.provider().name(), value.providerEventId(), value.refundId(), value.payloadHash(), value.amountMinor(), value.currency(), value.verificationState(), timestamp(value.receivedAt()));
    }

    private String orderSql(String predicate) {
        return "SELECT tenant_id, order_id, subject_id, sku_id, sku_version, sku_title, entitlement_code, provider, currency, amount_minor, status, created_at, updated_at, paid_at "
                + "FROM commerce_order WHERE " + predicate;
    }

    private String refundSql(String predicate) {
        return "SELECT tenant_id, refund_id, order_id, subject_id, provider, amount_minor, currency, status, reason_code, created_at, updated_at, completed_at "
                + "FROM commerce_refund WHERE " + predicate;
    }

    private Sku sku(ResultSet rs, int row) throws SQLException {
        return new Sku(rs.getString("tenant_id"), rs.getString("sku_id"), rs.getInt("version"), rs.getString("title"), rs.getString("entitlement_code"),
                rs.getString("currency"), rs.getLong("amount_minor"), enumValue(SkuStatus.class, rs.getString("status")), instant(rs.getTimestamp("effective_from")));
    }

    private Order order(ResultSet rs, int row) throws SQLException {
        Instant createdAt = instant(rs.getTimestamp("created_at"));
        PriceSnapshot price = new PriceSnapshot(rs.getString("sku_id"), rs.getInt("sku_version"), rs.getString("sku_title"), rs.getString("entitlement_code"),
                rs.getString("currency"), rs.getLong("amount_minor"), createdAt);
        return new Order(rs.getString("tenant_id"), rs.getString("order_id"), rs.getString("subject_id"), price,
                enumValue(OrderStatus.class, rs.getString("status")), enumValue(PaymentProvider.class, rs.getString("provider")), createdAt,
                instant(rs.getTimestamp("updated_at")), instant(rs.getTimestamp("paid_at")));
    }

    private PaymentAttempt paymentAttempt(ResultSet rs, int row) throws SQLException {
        return new PaymentAttempt(rs.getString("tenant_id"), rs.getString("attempt_id"), rs.getString("order_id"), rs.getString("subject_id"),
                enumValue(PaymentProvider.class, rs.getString("provider")), enumValue(PaymentAttemptStatus.class, rs.getString("status")), rs.getLong("amount_minor"),
                rs.getString("currency"), rs.getString("provider_reference"), instant(rs.getTimestamp("created_at")), instant(rs.getTimestamp("updated_at")));
    }

    private PaymentCallbackReceipt paymentCallback(ResultSet rs, int row) throws SQLException {
        return new PaymentCallbackReceipt(rs.getString("tenant_id"), enumValue(PaymentProvider.class, rs.getString("provider")), rs.getString("provider_event_id"),
                rs.getString("order_id"), rs.getString("payload_hash"), rs.getLong("amount_minor"), rs.getString("currency"), rs.getString("verification_state"), instant(rs.getTimestamp("received_at")));
    }

    private Entitlement entitlement(ResultSet rs, int row) throws SQLException {
        Instant activeFrom = instant(rs.getTimestamp("active_from"));
        PriceSnapshot price = new PriceSnapshot(rs.getString("sku_id"), rs.getInt("sku_version"), rs.getString("sku_title"), rs.getString("entitlement_code"),
                rs.getString("currency"), rs.getLong("amount_minor"), activeFrom);
        return new Entitlement(rs.getString("tenant_id"), rs.getString("entitlement_id"), rs.getString("subject_id"), rs.getString("sku_id"),
                rs.getString("entitlement_code"), rs.getString("source_type"), rs.getString("source_ref"), price,
                enumValue(EntitlementStatus.class, rs.getString("status")), activeFrom, instant(rs.getTimestamp("expires_at")), rs.getString("reason_code"));
    }

    private ActivationCode activationCode(ResultSet rs, int row) throws SQLException {
        Instant expiresAt = instant(rs.getTimestamp("expires_at"));
        PriceSnapshot price = new PriceSnapshot(rs.getString("sku_id"), rs.getInt("sku_version"), rs.getString("sku_title"), rs.getString("entitlement_code"),
                rs.getString("currency"), rs.getLong("amount_minor"), expiresAt);
        return new ActivationCode(rs.getString("tenant_id"), rs.getString("code_hash"), rs.getString("sku_id"), price,
                enumValue(ActivationCodeStatus.class, rs.getString("status")), expiresAt, rs.getString("redeemed_by"), instant(rs.getTimestamp("redeemed_at")));
    }

    private Refund refund(ResultSet rs, int row) throws SQLException {
        return new Refund(rs.getString("tenant_id"), rs.getString("refund_id"), rs.getString("order_id"), rs.getString("subject_id"),
                enumValue(PaymentProvider.class, rs.getString("provider")), rs.getLong("amount_minor"), rs.getString("currency"),
                enumValue(RefundStatus.class, rs.getString("status")), rs.getString("reason_code"), instant(rs.getTimestamp("created_at")),
                instant(rs.getTimestamp("updated_at")), instant(rs.getTimestamp("completed_at")));
    }

    private RefundCallbackReceipt refundCallback(ResultSet rs, int row) throws SQLException {
        return new RefundCallbackReceipt(rs.getString("tenant_id"), enumValue(PaymentProvider.class, rs.getString("provider")), rs.getString("provider_event_id"),
                rs.getString("refund_id"), rs.getString("payload_hash"), rs.getLong("amount_minor"), rs.getString("currency"), rs.getString("verification_state"), instant(rs.getTimestamp("received_at")));
    }

    private <T> Optional<T> one(String sql, org.springframework.jdbc.core.RowMapper<T> mapper, Object... args) {
        try {
            return Optional.ofNullable(jdbc.queryForObject(sql, mapper, args));
        } catch (EmptyResultDataAccessException ignored) {
            return Optional.empty();
        }
    }

    private static Timestamp timestamp(Instant value) { return value == null ? null : Timestamp.from(value); }
    private static Instant instant(Timestamp value) { return value == null ? null : value.toInstant(); }
    private static <E extends Enum<E>> E enumValue(Class<E> type, String value) { return value == null ? null : Enum.valueOf(type, value); }
}
