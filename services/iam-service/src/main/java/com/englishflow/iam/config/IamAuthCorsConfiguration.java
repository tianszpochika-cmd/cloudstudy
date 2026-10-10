package com.englishflow.iam.config;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpHeaders;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;

import java.net.URI;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/**
 * Browser CORS for the direct IAM TLS auth entry only.
 * Learner Web and Mobile H5 are the only credentialed origins. Other routes stay closed.
 */
@Configuration(proxyBeanMethods = false)
public class IamAuthCorsConfiguration {

    static final String LEARNER_WEB_ORIGIN = "http://127.0.0.1:18180";
    static final String MOBILE_H5_ORIGIN = "http://127.0.0.1:18183";
    private static final Set<String> LEARNER_ORIGINS = Set.of(LEARNER_WEB_ORIGIN, MOBILE_H5_ORIGIN);
    private static final List<String> ALLOWED_METHODS = List.of("POST", "OPTIONS");
    private static final List<String> ALLOWED_HEADERS = List.of(
            HttpHeaders.AUTHORIZATION, HttpHeaders.CONTENT_TYPE, "Idempotency-Key", HttpHeaders.ACCEPT);

    @Bean
    CorsConfigurationSource iamAuthCorsConfigurationSource() {
        return IamAuthCorsConfiguration::configurationFor;
    }

    static CorsConfiguration configurationFor(HttpServletRequest request) {
        if (!isAuthApiPath(request)) return null;
        String echoed = echoLearnerOrigin(request.getHeader(HttpHeaders.ORIGIN));
        if (echoed == null) return null;
        if (isPreflight(request) && !preflightAllowed(request)) return null;
        CorsConfiguration configuration = new CorsConfiguration();
        configuration.setAllowedOrigins(List.of(echoed));
        configuration.setAllowedMethods(ALLOWED_METHODS);
        configuration.setAllowedHeaders(ALLOWED_HEADERS);
        configuration.setAllowCredentials(true);
        configuration.setMaxAge(1800L);
        return configuration;
    }

    private static boolean isPreflight(HttpServletRequest request) {
        return "OPTIONS".equalsIgnoreCase(request.getMethod())
                && request.getHeader(HttpHeaders.ACCESS_CONTROL_REQUEST_METHOD) != null;
    }

    private static boolean preflightAllowed(HttpServletRequest request) {
        String method = request.getHeader(HttpHeaders.ACCESS_CONTROL_REQUEST_METHOD);
        if (method == null || method.isBlank()) return false;
        boolean methodAllowed = ALLOWED_METHODS.stream().anyMatch(candidate -> candidate.equalsIgnoreCase(method.trim()));
        if (!methodAllowed) return false;
        String requestedHeaders = request.getHeader(HttpHeaders.ACCESS_CONTROL_REQUEST_HEADERS);
        if (requestedHeaders == null || requestedHeaders.isBlank()) return true;
        for (String header : requestedHeaders.split(",")) {
            String name = header.trim();
            if (name.isEmpty()) continue;
            boolean headerAllowed = ALLOWED_HEADERS.stream().anyMatch(candidate -> candidate.equalsIgnoreCase(name));
            if (!headerAllowed) return false;
        }
        return true;
    }

    static boolean isAuthApiPath(HttpServletRequest request) {
        String path = requestPath(request);
        if (path.indexOf('\\') >= 0 || path.indexOf("..") >= 0 || path.indexOf('%') >= 0) return false;
        return path.startsWith("/api/v1/auth/");
    }

    /** Returns the request Origin unchanged when it is a fixed learner loopback origin. */
    static String echoLearnerOrigin(String originHeader) {
        if (originHeader == null) return null;
        String trimmed = originHeader.trim();
        if (trimmed.isEmpty() || "null".equalsIgnoreCase(trimmed)) return null;
        String canonical = canonicalLearnerOrigin(trimmed);
        return canonical != null && LEARNER_ORIGINS.contains(canonical) ? trimmed : null;
    }

    private static String canonicalLearnerOrigin(String origin) {
        try {
            URI uri = URI.create(origin);
            String scheme = uri.getScheme();
            String host = uri.getHost();
            if (scheme == null || host == null || !"http".equalsIgnoreCase(scheme)) return null;
            if (uri.getUserInfo() != null || uri.getRawQuery() != null || uri.getRawFragment() != null) return null;
            String rawPath = uri.getRawPath();
            if (rawPath != null && !rawPath.isEmpty()) return null;
            int port = uri.getPort();
            if (port != 18180 && port != 18183) return null;
            if (!"localhost".equalsIgnoreCase(host) && !"127.0.0.1".equals(host)) return null;
            return "http://127.0.0.1:" + port;
        } catch (IllegalArgumentException exception) {
            return null;
        }
    }

    private static String requestPath(HttpServletRequest request) {
        String uri = request.getRequestURI();
        if (uri == null || uri.isBlank()) return "";
        String context = request.getContextPath();
        if (context != null && !context.isEmpty() && uri.startsWith(context)) uri = uri.substring(context.length());
        int query = uri.indexOf('?');
        if (query >= 0) uri = uri.substring(0, query);
        if (!uri.startsWith("/")) uri = "/" + uri;
        return uri.toLowerCase(Locale.ROOT);
    }
}
