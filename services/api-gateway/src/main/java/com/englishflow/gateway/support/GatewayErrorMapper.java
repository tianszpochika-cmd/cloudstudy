package com.englishflow.gateway.support;

import org.springframework.web.server.ResponseStatusException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;

import java.net.ConnectException;
import java.net.SocketTimeoutException;
import java.util.concurrent.TimeoutException;

public final class GatewayErrorMapper {

    private GatewayErrorMapper() {
    }

    public static GatewayError map(Throwable failure, String requestId, String traceId) {
        Throwable cause = findCause(failure, AuthenticationException.class);
        if (cause instanceof AuthenticationException) {
            return new GatewayError(401, "unauthorized", "Authentication is required.", requestId, traceId);
        }
        cause = findCause(failure, AccessDeniedException.class);
        if (cause instanceof AccessDeniedException) {
            return new GatewayError(403, "forbidden", "The request is not allowed.", requestId, traceId);
        }
        cause = findCause(failure, ResponseStatusException.class);
        if (cause instanceof ResponseStatusException responseStatusException) {
            int status = responseStatusException.getStatusCode().value();
            return new GatewayError(status, codeFor(status), messageFor(status), requestId, traceId);
        }
        if (findCause(failure, TimeoutException.class) != null
                || findCause(failure, SocketTimeoutException.class) != null
                || hasCauseNamed(failure, "ConnectTimeoutException")) {
            return new GatewayError(504, "upstream_timeout", "The upstream service timed out.", requestId, traceId);
        }
        if (findCause(failure, ConnectException.class) != null) {
            return new GatewayError(503, "upstream_unavailable", "The upstream service is unavailable.", requestId, traceId);
        }
        return new GatewayError(502, "upstream_failure", "The upstream service failed.", requestId, traceId);
    }

    private static Throwable findCause(Throwable failure, Class<? extends Throwable> type) {
        Throwable current = failure;
        while (current != null) {
            if (type.isInstance(current)) {
                return current;
            }
            current = current.getCause();
        }
        return null;
    }

    private static boolean hasCauseNamed(Throwable failure, String simpleName) {
        Throwable current = failure;
        while (current != null) {
            if (simpleName.equals(current.getClass().getSimpleName())) {
                return true;
            }
            current = current.getCause();
        }
        return false;
    }

    private static String codeFor(int status) {
        return switch (status) {
            case 400 -> "bad_request";
            case 401 -> "unauthorized";
            case 403 -> "forbidden";
            case 404 -> "not_found";
            case 409 -> "conflict";
            case 429 -> "rate_limited";
            case 504 -> "upstream_timeout";
            default -> status >= 500 ? "upstream_failure" : "gateway_error";
        };
    }

    private static String messageFor(int status) {
        return switch (status) {
            case 400 -> "The request is invalid.";
            case 401 -> "Authentication is required.";
            case 403 -> "The request is not allowed.";
            case 404 -> "The requested route was not found.";
            case 409 -> "The request conflicts with current state.";
            case 429 -> "Too many requests.";
            case 504 -> "The upstream service timed out.";
            default -> status >= 500 ? "The gateway or upstream service failed." : "The request could not be completed.";
        };
    }
}
