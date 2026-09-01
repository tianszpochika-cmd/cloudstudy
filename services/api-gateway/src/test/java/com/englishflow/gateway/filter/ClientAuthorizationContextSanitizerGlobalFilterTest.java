package com.englishflow.gateway.filter;

import org.junit.jupiter.api.Test;
import org.springframework.mock.http.server.reactive.MockServerHttpRequest;
import org.springframework.mock.web.server.MockServerWebExchange;
import reactor.core.publisher.Mono;

import static org.junit.jupiter.api.Assertions.assertNull;

class ClientAuthorizationContextSanitizerGlobalFilterTest {

    @Test
    void removesClientAuthorityAndForwardedIdentityHeadersBeforeRouting() {
        var exchange = MockServerWebExchange.from(MockServerHttpRequest.get("/api/v1/learner/profile")
                .header("X-Role", "platform-admin")
                .header("X-B5-Role", "admin")
                .header("X-Tenant-Id", "tenant-attacker")
                .header("X-Owner-Id", "owner-attacker")
                .header("X-Subject", "subject-attacker")
                .header("X-Subject-Id", "subject-id-attacker")
                .header("X-Forwarded-Roles", "platform-admin")
                .header("X-Forwarded-Tenant-Id", "tenant-attacker")
                .build());

        new ClientAuthorizationContextSanitizerGlobalFilter()
                .filter(exchange, forwarded -> {
                    assertNull(forwarded.getRequest().getHeaders().getFirst("X-Role"));
                    assertNull(forwarded.getRequest().getHeaders().getFirst("X-B5-Role"));
                    assertNull(forwarded.getRequest().getHeaders().getFirst("X-Tenant-Id"));
                    assertNull(forwarded.getRequest().getHeaders().getFirst("X-Owner-Id"));
                    assertNull(forwarded.getRequest().getHeaders().getFirst("X-Subject"));
                    assertNull(forwarded.getRequest().getHeaders().getFirst("X-Subject-Id"));
                    assertNull(forwarded.getRequest().getHeaders().getFirst("X-Forwarded-Roles"));
                    assertNull(forwarded.getRequest().getHeaders().getFirst("X-Forwarded-Tenant-Id"));
                    return Mono.empty();
                })
                .block();
    }
}
