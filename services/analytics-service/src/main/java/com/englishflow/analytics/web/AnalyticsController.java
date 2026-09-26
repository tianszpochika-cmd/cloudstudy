package com.englishflow.analytics.web;

import com.englishflow.analytics.application.AnalyticsWorkerService;
import com.englishflow.analytics.domain.AnalyticsDomainException;
import com.englishflow.analytics.domain.AnalyticsErrorCode;
import com.englishflow.analytics.domain.AnalyticsEventEnvelope;
import com.englishflow.analytics.domain.AnalyticsIngestResult;
import com.englishflow.analytics.domain.AnalyticsQuery;
import com.englishflow.analytics.domain.AnalyticsQueryResult;
import com.englishflow.analytics.domain.AnalyticsQueryState;
import com.englishflow.analytics.domain.MetricProjection;
import com.englishflow.analytics.domain.RecomputeRequest;
import com.englishflow.analytics.domain.RecomputeResult;
import com.englishflow.analytics.domain.TenantScope;
import com.englishflow.analytics.port.AnalyticsQueryPort;
import com.englishflow.analytics.port.AnalyticsReplayPort;
import com.englishflow.analytics.security.AnalyticsCaller;
import com.englishflow.analytics.security.AnalyticsPrincipalResolver;
import jakarta.servlet.http.HttpServletRequest;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Internal-only seam; external traffic must be routed through api-gateway. */
@RestController
@RequestMapping("/internal/v1/analytics")
public final class AnalyticsController {

    private static final java.util.Set<String> RECOMPUTE_FIELDS = java.util.Set.of(
            "metricVersion", "from", "to", "jobId");

    private final AnalyticsWorkerService worker;
    private final AnalyticsQueryPort queryService;
    private final AnalyticsReplayPort replayService;
    private final AnalyticsPrincipalResolver principals;

    public AnalyticsController(AnalyticsWorkerService worker, AnalyticsQueryPort queryService,
            AnalyticsReplayPort replayService, AnalyticsPrincipalResolver principals) {
        this.worker = worker;
        this.queryService = queryService;
        this.replayService = replayService;
        this.principals = principals;
    }

    @PostMapping("/events")
    public Map<String, Object> consume(Authentication authentication, @RequestBody Map<?, ?> body,
            @RequestHeader("Idempotency-Key") String idempotencyKey,
            HttpServletRequest request) {
        requireIdempotencyKey(idempotencyKey);
        AnalyticsCaller caller = principals.requireTrustedEventCaller(authentication);
        AnalyticsEventEnvelope event = AnalyticsEventEnvelope.fromTrustedMap(body,
                caller.sourceService(), caller.tenant().tenantId());
        return envelope(ingestView(worker.consume(event)), request);
    }

    @GetMapping("/metrics")
    public Map<String, Object> query(Authentication authentication,
            @RequestParam(required = false) String metricId,
            @RequestParam(required = false) String metricVersion,
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to,
            HttpServletRequest request) {
        AnalyticsCaller caller = principals.requireQueryCaller(authentication);
        LocalDate end = parseDate(to, LocalDate.now(ZoneOffset.UTC));
        LocalDate start = parseDate(from, end.minusDays(30));
        List<String> metricIds = metricId == null || metricId.isBlank()
                ? List.of()
                : splitMetricIds(metricId);
        AnalyticsQueryResult result = queryService.query(new AnalyticsQuery(
                caller.tenant(), metricIds, start, end, blankToNull(metricVersion)));
        if (result.state() == AnalyticsQueryState.ERROR) {
            if (result.errorCode() == AnalyticsErrorCode.METRIC_VERSION_UNSUPPORTED) {
                throw AnalyticsDomainException.rejected(AnalyticsErrorCode.METRIC_VERSION_UNSUPPORTED,
                        "metric version is unsupported");
            }
            throw AnalyticsDomainException.transientFailure(AnalyticsErrorCode.PROJECTION_READ_FAILED,
                    "metric projection is temporarily unavailable");
        }
        return envelope(queryView(result), request);
    }

    @PostMapping("/recompute")
    public Map<String, Object> recompute(Authentication authentication, @RequestBody Map<?, ?> body,
            @RequestHeader("Idempotency-Key") String idempotencyKey,
            HttpServletRequest request) {
        requireIdempotencyKey(idempotencyKey);
        AnalyticsCaller caller = principals.requireRecomputeCaller(authentication);
        RecomputeRequest command = recomputeRequest(caller.tenant(), body);
        return envelope(recomputeView(replayService.recompute(command)), request);
    }

    @PostMapping("/replay")
    public Map<String, Object> replay(Authentication authentication, @RequestBody Map<?, ?> body,
            @RequestHeader("Idempotency-Key") String idempotencyKey,
            HttpServletRequest request) {
        requireIdempotencyKey(idempotencyKey);
        AnalyticsCaller caller = principals.requireRecomputeCaller(authentication);
        RecomputeRequest command = recomputeRequest(caller.tenant(), body);
        return envelope(recomputeView(replayService.replay(command)), request);
    }

