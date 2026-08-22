package com.englishflow.platform.template.observability;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.concurrent.atomic.AtomicReference;

import io.micrometer.tracing.Tracer;

import jakarta.servlet.FilterChain;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

class RequestContextFilterTest {

    @AfterEach
    void clearMdc() {
        org.slf4j.MDC.clear();
    }

    @Test
    void propagatesValidatedHeadersAndCleansContext() throws Exception {
        ObjectProvider<Tracer> tracerProvider = mock(ObjectProvider.class);
        when(tracerProvider.getIfAvailable()).thenReturn(null);
        RequestContextFilter filter = new RequestContextFilter(tracerProvider);
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/actuator/health");
        request.addHeader(RequestContextFilter.REQUEST_ID_HEADER, "request-123");
        request.addHeader(RequestContextFilter.TRACE_ID_HEADER, "0123456789abcdef0123456789abcdef");
        MockHttpServletResponse response = new MockHttpServletResponse();
        AtomicReference<RequestContext> contextSeenByChain = new AtomicReference<>();
        FilterChain chain = (ignoredRequest, ignoredResponse) ->
                contextSeenByChain.set(RequestContext.current().orElseThrow());

        filter.doFilter(request, response, chain);

        assertThat(contextSeenByChain.get().requestId()).isEqualTo("request-123");
        assertThat(contextSeenByChain.get().traceId())
                .isEqualTo("0123456789abcdef0123456789abcdef");
        assertThat(response.getHeader(RequestContextFilter.REQUEST_ID_HEADER)).isEqualTo("request-123");
        assertThat(response.getHeader(RequestContextFilter.TRACE_ID_HEADER))
                .isEqualTo("0123456789abcdef0123456789abcdef");
        assertThat(RequestContext.current()).isEmpty();
        assertThat(org.slf4j.MDC.get("requestId")).isNull();
        assertThat(org.slf4j.MDC.get("traceId")).isNull();
    }

    @Test
    void generatesSafeIdsWhenIncomingValuesAreInvalid() throws Exception {
        ObjectProvider<Tracer> tracerProvider = mock(ObjectProvider.class);
        when(tracerProvider.getIfAvailable()).thenReturn(null);
        RequestContextFilter filter = new RequestContextFilter(tracerProvider);
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/");
        request.addHeader(RequestContextFilter.REQUEST_ID_HEADER, "bad value");
        request.addHeader(RequestContextFilter.TRACE_ID_HEADER, "not-a-trace-id");
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, (ignoredRequest, ignoredResponse) -> { });

        assertThat(response.getHeader(RequestContextFilter.REQUEST_ID_HEADER))
                .matches("[A-Za-z0-9][A-Za-z0-9._:-]{0,127}");
        assertThat(response.getHeader(RequestContextFilter.TRACE_ID_HEADER))
                .matches("[0-9a-fA-F]{32}");
    }
}
