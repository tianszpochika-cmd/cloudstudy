package com.englishflow.analytics.adapter.jdbc;

import tools.jackson.core.JacksonException;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;
import com.englishflow.analytics.domain.AnalyticsErrorCode;
import com.englishflow.analytics.domain.AnalyticsEventReceipt;
import com.englishflow.analytics.domain.AnalyticsMetricVersions;
import com.englishflow.analytics.domain.AnalyticsQuery;
import com.englishflow.analytics.domain.EventReceiptState;
import com.englishflow.analytics.domain.MetricProjection;
import com.englishflow.analytics.domain.MetricProjectionKey;
import com.englishflow.analytics.domain.ProjectionState;
import com.englishflow.analytics.domain.RecomputeRequest;
import com.englishflow.analytics.domain.SanitizedAnalyticsEvent;
import com.englishflow.analytics.domain.TenantScope;
import com.englishflow.analytics.port.AnalyticsProjectionStore;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

/**
 * Analytics-owned JDBC adapter. It only touches analytics-service tables and keeps the worker's
 * receipt, sanitized journal and metric projection in one local transaction.
 */
public class JdbcAnalyticsProjectionStore implements AnalyticsProjectionStore {

    private static final TypeReference<Map<String, Object>> PAYLOAD_TYPE = new TypeReference<>() { };

    private final JdbcTemplate jdbc;
    private final ObjectMapper objectMapper;

    public JdbcAnalyticsProjectionStore(JdbcTemplate jdbc, ObjectMapper objectMapper) {
        this.jdbc = jdbc;
        this.objectMapper = objectMapper;
    }

    @Override
    public Optional<AnalyticsEventReceipt> findReceiptByDedupe(TenantScope tenant, String dedupeKey) {
        return queryReceipt("SELECT tenant_id,event_id,event_name,dedupe_key,payload_hash,metric_version,"
                        + "receipt_state,reason_code,received_at FROM analytics_event_receipt "
                        + "WHERE tenant_id=? AND dedupe_key=?",
                tenant.tenantId(), dedupeKey);
    }

    @Override
    public Optional<AnalyticsEventReceipt> findReceiptByEventId(TenantScope tenant, String eventId) {
        return queryReceipt("SELECT tenant_id,event_id,event_name,dedupe_key,payload_hash,metric_version,"
                        + "receipt_state,reason_code,received_at FROM analytics_event_receipt "
                        + "WHERE tenant_id=? AND event_id=?",
                tenant.tenantId(), eventId);
    }

    @Override
    @Transactional
    public void commitAccepted(AnalyticsEventReceipt receipt, SanitizedAnalyticsEvent event,
            MetricProjection projection) {
        jdbc.update("INSERT INTO analytics_event_receipt "
                        + "(tenant_id,event_id,event_name,schema_version,dedupe_key,payload_hash,metric_version,"
                        + "receipt_state,reason_code,received_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
                receipt.tenant().tenantId(), receipt.eventId(), receipt.eventName(), event.schemaVersion(),
                receipt.dedupeKey(), receipt.payloadHash(), receipt.metricVersion(), receipt.state().name(),
                nullable(receipt.reasonCode()), Timestamp.from(receipt.receivedAt()));
        jdbc.update("INSERT INTO analytics_event_journal "
                        + "(tenant_id,event_id,event_name,schema_version,dedupe_key,payload_hash,occurred_at,"
                        + "sanitized_payload_json) VALUES (?,?,?,?,?,?,?,?)",
                event.tenant().tenantId(), event.eventId(), event.eventName(), event.schemaVersion(),
                event.dedupeKey(), event.payloadHash(), Timestamp.from(event.occurredAt()), json(event.payload()));
        upsertProjection(projection);
    }

    @Override
    public List<SanitizedAnalyticsEvent> readJournal(TenantScope tenant, LocalDate from, LocalDate to) {
        return jdbc.query("SELECT tenant_id,event_id,event_name,schema_version,dedupe_key,payload_hash,"
                        + "occurred_at,sanitized_payload_json FROM analytics_event_journal "
                        + "WHERE tenant_id=? AND occurred_at >= ? AND occurred_at < ? "
                        + "ORDER BY occurred_at,event_id",
                (rs, rowNum) -> journal(rs), tenant.tenantId(),
                Timestamp.valueOf(from.atStartOfDay()), Timestamp.valueOf(to.plusDays(1).atStartOfDay()));
    }

    @Override
    public Optional<MetricProjection> findProjection(MetricProjectionKey key) {
        List<MetricProjection> rows = jdbc.query("SELECT tenant_id,metric_id,metric_version,period_start,"
                        + "dimension_key,projection_state,event_count,total_value,last_occurred_at,"
                        + "source_watermark,projection_version,error_code,updated_at "
                        + "FROM analytics_metric_projection WHERE tenant_id=? AND metric_id=? AND metric_version=? "
                        + "AND period_start=? AND dimension_key=?",
                (rs, rowNum) -> projection(rs), key.tenant().tenantId(), key.metricId(), key.metricVersion(),
                key.periodStart(), key.dimensionKey());
        return rows.stream().findFirst();
    }

