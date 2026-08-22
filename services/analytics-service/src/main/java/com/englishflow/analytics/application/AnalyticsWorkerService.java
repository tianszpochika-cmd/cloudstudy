package com.englishflow.analytics.application;

import com.englishflow.analytics.domain.AnalyticsDomainException;
import com.englishflow.analytics.domain.AnalyticsErrorCode;
import com.englishflow.analytics.domain.AnalyticsEventReceipt;
import com.englishflow.analytics.domain.AnalyticsEventValidator;
import com.englishflow.analytics.domain.AnalyticsHash;
import com.englishflow.analytics.domain.AnalyticsIngestResult;
import com.englishflow.analytics.domain.AnalyticsIngestState;
import com.englishflow.analytics.domain.AnalyticsMetricMapper;
import com.englishflow.analytics.domain.AnalyticsEventEnvelope;
import com.englishflow.analytics.domain.EventReceiptState;
import com.englishflow.analytics.domain.MetricDelta;
import com.englishflow.analytics.domain.MetricProjection;
import com.englishflow.analytics.domain.MetricProjectionKey;
import com.englishflow.analytics.domain.SanitizedAnalyticsEvent;
import com.englishflow.analytics.domain.ValidatedAnalyticsEvent;
import com.englishflow.analytics.port.AnalyticsProjectionStore;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;

/**
 * Worker application boundary. The synchronized section models the idempotent transaction that a
 * production Kafka consumer must implement with the analytics-owned receipt/journal/projection
 * tables and an outbox/offset transaction.
 */
public final class AnalyticsWorkerService {

    private final AnalyticsProjectionStore store;
    private final AnalyticsEventValidator validator;
    private final AnalyticsMetricMapper metricMapper;

    public AnalyticsWorkerService(AnalyticsProjectionStore store) {
        this(store, new AnalyticsEventValidator(), new AnalyticsMetricMapper());
    }

    public AnalyticsWorkerService(AnalyticsProjectionStore store, AnalyticsEventValidator validator,
            AnalyticsMetricMapper metricMapper) {
        this.store = store;
        this.validator = validator;
        this.metricMapper = metricMapper;
    }

    public synchronized AnalyticsIngestResult consume(AnalyticsEventEnvelope envelope) {
        if (envelope == null) {
            return AnalyticsIngestResult.rejected(null, null, AnalyticsErrorCode.ENVELOPE_INVALID);
        }
        ValidatedAnalyticsEvent event;
        try {
            event = validator.validate(envelope);
        } catch (AnalyticsDomainException exception) {
            return AnalyticsIngestResult.rejected(envelope.eventId(), envelope.dedupeKey(), exception.code());
        }

        try {
            String payloadHash = event.payloadHash();
            var existingDedupe = store.findReceiptByDedupe(event.tenant(), event.envelope().dedupeKey());
            if (existingDedupe.isPresent()) {
                return duplicateOrConflict(event, existingDedupe.get(), payloadHash);
            }
            var existingEvent = store.findReceiptByEventId(event.tenant(), event.envelope().eventId());
            if (existingEvent.isPresent()) {
                return duplicateOrConflict(event, existingEvent.get(), payloadHash);
            }

            MetricDelta delta = metricMapper.toDelta(event);
            MetricProjectionKey key = new MetricProjectionKey(event.tenant(), delta.metricId(), delta.metricVersion(),
                    delta.occurredAt().atZone(ZoneOffset.UTC).toLocalDate(), delta.dimensionKey());
            MetricProjection current = store.findProjection(key)
                    .orElseGet(() -> MetricProjection.empty(key, Instant.now()));
            MetricProjection next = current.apply(delta, Instant.now());
            AnalyticsEventReceipt receipt = new AnalyticsEventReceipt(event.tenant(), event.envelope().eventId(),
                    event.envelope().eventName(), event.envelope().dedupeKey(), payloadHash,
                    event.definition().metricVersion(), EventReceiptState.ACCEPTED, null, Instant.now());
            SanitizedAnalyticsEvent journalEntry = new SanitizedAnalyticsEvent(event.tenant(),
                    event.envelope().eventId(), event.envelope().eventName(), event.envelope().schemaVersion(),
                    event.envelope().dedupeKey(), payloadHash, event.envelope().occurredAt(), event.sanitizedPayload());
            store.commitAccepted(receipt, journalEntry, next);
            return new AnalyticsIngestResult(AnalyticsIngestState.ACCEPTED, event.envelope().eventId(),
                    event.envelope().dedupeKey(), event.definition().metricVersion(),
                    List.of(projectionKey(key)), null);
        } catch (AnalyticsDomainException exception) {
            return new AnalyticsIngestResult(AnalyticsIngestState.REJECTED, envelope.eventId(), envelope.dedupeKey(),
                    null, List.of(), exception.code());
        } catch (RuntimeException exception) {
            return new AnalyticsIngestResult(AnalyticsIngestState.ERROR, envelope.eventId(), envelope.dedupeKey(),
                    null, List.of(), AnalyticsErrorCode.PROJECTION_WRITE_FAILED);
        }
    }

    private static AnalyticsIngestResult duplicateOrConflict(ValidatedAnalyticsEvent event,
            AnalyticsEventReceipt existing, String payloadHash) {
        if (!existing.payloadHash().equals(payloadHash)) {
            return new AnalyticsIngestResult(AnalyticsIngestState.REJECTED, event.envelope().eventId(),
                    event.envelope().dedupeKey(), event.definition().metricVersion(), List.of(),
                    AnalyticsErrorCode.DEDUPE_PAYLOAD_CONFLICT);
        }
        return new AnalyticsIngestResult(AnalyticsIngestState.DUPLICATE_IGNORED, event.envelope().eventId(),
                event.envelope().dedupeKey(), existing.metricVersion(), List.of(), null);
    }

    private static String projectionKey(MetricProjectionKey key) {
        return key.metricId() + "|" + key.metricVersion() + "|" + key.periodStart() + "|" + key.dimensionKey();
    }
}
