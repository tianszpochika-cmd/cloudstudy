package com.englishflow.analytics.adapter.failclosed;

import com.englishflow.analytics.domain.AnalyticsEventReceipt;
import com.englishflow.analytics.domain.AnalyticsQuery;
import com.englishflow.analytics.domain.MetricProjection;
import com.englishflow.analytics.domain.MetricProjectionKey;
import com.englishflow.analytics.domain.RecomputeRequest;
import com.englishflow.analytics.domain.SanitizedAnalyticsEvent;
import com.englishflow.analytics.domain.TenantScope;
import com.englishflow.analytics.port.AnalyticsProjectionStore;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

/**
 * local-real boundary until the analytics owner JDBC projection is wired. It never returns an
 * empty projection as a substitute for unavailable persistence and never stores facts in memory.
 */
public final class FailClosedAnalyticsProjectionStore implements AnalyticsProjectionStore {
    @Override
    public Optional<AnalyticsEventReceipt> findReceiptByDedupe(TenantScope tenant, String dedupeKey) {
        throw unavailable("ANALYTICS_PROJECTION_READ_FAILED");
    }

    @Override
    public Optional<AnalyticsEventReceipt> findReceiptByEventId(TenantScope tenant, String eventId) {
        throw unavailable("ANALYTICS_PROJECTION_READ_FAILED");
    }

    @Override
    public void commitAccepted(AnalyticsEventReceipt receipt, SanitizedAnalyticsEvent event,
            MetricProjection projection) {
        throw unavailable("ANALYTICS_PROJECTION_WRITE_FAILED");
    }

    @Override
    public List<SanitizedAnalyticsEvent> readJournal(TenantScope tenant, LocalDate from, LocalDate to) {
        throw unavailable("ANALYTICS_PROJECTION_READ_FAILED");
    }

    @Override
    public Optional<MetricProjection> findProjection(MetricProjectionKey key) {
        throw unavailable("ANALYTICS_PROJECTION_READ_FAILED");
    }

    @Override
    public List<MetricProjection> query(AnalyticsQuery query) {
        throw unavailable("ANALYTICS_PROJECTION_READ_FAILED");
    }

    @Override
    public void replaceProjection(MetricProjection projection) {
        throw unavailable("ANALYTICS_PROJECTION_WRITE_FAILED");
    }

    @Override
    public void clearProjections(RecomputeRequest request) {
        throw unavailable("ANALYTICS_PROJECTION_WRITE_FAILED");
    }

    @Override
    public PurgeResult purgePrincipal(TenantScope tenant, AnalyticsEventReceipt purgeReceipt,
            SanitizedAnalyticsEvent purgeJournal, String actorRef) {
        throw unavailable("ANALYTICS_PROJECTION_WRITE_FAILED");
    }

    private static IllegalStateException unavailable(String code) {
        return new IllegalStateException(code + ": local-real durable adapter is not configured");
    }
}
