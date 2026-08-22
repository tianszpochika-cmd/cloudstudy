package com.englishflow.platform.template.observability;

import java.io.IOException;
import java.util.Optional;
import java.util.UUID;
import java.util.regex.Pattern;

import io.micrometer.tracing.Span;
import io.micrometer.tracing.Tracer;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import org.slf4j.MDC;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Establishes request and trace correlation for logs and response headers.
 *
 * <p>The request ID is bounded and character-validated to avoid reflecting control characters.
 * A client-provided trace ID is only a fallback correlation value; an active Micrometer span is
 * preferred and neither value is used for authorization.</p>
 */
@Order(Ordered.HIGHEST_PRECEDENCE + 10)
@Component
public class RequestContextFilter extends OncePerRequestFilter {

    public static final String REQUEST_ID_HEADER = "X-Request-Id";
    public static final String TRACE_ID_HEADER = "X-Trace-Id";

    private static final String REQUEST_ID_MDC_KEY = "requestId";
    private static final String TRACE_ID_MDC_KEY = "traceId";
    private static final Pattern REQUEST_ID_PATTERN =
            Pattern.compile("[A-Za-z0-9][A-Za-z0-9._:-]{0,127}");
    private static final Pattern TRACE_ID_PATTERN = Pattern.compile("[0-9a-fA-F]{16,128}");

    private final ObjectProvider<Tracer> tracerProvider;

    public RequestContextFilter(ObjectProvider<Tracer> tracerProvider) {
        this.tracerProvider = tracerProvider;
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain) throws ServletException, IOException {
        String requestId = validRequestId(request.getHeader(REQUEST_ID_HEADER))
                .orElseGet(RequestContextFilter::newRequestId);
        String traceId = activeTraceId()
                .or(() -> validTraceId(request.getHeader(TRACE_ID_HEADER)))
                .orElseGet(RequestContextFilter::newTraceId);

        response.setHeader(REQUEST_ID_HEADER, requestId);
        response.setHeader(TRACE_ID_HEADER, traceId);

        String previousRequestId = MDC.get(REQUEST_ID_MDC_KEY);
        String previousTraceId = MDC.get(TRACE_ID_MDC_KEY);
        try (RequestContext.Scope ignored = RequestContext.open(requestId, traceId)) {
            MDC.put(REQUEST_ID_MDC_KEY, requestId);
            MDC.put(TRACE_ID_MDC_KEY, traceId);
            filterChain.doFilter(request, response);
        } finally {
            restoreMdc(REQUEST_ID_MDC_KEY, previousRequestId);
            restoreMdc(TRACE_ID_MDC_KEY, previousTraceId);
        }
    }

    private Optional<String> activeTraceId() {
        if (tracerProvider == null) {
            return Optional.empty();
        }
        Tracer tracer = tracerProvider.getIfAvailable();
        if (tracer == null) {
            return Optional.empty();
        }
        Span span = tracer.currentSpan();
        if (span == null || span.context() == null) {
            return Optional.empty();
        }
        return validTraceId(span.context().traceId());
    }

    private static Optional<String> validRequestId(String value) {
        return value != null && REQUEST_ID_PATTERN.matcher(value).matches()
                ? Optional.of(value)
                : Optional.empty();
    }

    private static Optional<String> validTraceId(String value) {
        return value != null && TRACE_ID_PATTERN.matcher(value).matches()
                ? Optional.of(value)
                : Optional.empty();
    }

    private static String newRequestId() {
        return UUID.randomUUID().toString();
    }

    private static String newTraceId() {
        return UUID.randomUUID().toString().replace("-", "");
    }

    private static void restoreMdc(String key, String previousValue) {
        if (previousValue == null) {
            MDC.remove(key);
        } else {
            MDC.put(key, previousValue);
        }
    }
}
