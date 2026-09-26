package com.englishflow.analytics.web;

import com.englishflow.analytics.application.AnalyticsQueryService;
import com.englishflow.analytics.domain.AnalyticsDomainException;
import com.englishflow.analytics.domain.AnalyticsErrorCode;
import com.englishflow.analytics.domain.AnalyticsQuery;
import com.englishflow.analytics.port.AnalyticsProjectionStore;
import com.englishflow.analytics.security.AnalyticsPrincipalResolver;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class AnalyticsMetricsQueryStateTest {

    private static final Instant NOW = Instant.parse("2026-09-23T00:00:00Z");

    @Test
    void malformedStoredProjectionCannotBecomeSuccessfulEmptyMetrics() {
        AnalyticsProjectionStore store = mock(AnalyticsProjectionStore.class);
        when(store.query(any(AnalyticsQuery.class)))
                .thenThrow(new IllegalArgumentException("invalid stored projection error code"));
        AnalyticsController controller = controller(store);

        AnalyticsDomainException failure = assertThrows(AnalyticsDomainException.class,
                () -> controller.query(caller(), null, null, "2026-09-01", "2026-09-23", request()));
        assertEquals(AnalyticsErrorCode.PROJECTION_READ_FAILED, failure.code());
        var response = new AnalyticsApiExceptionHandler().handle(failure);
        assertEquals(503, response.getStatusCode().value());
        Map<?, ?> error = (Map<?, ?>) response.getBody().get("error");
        assertEquals("PROJECTION_READ_FAILED", error.get("code"));
        assertTrue((Boolean) error.get("retryable"));
    }

    @Test
    void genuineEmptyMetricsRemainSuccessfulAndUnsupportedVersionIsRejected() {
        AnalyticsProjectionStore store = mock(AnalyticsProjectionStore.class);
        when(store.query(any(AnalyticsQuery.class))).thenReturn(List.of());
        AnalyticsController controller = controller(store);

        Map<String, Object> empty = controller.query(caller(), null, null,
                "2026-09-01", "2026-09-23", request());
        assertEquals(List.of(), empty.get("data"));

        AnalyticsDomainException unsupported = assertThrows(AnalyticsDomainException.class,
                () -> controller.query(caller(), null, "unknown.v1",
                        "2026-09-01", "2026-09-23", request()));
        assertEquals(AnalyticsErrorCode.METRIC_VERSION_UNSUPPORTED, unsupported.code());
        assertEquals(422, new AnalyticsApiExceptionHandler().handle(unsupported).getStatusCode().value());
    }

    private static AnalyticsController controller(AnalyticsProjectionStore store) {
        return new AnalyticsController(null, new AnalyticsQueryService(store), null,
                new AnalyticsPrincipalResolver());
    }

    private static JwtAuthenticationToken caller() {
        Jwt jwt = Jwt.withTokenValue("local-test-only")
                .header("alg", "RS256")
                .subject("synthetic-staff")
                .issuedAt(NOW)
                .expiresAt(NOW.plusSeconds(300))
                .claim("tenant_id", "platform")
                .claim("permissions", List.of("analytics.read"))
                .build();
        return new JwtAuthenticationToken(jwt, Set.of(), jwt.getSubject());
    }

    private static MockHttpServletRequest request() {
        return new MockHttpServletRequest("GET", "/internal/v1/analytics/metrics");
    }
}
