package com.englishflow.analytics.application;

import com.englishflow.analytics.domain.AnalyticsDomainException;
import com.englishflow.analytics.domain.AnalyticsErrorCode;
import com.englishflow.analytics.domain.AnalyticsEventAllowlist;
import com.englishflow.analytics.domain.AnalyticsEventDefinition;
import com.englishflow.analytics.domain.AnalyticsEventEnvelope;
import com.englishflow.analytics.domain.AnalyticsEventValidator;
import com.englishflow.analytics.domain.AnalyticsMetricMapper;
import com.englishflow.analytics.domain.AnalyticsMetricVersions;
import com.englishflow.analytics.domain.MetricDelta;
import com.englishflow.analytics.domain.MetricProjection;
import com.englishflow.analytics.domain.MetricProjectionKey;
import com.englishflow.analytics.domain.RecomputeRequest;
import com.englishflow.analytics.domain.RecomputeResult;
import com.englishflow.analytics.domain.RecomputeState;
import com.englishflow.analytics.domain.SanitizedAnalyticsEvent;
import com.englishflow.analytics.domain.ValidatedAnalyticsEvent;
import com.englishflow.analytics.port.AnalyticsProjectionStore;
import com.englishflow.analytics.port.AnalyticsReplayPort;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Rebuilds analytics projections from the analytics-owned sanitized journal. It never calls a
 * domain command and never reads a domain table. A production adapter should make the clear-and-
 * replace phase one transaction in the analytics schema.
 */
public final class AnalyticsRecomputeService implements AnalyticsReplayPort {

    private final AnalyticsProjectionStore store;
    private final AnalyticsEventValidator validator;
    private final AnalyticsMetricMapper metricMapper;

    public AnalyticsRecomputeService(AnalyticsProjectionStore store) {
        this(store, new AnalyticsEventValidator(), new AnalyticsMetricMapper());
    }

    public AnalyticsRecomputeService(AnalyticsProjectionStore store, AnalyticsEventValidator validator,
            AnalyticsMetricMapper metricMapper) {
        this.store = store;
        this.validator = validator;
        this.metricMapper = metricMapper;
    }

    @Override
    public RecomputeResult recompute(RecomputeRequest request) {
        if (!AnalyticsMetricVersions.isSupported(request.metricVersion())) {
            return new RecomputeResult(RecomputeState.ERROR, request.jobId(), request.metricVersion(), 0L, 0L,
                    AnalyticsErrorCode.METRIC_VERSION_UNSUPPORTED);
        }
        try {
            List<SanitizedAnalyticsEvent> journal = store.readJournal(request.tenant(), request.from(), request.to());
            Map<MetricProjectionKey, MetricProjection> rebuilt = new LinkedHashMap<>();
            long replayedEventCount = 0L;
            for (SanitizedAnalyticsEvent entry : journal) {
                ValidatedAnalyticsEvent event = rehydrate(entry);
                if (!AnalyticsMetricVersions.matches(event.definition().metricVersion(), request.metricVersion())) {
                    continue;
                }
                replayedEventCount++;
                MetricDelta delta = metricMapper.toDelta(event);
                MetricProjectionKey key = new MetricProjectionKey(event.tenant(), delta.metricId(), delta.metricVersion(),
                        delta.occurredAt().atZone(ZoneOffset.UTC).toLocalDate(), delta.dimensionKey());
                MetricProjection current = rebuilt.get(key);
                if (current == null) {
                    current = MetricProjection.empty(key, Instant.now());
                }
                rebuilt.put(key, current.apply(delta, Instant.now()));
            }
            store.clearProjections(request);
            rebuilt.values().forEach(store::replaceProjection);
            if (replayedEventCount == 0L || rebuilt.isEmpty()) {
                return new RecomputeResult(RecomputeState.EMPTY, request.jobId(), request.metricVersion(),
                        replayedEventCount, 0L, null);
            }
            return new RecomputeResult(RecomputeState.COMPLETED, request.jobId(), request.metricVersion(),
                    replayedEventCount, rebuilt.size(), null);
        } catch (AnalyticsDomainException exception) {
            return new RecomputeResult(RecomputeState.ERROR, request.jobId(), request.metricVersion(), 0L, 0L,
                    exception.code());
        } catch (RuntimeException exception) {
            return new RecomputeResult(RecomputeState.ERROR, request.jobId(), request.metricVersion(), 0L, 0L,
                    AnalyticsErrorCode.RECOMPUTE_FAILED);
        }
    }

    private ValidatedAnalyticsEvent rehydrate(SanitizedAnalyticsEvent entry) {
        AnalyticsEventDefinition definition = AnalyticsEventAllowlist.definition(entry.eventName());
        if (definition == null) {
            throw AnalyticsDomainException.rejected(AnalyticsErrorCode.EVENT_NOT_ALLOWLISTED,
                    "journal contains an event outside the current allowlist");
        }
        Object aggregate = entry.payload().get(definition.aggregateIdField());
        if (!(aggregate instanceof String aggregateId)) {
            throw AnalyticsDomainException.rejected(AnalyticsErrorCode.AGGREGATE_MISMATCH,
                    "journal aggregate reference is invalid");
        }
        AnalyticsEventEnvelope replayEnvelope = new AnalyticsEventEnvelope(
                entry.eventId(), entry.eventName(), definition.schema(), definition.version(), entry.occurredAt(),
                definition.aggregateType(), aggregateId, "analytics-replay", "analytics-replay", "analytics-replay",
                entry.schemaVersion(), entry.dedupeKey(), definition.sourceService(), entry.tenant().tenantId(), entry.payload());
        return validator.validate(replayEnvelope);
    }
}
