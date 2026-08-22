package com.englishflow.gateway.support;

import org.springframework.web.server.ResponseStatusException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;

import java.net.ConnectException;
import java.util.concurrent.TimeoutException;

public final class GatewayErrorMapper {

    private GatewayErrorMapper() {
    }

    public static GatewayError map(Throwable failure, String requestId, String traceId) {
        if (failure instanceof AuthenticationException) {
            return new GatewayError(401, "unauthorized", "Authentication is required.", requestId, traceId);
        }
        if (failure instanceof AccessDeniedException) {
            return new GatewayError(403, "forbidden", "The request is not allowed.", requestId, traceId);
        }
        if (failure instanceof ResponseStatusException responseStatusException) {
            int status = responseStatusException.getStatusCode().value();
            return new GatewayError(status, codeFor(status), messageFor(status), requestId, traceId);
        }
        if (failure instanceof TimeoutException) {
            return new GatewayError(504, "upstream_timeout", "The upstream service timed out.", requestId, traceId);
        }
        if (failure instanceof ConnectException) {
            return new GatewayError(503, "upstream_unavailable", "The upstream service is unavailable.", requestId, traceId);
        }
        return new GatewayError(502, "upstream_failure", "The upstream service failed.", requestId, traceId);
    }

    private static String codeFor(int status) {
        return switch (status) {
            case 400 -> "bad_request";
            case 401 -> "unauthorized";
            case 403 -> "forbidden";
            case 404 -> "not_found";
            case 409 -> "conflict";
            case 429 -> "rate_limited";
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
            default -> status >= 500 ? "The gateway or upstream service failed." : "The request could not be completed.";
        };
    }
}
