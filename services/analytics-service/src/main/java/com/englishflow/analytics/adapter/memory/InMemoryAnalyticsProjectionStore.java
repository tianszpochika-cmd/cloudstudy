package com.englishflow.analytics.adapter.memory;

import com.englishflow.analytics.domain.AnalyticsEventReceipt;
import com.englishflow.analytics.domain.AnalyticsQuery;
import com.englishflow.analytics.domain.AnalyticsErrorCode;
import com.englishflow.analytics.domain.MetricProjection;
import com.englishflow.analytics.domain.MetricProjectionKey;
import com.englishflow.analytics.domain.RecomputeRequest;
import com.englishflow.analytics.domain.SanitizedAnalyticsEvent;
import com.englishflow.analytics.domain.TenantScope;
import com.englishflow.analytics.port.AnalyticsProjectionStore;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Deterministic local adapter. A durable implementation can use the four analytics-owned tables
 * from the Flyway migration without changing the worker/query/replay ports.
 */
public final class InMemoryAnalyticsProjectionStore implements AnalyticsProjectionStore {

    private final Map<String, AnalyticsEventReceipt> receiptsByDedupe = new LinkedHashMap<>();
    private final Map<String, AnalyticsEventReceipt> receiptsByEvent = new LinkedHashMap<>();
    private final Map<String, SanitizedAnalyticsEvent> journal = new LinkedHashMap<>();
    private final Map<MetricProjectionKey, MetricProjection> projections = new HashMap<>();
    private boolean failReads;
    private boolean failWrites;

    @Override
    public synchronized Optional<AnalyticsEventReceipt> findReceiptByDedupe(TenantScope tenant, String dedupeKey) {
        failIfReadFails();
        return Optional.ofNullable(receiptsByDedupe.get(receiptKey(tenant, dedupeKey)));
    }

    @Override
    public synchronized Optional<AnalyticsEventReceipt> findReceiptByEventId(TenantScope tenant, String eventId) {
        failIfReadFails();
        return Optional.ofNullable(receiptsByEvent.get(receiptKey(tenant, eventId)));
    }

    @Override
    public synchronized void commitAccepted(AnalyticsEventReceipt receipt, SanitizedAnalyticsEvent event,
            MetricProjection projection) {
        failIfWriteFails();
        String dedupeKey = receiptKey(receipt.tenant(), receipt.dedupeKey());
        String eventKey = receiptKey(receipt.tenant(), receipt.eventId());
        if (receiptsByDedupe.containsKey(dedupeKey) || receiptsByEvent.containsKey(eventKey)
                || journal.containsKey(eventKey)) {
            throw new IllegalStateException("analytics receipt already exists");
        }
        receiptsByDedupe.put(dedupeKey, receipt);
        receiptsByEvent.put(eventKey, receipt);
        journal.put(eventKey, event);
        projections.put(projection.key(), projection);
    }

    @Override
    public synchronized List<SanitizedAnalyticsEvent> readJournal(TenantScope tenant, LocalDate from, LocalDate to) {
        failIfReadFails();
        return journal.values().stream()
                .filter(event -> event.tenant().equals(tenant))
                .filter(event -> {
                    LocalDate date = event.occurredAt().atZone(java.time.ZoneOffset.UTC).toLocalDate();
                    return !date.isBefore(from) && !date.isAfter(to);
                })
                .sorted(Comparator.comparing(SanitizedAnalyticsEvent::occurredAt)
                        .thenComparing(SanitizedAnalyticsEvent::eventId))
                .toList();
    }

    @Override
    public synchronized Optional<MetricProjection> findProjection(MetricProjectionKey key) {
        failIfReadFails();
        return Optional.ofNullable(projections.get(key));
    }

    @Override
    public synchronized List<MetricProjection> query(AnalyticsQuery query) {
        failIfReadFails();
        return projections.values().stream()
                .filter(projection -> projection.key().tenant().equals(query.tenant()))
                .filter(projection -> !projection.periodStart().isBefore(query.from())
                        && !projection.periodStart().isAfter(query.to()))
                .filter(projection -> query.metricIds().isEmpty()
                        || query.metricIds().contains(projection.key().metricId()))
                .filter(projection -> query.metricVersion() == null
                        || com.englishflow.analytics.domain.AnalyticsMetricVersions.matches(
                                projection.key().metricVersion(), query.metricVersion()))
                .sorted(Comparator.comparing((MetricProjection item) -> item.key().periodStart())
                        .thenComparing(item -> item.key().metricId())
                        .thenComparing(item -> item.key().dimensionKey()))
                .toList();
    }

    @Override
    public synchronized void replaceProjection(MetricProjection projection) {
        failIfWriteFails();
        projections.put(projection.key(), projection);
    }

    @Override
    public synchronized void clearProjections(RecomputeRequest request) {
        failIfWriteFails();
        projections.entrySet().removeIf(entry -> {
            MetricProjectionKey key = entry.getKey();
            return key.tenant().equals(request.tenant())
                    && !key.periodStart().isBefore(request.from())
                    && !key.periodStart().isAfter(request.to())
                    && com.englishflow.analytics.domain.AnalyticsMetricVersions.matches(
                            key.metricVersion(), request.metricVersion());
        });
    }

    public synchronized void failReads(boolean value) {
        failReads = value;
    }

    public synchronized void failWrites(boolean value) {
        failWrites = value;
    }

    public synchronized int journalSize(TenantScope tenant) {
        return (int) journal.values().stream().filter(event -> event.tenant().equals(tenant)).count();
    }

    public synchronized List<SanitizedAnalyticsEvent> journalSnapshot(TenantScope tenant) {
        return new ArrayList<>(journal.values().stream().filter(event -> event.tenant().equals(tenant)).toList());
    }

    private void failIfReadFails() {
        if (failReads) {
            throw new IllegalStateException(AnalyticsErrorCode.PROJECTION_READ_FAILED.name());
        }
    }

    private void failIfWriteFails() {
        if (failWrites) {
            throw new IllegalStateException(AnalyticsErrorCode.PROJECTION_WRITE_FAILED.name());
        }
    }

    private static String receiptKey(TenantScope tenant, String key) {
        return tenant.tenantId() + "|" + key;
    }
}
