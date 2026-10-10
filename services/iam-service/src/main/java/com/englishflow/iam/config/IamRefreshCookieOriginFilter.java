package com.englishflow.iam.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.net.URI;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Exact Origin check for refresh-cookie requests that reach IAM directly.
 * The HTTP Gateway never sees that cookie. SameSite=None does not replace this check.
 * Trusted origins are the learner CORS allowlist only: loopback 18180 and 18183.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 25)
public final class IamRefreshCookieOriginFilter extends OncePerRequestFilter {

    private static final Set<String> UNSAFE_METHODS = Set.of("POST", "PUT", "PATCH", "DELETE");

    private final IamServiceProperties properties;
    private final ObjectMapper objectMapper;

    public IamRefreshCookieOriginFilter(IamServiceProperties properties) {
        this.properties = properties;
        this.objectMapper = new ObjectMapper().registerModule(new JavaTimeModule())
                .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain) throws ServletException, IOException {
        if (applies(request) && sourceFailure(request) != null) {
            deny(request, response);
            return;
        }
        filterChain.doFilter(request, response);
    }

    private boolean applies(HttpServletRequest request) {
        if (!IamAuthCorsConfiguration.isAuthApiPath(request)) return false;
        String method = request.getMethod();
        if (method == null || !UNSAFE_METHODS.contains(method.toUpperCase(Locale.ROOT))) return false;
        return hasRefreshCookie(request);
    }

    private boolean hasRefreshCookie(HttpServletRequest request) {
        Cookie[] cookies = request.getCookies();
        if (cookies == null) return false;
        String name = properties.getJwt().getRefreshCookieName();
        if (name == null || name.isBlank()) return false;
        for (Cookie cookie : cookies) {
            if (name.equals(cookie.getName())) return true;
        }
        return false;
    }

    /**
     * Same decision as the Gateway filter: Origin must be trusted when present;
     * a present Referer must name that same origin; Referer is used only when Origin is absent.
     */
    private static String sourceFailure(HttpServletRequest request) {
        String origin = request.getHeader(HttpHeaders.ORIGIN);
        String referer = request.getHeader(HttpHeaders.REFERER);
        if (origin != null && !origin.isBlank()) {
            if (IamAuthCorsConfiguration.echoLearnerOrigin(origin) == null) {
                return "credentialed_origin_untrusted";
            }
            if (referer != null && !referer.isBlank()) {
                String refererOrigin = originFromReferer(referer);
                if (refererOrigin == null || !origin.equals(refererOrigin)) {
                    return "origin_referer_conflict";
                }
            }
            return null;
        }
        String refererOrigin = originFromReferer(referer);
        if (refererOrigin == null || IamAuthCorsConfiguration.echoLearnerOrigin(refererOrigin) == null) {
            return "credentialed_referer_untrusted";
        }
        return null;
    }

    private static String originFromReferer(String referer) {
        if (referer == null || referer.isBlank()) return null;
        try {
            URI uri = URI.create(referer);
            if (uri.getScheme() == null || uri.getHost() == null || uri.getUserInfo() != null
                    || (!"http".equalsIgnoreCase(uri.getScheme()) && !"https".equalsIgnoreCase(uri.getScheme()))) {
                return null;
            }
            String host = uri.getHost().toLowerCase(Locale.ROOT);
            String scheme = uri.getScheme().toLowerCase(Locale.ROOT);
            String renderedHost = host.contains(":") ? "[" + host + "]" : host;
            return uri.getPort() < 0
                    ? scheme + "://" + renderedHost
                    : scheme + "://" + renderedHost + ":" + uri.getPort();
        } catch (IllegalArgumentException exception) {
            return null;
        }
    }

    private void deny(HttpServletRequest request, HttpServletResponse response) throws IOException {
        String requestId = bounded(request.getHeader("X-Request-Id"), 128);
        String traceId = bounded(request.getHeader("X-Trace-Id"), 128);
        response.setStatus(HttpServletResponse.SC_FORBIDDEN);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding("UTF-8");
        response.setHeader(HttpHeaders.CACHE_CONTROL, "no-store");
        response.setHeader("X-Request-Id", requestId);
        response.setHeader("X-Trace-Id", traceId);
        response.setHeader("X-API-Version", "v1");
        Map<String, Object> error = new LinkedHashMap<>();
        error.put("errorCode", "FORBIDDEN");
        error.put("message", "iam.auth.origin_untrusted");
        error.put("retryable", false);
        Map<String, Object> meta = new LinkedHashMap<>();
        meta.put("requestId", requestId);
        meta.put("traceId", traceId);
        meta.put("apiVersion", "v1");
        meta.put("schemaVersion", "1.0.0");
        meta.put("serverTime", Instant.now());
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("error", error);
        body.put("meta", meta);
        objectMapper.writeValue(response.getOutputStream(), body);
    }

    private static String bounded(String value, int maxLength) {
        if (value == null || value.isBlank() || value.length() > maxLength
                || value.chars().anyMatch(Character::isISOControl)) {
            return UUID.randomUUID().toString();
        }
        return value;
    }
}
