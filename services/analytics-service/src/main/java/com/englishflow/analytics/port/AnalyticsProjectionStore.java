package com.englishflow.analytics.port;

import com.englishflow.analytics.domain.AnalyticsEventReceipt;
import com.englishflow.analytics.domain.AnalyticsQuery;
import com.englishflow.analytics.domain.MetricProjection;
import com.englishflow.analytics.domain.MetricProjectionKey;
import com.englishflow.analytics.domain.RecomputeRequest;
import com.englishflow.analytics.domain.SanitizedAnalyticsEvent;
import com.englishflow.analytics.domain.TenantScope;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

/**
 * Storage port for analytics-owned journal/receipt/projection data. Implementations must not
 * expose repositories for another service or join another service schema.
 */
public interface AnalyticsProjectionStore {

    Optional<AnalyticsEventReceipt> findReceiptByDedupe(TenantScope tenant, String dedupeKey);

    Optional<AnalyticsEventReceipt> findReceiptByEventId(TenantScope tenant, String eventId);

    void commitAccepted(AnalyticsEventReceipt receipt, SanitizedAnalyticsEvent event,
            MetricProjection projection);

    List<SanitizedAnalyticsEvent> readJournal(TenantScope tenant, LocalDate from, LocalDate to);

    Optional<MetricProjection> findProjection(MetricProjectionKey key);

    List<MetricProjection> query(AnalyticsQuery query);

    void replaceProjection(MetricProjection projection);

    void clearProjections(RecomputeRequest request);

    /**
     * M6-010 deletion effect: removes the principal's journal rows and the receipts that
     * reference them, then journals the purge itself so replays are idempotent.
     * Aggregate metric projections are not rewound here; they rebuild from the journal
     * through the existing recompute path.
     */
    PurgeResult purgePrincipal(TenantScope tenant, AnalyticsEventReceipt purgeReceipt,
            SanitizedAnalyticsEvent purgeJournal, String actorRef);

    record PurgeResult(int journalDeleted, int receiptsDeleted) {
    }
}
