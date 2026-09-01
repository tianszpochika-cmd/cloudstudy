package com.englishflow.gateway.filter;

import org.springframework.http.HttpHeaders;

import java.util.List;

/**
 * Header names which must never become authorization input at the Gateway or
 * any routed upstream. These values are supplied only by a client and are not
 * token-derived facts.
 */
public final class ClientAuthorizationContextHeaders {

    public static final List<String> NAMES = List.of(
            "X-B5-Role",
            "X-Role",
            "X-Tenant-Id",
            "X-Owner-Id",
            "X-Subject",
            "X-Subject-Id",
            "X-Permissions",
            "X-Policy-Version",
            "X-User-Id",
            "X-Principal",
            "X-Principal-Id",
            "X-Forwarded-User",
            "X-Forwarded-User-Id",
            "X-Forwarded-Roles",
            "X-Forwarded-Tenant-Id",
            "X-Forwarded-Owner-Id"
    );

    private ClientAuthorizationContextHeaders() {
    }

    public static void removeFrom(HttpHeaders headers) {
        NAMES.forEach(headers::remove);
    }
}