    private static RecomputeRequest recomputeRequest(TenantScope tenant, Map<?, ?> body) {
        if (body == null) {
            throw AnalyticsDomainException.rejected(AnalyticsErrorCode.RECOMPUTE_RANGE_INVALID,
                    "recompute request is required");
        }
        for (Object key : body.keySet()) {
            if (!(key instanceof String field) || !RECOMPUTE_FIELDS.contains(field)) {
                throw AnalyticsDomainException.rejected(AnalyticsErrorCode.RECOMPUTE_RANGE_INVALID,
                        "recompute request contains an unsupported field");
            }
        }
        String metricVersion = required(body, "metricVersion");
        LocalDate from = parseDate(required(body, "from"), null);
        LocalDate to = parseDate(required(body, "to"), null);
        String jobId = body.get("jobId") == null || String.valueOf(body.get("jobId")).isBlank()
                ? "analytics-job-" + UUID.randomUUID()
                : required(body, "jobId");
        return new RecomputeRequest(tenant, metricVersion, from, to, jobId);
    }

    private static List<String> splitMetricIds(String value) {
        List<String> result = new ArrayList<>();
        for (String item : value.split(",")) {
            if (item.isBlank()) {
                continue;
            }
            com.englishflow.analytics.domain.AnalyticsPrivacyBoundary.requireOpaqueReference(item.trim(), "metricId");
            result.add(item.trim());
        }
        return List.copyOf(result);
    }

    private static LocalDate parseDate(String value, LocalDate fallback) {
        if (value == null || value.isBlank()) {
            if (fallback != null) {
                return fallback;
            }
            throw AnalyticsDomainException.rejected(AnalyticsErrorCode.RECOMPUTE_RANGE_INVALID,
                    "date is required");
        }
        try {
            return LocalDate.parse(value);
        } catch (java.time.format.DateTimeParseException exception) {
            throw AnalyticsDomainException.rejected(AnalyticsErrorCode.RECOMPUTE_RANGE_INVALID,
                    "date must be ISO-8601");
        }
    }

    private static String required(Map<?, ?> body, String field) {
        Object value = body.get(field);
        if (!(value instanceof String string) || string.isBlank()) {
            throw AnalyticsDomainException.rejected(AnalyticsErrorCode.RECOMPUTE_RANGE_INVALID,
                    field + " is required");
        }
        return string;
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value;
    }

    private static void requireIdempotencyKey(String value) {
        if (value == null || value.trim().length() < 16 || value.trim().length() > 200) {
            throw AnalyticsDomainException.rejected(AnalyticsErrorCode.ENVELOPE_INVALID,
                    "Idempotency-Key is required for analytics writes");
        }
    }

    private static Map<String, Object> ingestView(AnalyticsIngestResult result) {
        return map("state", result.state().name(), "eventId", result.eventId(), "dedupeKey", result.dedupeKey(),
                "metricVersion", result.metricVersion(), "projectionKeys", result.projectionKeys(),
                "reasonCode", result.reasonCode() == null ? null : result.reasonCode().name());
    }

    private static List<Map<String, Object>> queryView(AnalyticsQueryResult result) {
        return result.rows().stream().map(AnalyticsController::projectionView).toList();
    }

    private static Map<String, Object> recomputeView(RecomputeResult result) {
        return map("state", result.state().name(), "jobId", result.jobId(),
                "metricVersion", result.metricVersion(), "replayedEventCount", result.replayedEventCount(),
                "projectionCount", result.projectionCount(),
                "reasonCode", result.reasonCode() == null ? null : result.reasonCode().name());
    }

    private static Map<String, Object> projectionView(MetricProjection projection) {
        var periodStart = projection.periodStart().atStartOfDay().toInstant(ZoneOffset.UTC);
        var periodEnd = projection.periodStart().plusDays(1).atStartOfDay().toInstant(ZoneOffset.UTC);
        String state = switch (projection.state()) {
            case READY -> "READY";
            case EMPTY, ERROR -> "UNAVAILABLE";
            case REBUILDING -> "RECOMPUTING";
        };
        return map("metricCode", projection.key().metricId(), "metricVersion", projection.key().metricVersion(),
                "periodStart", periodStart, "periodEnd", periodEnd, "value", projection.totalValue(),
                "state", state, "generatedAt", projection.updatedAt());
    }

    private static Map<String, Object> envelope(Object data, HttpServletRequest request) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("requestId", requestId(request));
        result.put("data", data);
        result.put("meta", Map.of("service", "analytics-service", "schemaVersion", "analytics.api.v1"));
        return result;
    }

    private static String requestId(HttpServletRequest request) {
        String value = request.getHeader("X-Request-Id");
        if (value == null || value.isBlank()) {
            return "analytics-" + UUID.randomUUID();
        }
        try {
            return com.englishflow.analytics.domain.AnalyticsPrivacyBoundary.requireOpaqueReference(value, "requestId");
        } catch (AnalyticsDomainException exception) {
            return "analytics-" + UUID.randomUUID();
        }
    }

    private static Map<String, Object> map(Object... pairs) {
        Map<String, Object> result = new LinkedHashMap<>();
        for (int index = 0; index < pairs.length; index += 2) {
            result.put(String.valueOf(pairs[index]), pairs[index + 1]);
        }
        return result;
    }
}
