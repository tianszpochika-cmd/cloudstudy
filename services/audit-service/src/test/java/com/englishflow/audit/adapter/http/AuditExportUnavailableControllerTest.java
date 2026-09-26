package com.englishflow.audit.adapter.http;

import java.time.Instant;
import java.util.List;

import org.junit.jupiter.api.Test;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import static org.hamcrest.Matchers.not;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class AuditExportUnavailableControllerTest {

    private static final String BASE = "/internal/v1/audit/exports";
    private static final String EXPORT_ID = "audit-export_12345678";
    private static final String KEY = "audit-key-12345678";

    private final MockMvc mvc = MockMvcBuilders.standaloneSetup(new AuditExportUnavailableController()).build();

    @Test
    void everyInternalOperationFailsClosedWithoutInventingJobsOrGrants() throws Exception {
        assertUnavailable(post(BASE).header("Idempotency-Key", KEY)
                .principal(service("admin-ops-service", "admin-ops-service", "admin-ops-service",
                        "platform", "audit.export.create")));
        assertUnavailable(get(BASE + "/" + EXPORT_ID)
                .principal(service("admin-ops-service", "admin-ops-service", "admin-ops-service",
                        "platform", "audit.export.read")));
        assertUnavailable(post(BASE + "/" + EXPORT_ID + "/download").header("Idempotency-Key", KEY)
                .principal(service("admin-ops-service", "admin-ops-service", "admin-ops-service",
                        "platform", "audit.export.download")));
        assertUnavailable(post(BASE + "/" + EXPORT_ID + "/recovery").header("Idempotency-Key", KEY)
                .principal(service("workflow-service", "workflow-service", "workflow-service",
                        "platform", "audit.export.recover")));
    }

    @Test
    void noTokenAndAccessTokenCannotStartAnExport() throws Exception {
        mvc.perform(post(BASE).header("Idempotency-Key", KEY))
                .andExpect(status().isUnauthorized())
                .andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(jsonPath("$.error.errorCode").value("AUTH_REQUIRED"));
        mvc.perform(post(BASE).header("Idempotency-Key", KEY)
                        .principal(token("admin-ops-service", "admin-ops-service", "admin-ops-service",
                                "platform", "access", "audit.export.create")))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error.errorCode").value("FORBIDDEN"));
    }

    @Test
    void workloadIdentityTenantAndExactPermissionAreRequired() throws Exception {
        for (JwtAuthenticationToken principal : List.of(
                service("unknown-service", "unknown-service", "unknown-service", "platform", "audit.export.create"),
                service("admin-ops-service", "different-service", "admin-ops-service", "platform", "audit.export.create"),
                service("admin-ops-service", "admin-ops-service", "different-service", "platform", "audit.export.create"),
                service("admin-ops-service", "admin-ops-service", "admin-ops-service", "other", "audit.export.create"),
                service("admin-ops-service", "admin-ops-service", "admin-ops-service", "platform", "audit.export.read"))) {
            mvc.perform(post(BASE).header("Idempotency-Key", KEY).principal(principal))
                    .andExpect(status().isForbidden())
                    .andExpect(header().string("Cache-Control", "no-store"))
                    .andExpect(jsonPath("$.error.errorCode").value("FORBIDDEN"));
        }
        mvc.perform(post(BASE + "/" + EXPORT_ID + "/recovery").header("Idempotency-Key", KEY)
                        .principal(service("admin-ops-service", "admin-ops-service", "admin-ops-service",
                                "platform", "audit.export.recover")))
                .andExpect(status().isForbidden());
    }

    @Test
    void malformedKeysAndExportIdsFailBeforeUnavailableResult() throws Exception {
        JwtAuthenticationToken creator = service("admin-ops-service", "admin-ops-service", "admin-ops-service",
                "platform", "audit.export.create");
        mvc.perform(post(BASE).principal(creator))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.errorCode").value("VALIDATION_ERROR"));
        mvc.perform(post(BASE).header("Idempotency-Key", "short").principal(creator))
                .andExpect(status().isBadRequest());
        mvc.perform(get(BASE + "/wrong-id")
                        .principal(service("workflow-service", "workflow-service", "workflow-service",
                                "platform", "audit.export.read")))
                .andExpect(status().isBadRequest());
    }

    @Test
    void responseCorrelationMatchesValidatedHeaders() throws Exception {
        String requestId = "request-12345678";
        String traceId = "0123456789abcdef0123456789abcdef";
        mvc.perform(get(BASE + "/" + EXPORT_ID)
                        .header("X-Request-Id", requestId)
                        .header("X-Trace-Id", traceId)
                        .principal(service("workflow-service", "workflow-service", "workflow-service",
                                "platform", "audit.export.read")))
                .andExpect(status().isServiceUnavailable())
                .andExpect(header().string("X-Request-Id", requestId))
                .andExpect(header().string("X-Trace-Id", traceId))
                .andExpect(jsonPath("$.meta.requestId").value(requestId))
                .andExpect(jsonPath("$.meta.traceId").value(traceId));
    }

    private void assertUnavailable(MockHttpServletRequestBuilder request) throws Exception {
        mvc.perform(request)
                .andExpect(status().isServiceUnavailable())
                .andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(header().string("X-API-Version", "v1"))
                .andExpect(jsonPath("$.error.errorCode").value("SERVICE_UNAVAILABLE"))
                .andExpect(jsonPath("$.error.retryable").value(false))
                .andExpect(jsonPath("$.meta.requestId").isString())
                .andExpect(jsonPath("$.meta.traceId").isString())
                .andExpect(jsonPath("$.meta.apiVersion").value("v1"))
                .andExpect(jsonPath("$.data").doesNotExist())
                .andExpect(content().string(not(containsString("grantRef"))))
                .andExpect(content().string(not(containsString("downloadUrl"))))
                .andExpect(content().string(not(containsString(EXPORT_ID))));
    }

    private static JwtAuthenticationToken service(String subject, String serviceId, String clientId,
                                                  String tenant, String permission) {
        return token(subject, serviceId, clientId, tenant, "service", permission);
    }

    private static JwtAuthenticationToken token(String subject, String serviceId, String clientId,
                                                String tenant, String tokenType, String permission) {
        Jwt jwt = Jwt.withTokenValue("verified-token")
                .header("alg", "RS256")
                .subject(subject)
                .issuedAt(Instant.parse("2026-09-23T00:00:00Z"))
                .expiresAt(Instant.parse("2026-09-23T01:00:00Z"))
                .claim("service_id", serviceId)
                .claim("client_id", clientId)
                .claim("tenant_id", tenant)
                .claim("token_type", tokenType)
                .claim("permissions", List.of(permission))
                .claim("scope", permission)
                .build();
        return new JwtAuthenticationToken(jwt, List.of(new SimpleGrantedAuthority(permission)), subject);
    }
}
