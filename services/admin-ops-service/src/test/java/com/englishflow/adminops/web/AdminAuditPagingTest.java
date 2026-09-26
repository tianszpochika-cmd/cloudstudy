package com.englishflow.adminops.web;

import com.englishflow.adminops.adapter.memory.InMemoryAdminProjection;
import com.englishflow.adminops.adapter.memory.InMemoryAuditTrail;
import com.englishflow.adminops.adapter.memory.InMemoryDomainCommandPort;
import com.englishflow.adminops.adapter.memory.InMemoryIdempotencyLedger;
import com.englishflow.adminops.application.AdminOpsService;
import com.englishflow.adminops.domain.AdminOpsException;
import com.englishflow.adminops.domain.AdminPermission;
import com.englishflow.adminops.domain.AdminPrincipal;
import com.englishflow.adminops.domain.AuditEvent;
import com.englishflow.adminops.domain.ConfirmationService;
import com.englishflow.adminops.security.AdminOpsAuthenticationToken;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.core.context.SecurityContextHolder;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class AdminAuditPagingTest {
    private static final String KEY = "test-only-audit-cursor-key-32-bytes-minimum";

    @AfterEach
    void clearSecurity() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void pagesNewestFirstWithoutDuplicatesOrForeignTenantRecords() {
        InMemoryAuditTrail audit = new InMemoryAuditTrail();
        audit.append(event("tenant-a", "a1"));
        audit.append(event("tenant-b", "b1"));
        audit.append(event("tenant-a", "a2"));
        audit.append(event("tenant-b", "b2"));
        audit.append(event("tenant-a", "a3"));
        AdminOpsController controller = controller(audit, KEY);
        authenticate("tenant-a", AdminPermission.AUDIT_READ);

        ResponseEntity<Map<String, Object>> first = controller.audit(null, 2, request());
        assertThat(operations(first)).containsExactly("a3", "a2");
        assertThat(meta(first)).containsEntry("hasMore", true).containsEntry("pageSize", 2);
        String cursor = (String) meta(first).get("nextCursor");
        assertThat(cursor).matches("[A-Za-z0-9_-]{8,512}");

        audit.append(event("tenant-a", "new-after-page-one"));
        ResponseEntity<Map<String, Object>> second = controller.audit(cursor, 2, request());
        assertThat(operations(second)).containsExactly("a1");
        assertThat(meta(second)).containsEntry("hasMore", false).containsEntry("nextCursor", null);
        assertThat(first.getHeaders().getFirst("X-API-Version")).isEqualTo("v1");
        assertThat(meta(first).keySet()).containsExactlyInAnyOrder("requestId", "traceId", "apiVersion",
                "schemaVersion", "serverTime", "hasMore", "pageSize", "nextCursor");
    }

    @Test
    void rejectsCrossTenantAndMalformedCursorsAndCapsRequestedPageSize() {
        InMemoryAuditTrail audit = new InMemoryAuditTrail();
        audit.append(event("tenant-a", "a1"));
        audit.append(event("tenant-a", "a2"));
        AdminOpsController controller = controller(audit, KEY);
        authenticate("tenant-a", AdminPermission.AUDIT_READ);
        String cursor = (String) meta(controller.audit(null, 1, request())).get("nextCursor");

        authenticate("tenant-b", AdminPermission.AUDIT_READ);
        assertInvalidCursor(() -> controller.audit(cursor, 1, request()));
        assertInvalidCursor(() -> controller.audit("bad-cursor", 1, request()));
        assertThat(meta(controller.audit(null, 500, request()))).containsEntry("pageSize", 100);
        assertThatThrownBy(() -> controller.audit(null, 0, request()))
                .isInstanceOfSatisfying(AdminOpsException.class, error ->
                        assertThat(error.code()).isEqualTo("ADMIN_AUDIT_PAGE_SIZE_INVALID"));
    }

    @Test
    void checksPermissionBeforeCursorAndFailsClosedWithoutConfiguredKey() {
        InMemoryAuditTrail audit = new InMemoryAuditTrail();
        AdminOpsController controller = controller(audit, KEY);
        authenticate("tenant-a");
        assertThatThrownBy(() -> controller.audit("bad-cursor", 1, request()))
                .isInstanceOfSatisfying(AdminOpsException.class, error ->
                        assertThat(error.status()).isEqualTo(403));

        authenticate("tenant-a", AdminPermission.AUDIT_READ);
        AdminOpsController withoutKey = controller(audit, "");
        assertThatThrownBy(() -> withoutKey.audit(null, 1, request()))
                .isInstanceOfSatisfying(AdminOpsException.class, error -> {
                    assertThat(error.status()).isEqualTo(503);
                    assertThat(error.code()).isEqualTo("ADMIN_AUDIT_CURSOR_UNAVAILABLE");
                });
    }

    private static AdminOpsController controller(InMemoryAuditTrail audit, String key) {
        Clock clock = Clock.systemUTC();
        AdminOpsService service = new AdminOpsService(clock, new InMemoryAdminProjection(),
                new InMemoryDomainCommandPort(), audit, new InMemoryIdempotencyLedger(),
                new ConfirmationService(clock, Duration.ofMinutes(5)));
        return new AdminOpsController(service, new AuditCursorCodec(key));
    }

    private static AuditEvent event(String tenant, String operation) {
        return new AuditEvent(tenant, "actor-1", operation, "resource-1", null,
                "trace-1", "decision-1", Map.of(), Instant.parse("2026-09-23T00:00:00Z"));
    }

    private static MockHttpServletRequest request() {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/internal/v1/admin-ops/audit");
        request.addHeader("X-Request-Id", "req-audit-test");
        request.addHeader("X-Trace-Id", "trace-audit-test");
        return request;
    }

    private static void authenticate(String tenant, String... permissions) {
        AdminPrincipal principal = AdminPrincipal.user("auditor-1", tenant, permissions);
        SecurityContextHolder.getContext().setAuthentication(
                new AdminOpsAuthenticationToken(principal, null, List.of()));
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> meta(ResponseEntity<Map<String, Object>> response) {
        return (Map<String, Object>) response.getBody().get("meta");
    }

    @SuppressWarnings("unchecked")
    private static List<String> operations(ResponseEntity<Map<String, Object>> response) {
        Map<String, Object> data = (Map<String, Object>) response.getBody().get("data");
        return ((List<Map<String, Object>>) data.get("items")).stream()
                .map(item -> (String) item.get("operation")).toList();
    }

    private static void assertInvalidCursor(Runnable action) {
        assertThatThrownBy(action::run).isInstanceOfSatisfying(AdminOpsException.class, error -> {
            assertThat(error.status()).isEqualTo(400);
            assertThat(error.code()).isEqualTo("ADMIN_AUDIT_CURSOR_INVALID");
        });
    }
}