    @Override
    public List<MetricProjection> query(AnalyticsQuery query) {
        StringBuilder sql = new StringBuilder("SELECT tenant_id,metric_id,metric_version,period_start,"
                + "dimension_key,projection_state,event_count,total_value,last_occurred_at,source_watermark,"
                + "projection_version,error_code,updated_at FROM analytics_metric_projection "
                + "WHERE tenant_id=? AND period_start BETWEEN ? AND ?");
        List<Object> args = new ArrayList<>(List.of(query.tenant().tenantId(), query.from(), query.to()));
        if (!query.metricIds().isEmpty()) {
            sql.append(" AND metric_id IN (");
            sql.append("?,".repeat(query.metricIds().size()));
            sql.setLength(sql.length() - 1);
            sql.append(")");
            args.addAll(query.metricIds());
        }
        if (query.metricVersion() != null && !AnalyticsMetricVersions.ALL_CURRENT.equals(query.metricVersion())) {
            sql.append(" AND metric_version=?");
            args.add(query.metricVersion());
        }
        sql.append(" ORDER BY period_start,metric_id,dimension_key");
        return jdbc.query(sql.toString(), (rs, rowNum) -> projection(rs), args.toArray());
    }

    @Override
    @Transactional
    public void replaceProjection(MetricProjection projection) {
        upsertProjection(projection);
    }

    @Override
    @Transactional
    public void clearProjections(RecomputeRequest request) {
        String versionPredicate = AnalyticsMetricVersions.ALL_CURRENT.equals(request.metricVersion())
                ? ""
                : " AND metric_version=?";
        if (versionPredicate.isEmpty()) {
            jdbc.update("DELETE FROM analytics_metric_projection WHERE tenant_id=? "
                            + "AND period_start BETWEEN ? AND ?",
                    request.tenant().tenantId(), request.from(), request.to());
        } else {
            jdbc.update("DELETE FROM analytics_metric_projection WHERE tenant_id=? "
                            + "AND period_start BETWEEN ? AND ?" + versionPredicate,
                    request.tenant().tenantId(), request.from(), request.to(), request.metricVersion());
        }
    }

    private void upsertProjection(MetricProjection projection) {
        jdbc.update("INSERT INTO analytics_metric_projection "
                        + "(tenant_id,metric_id,metric_version,period_start,dimension_key,projection_state,"
                        + "event_count,total_value,last_occurred_at,source_watermark,projection_version,error_code,updated_at) "
                        + "VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE "
                        + "projection_state=VALUES(projection_state),event_count=VALUES(event_count),"
                        + "total_value=VALUES(total_value),last_occurred_at=VALUES(last_occurred_at),"
                        + "source_watermark=VALUES(source_watermark),projection_version=VALUES(projection_version),"
                        + "error_code=VALUES(error_code),updated_at=VALUES(updated_at)",
                projection.key().tenant().tenantId(), projection.key().metricId(), projection.key().metricVersion(),
                projection.key().periodStart(), projection.key().dimensionKey(), projection.state().name(),
                projection.eventCount(), projection.totalValue(), timestamp(projection.lastOccurredAt()),
                projection.sourceWatermark(), projection.projectionVersion(), nullable(projection.errorCode()),
                Timestamp.from(projection.updatedAt()));
    }

    private Optional<AnalyticsEventReceipt> queryReceipt(String sql, String tenantId, String key) {
        return jdbc.query(sql, (rs, rowNum) -> receipt(rs), tenantId, key).stream().findFirst();
    }

    private AnalyticsEventReceipt receipt(ResultSet rs) throws SQLException {
        String reason = rs.getString("reason_code");
        return new AnalyticsEventReceipt(new TenantScope(rs.getString("tenant_id")), rs.getString("event_id"),
                rs.getString("event_name"), rs.getString("dedupe_key"), rs.getString("payload_hash"),
                rs.getString("metric_version"), EventReceiptState.valueOf(rs.getString("receipt_state")),
                reason == null ? null : AnalyticsErrorCode.valueOf(reason), instant(rs, "received_at"));
    }

    private SanitizedAnalyticsEvent journal(ResultSet rs) throws SQLException {
        return new SanitizedAnalyticsEvent(new TenantScope(rs.getString("tenant_id")), rs.getString("event_id"),
                rs.getString("event_name"), rs.getString("schema_version"), rs.getString("dedupe_key"),
                rs.getString("payload_hash"), instant(rs, "occurred_at"), readPayload(rs.getString("sanitized_payload_json")));
    }

    private MetricProjection projection(ResultSet rs) throws SQLException {
        String error = rs.getString("error_code");
        return new MetricProjection(
                new MetricProjectionKey(new TenantScope(rs.getString("tenant_id")), rs.getString("metric_id"),
                        rs.getString("metric_version"), rs.getObject("period_start", LocalDate.class),
                        rs.getString("dimension_key")),
                ProjectionState.valueOf(rs.getString("projection_state")), rs.getLong("event_count"),
                rs.getLong("total_value"), instantOrNull(rs, "last_occurred_at"), rs.getString("source_watermark"),
                rs.getLong("projection_version"), error == null ? null : AnalyticsErrorCode.valueOf(error),
                instant(rs, "updated_at"));
    }

    private String json(Map<String, Object> payload) {
        try {
            return objectMapper.writeValueAsString(payload);
        } catch (JacksonException exception) {
            throw new IllegalStateException("analytics payload serialization failed", exception);
        }
    }

    private Map<String, Object> readPayload(String payload) {
        try {
            return objectMapper.readValue(payload, PAYLOAD_TYPE);
        } catch (JacksonException exception) {
            throw new IllegalStateException("analytics payload deserialization failed", exception);
        }
    }

    private static String nullable(Enum<?> value) {
        return value == null ? null : value.name();
    }

    private static Timestamp timestamp(Instant value) {
        return value == null ? null : Timestamp.from(value);
    }

    private static Instant instant(ResultSet rs, String column) throws SQLException {
        return rs.getTimestamp(column).toInstant();
    }

    private static Instant instantOrNull(ResultSet rs, String column) throws SQLException {
        Timestamp value = rs.getTimestamp(column);
        return value == null ? null : value.toInstant();
    }
}
