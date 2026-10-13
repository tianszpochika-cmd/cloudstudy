package com.englishflow.workflow.adapter.http;

import com.englishflow.workflow.application.ManualRecoveryService;
import com.englishflow.workflow.application.WorkflowRequestIdempotency;
import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * P2-2: every recovery endpoint must enforce its permission itself, not just
 * rely on the security filter chain. Testing the helper alone would stay green
 * if an endpoint stopped calling it, so these tests call the endpoints with a
 * wrongly-scoped token and require a 403 before the service is touched.
 */
class ManualRecoveryControllerEndpointPermissionTest {

    private static Jwt jwt(String tenant, List<String> permissions) {
        return Jwt.withTokenValue("endpoint-test-token").header("alg", "none").subject("ops-1")
                .claim("tenant_id", tenant).claim("permissions", permissions)
                .issuedAt(Instant.now()).expiresAt(Instant.now().plusSeconds(60)).build();
    }

    private static Jwt jwtWithoutPermissionsClaim() {
        return Jwt.withTokenValue("endpoint-test-token").header("alg", "none").subject("ops-1")
                .claim("tenant_id", "platform")
                .issuedAt(Instant.now()).expiresAt(Instant.now().plusSeconds(60)).build();
    }

    private static ManualRecoveryController controller(ManualRecoveryService service,
                                                       WorkflowRequestIdempotency idempotency) {
        return new ManualRecoveryController(service, idempotency);
    }

    private static Map<String, Object> requestBody() {
        return Map.of("subjectType", "TICKET", "subjectId", "t-1", "action", "REOPEN", "reason", "stuck closed");
    }

    @Test
    void requestWithCommandPermissionOnlyIsRefusedBeforeTheServiceRuns() {
        ManualRecoveryService service = mock(ManualRecoveryService.class);
        WorkflowRequestIdempotency idempotency = mock(WorkflowRequestIdempotency.class);
        Jwt wrongScope = jwt("platform", List.of("admin.recovery.command"));

        ResponseStatusException denied = assertThrows(ResponseStatusException.class,
                () -> controller(service, idempotency).request(wrongScope, requestBody(), "req-key-0001"));
        assertEquals(403, denied.getStatusCode().value());
        verifyNoInteractions(service, idempotency);
    }

    @Test
    void approveWithRequestPermissionOnlyIsRefusedBeforeTheServiceRuns() {
        ManualRecoveryService service = mock(ManualRecoveryService.class);
        WorkflowRequestIdempotency idempotency = mock(WorkflowRequestIdempotency.class);
        Jwt wrongScope = jwt("platform", List.of("admin.recovery.request"));

        ResponseStatusException denied = assertThrows(ResponseStatusException.class,
                () -> controller(service, idempotency).approve(wrongScope, "rec-1", null, "appr-key-0001"));
        assertEquals(403, denied.getStatusCode().value());
        verifyNoInteractions(service, idempotency);
    }

    @Test
    void rejectWithRequestPermissionOnlyIsRefusedBeforeTheServiceRuns() {
        ManualRecoveryService service = mock(ManualRecoveryService.class);
        WorkflowRequestIdempotency idempotency = mock(WorkflowRequestIdempotency.class);
        Jwt wrongScope = jwt("platform", List.of("admin.recovery.request"));

        ResponseStatusException denied = assertThrows(ResponseStatusException.class,
                () -> controller(service, idempotency).reject(wrongScope, "rec-1", null, "rej-key-0001"));
        assertEquals(403, denied.getStatusCode().value());
        verifyNoInteractions(service, idempotency);
    }

    @Test
    void executeWithRequestPermissionOnlyIsRefusedBeforeTheServiceRuns() {
        ManualRecoveryService service = mock(ManualRecoveryService.class);
        WorkflowRequestIdempotency idempotency = mock(WorkflowRequestIdempotency.class);
        Jwt wrongScope = jwt("platform", List.of("admin.recovery.request"));

        ResponseStatusException denied = assertThrows(ResponseStatusException.class,
                () -> controller(service, idempotency).execute(wrongScope, "rec-1", null, "exec-key-0001"));
        assertEquals(403, denied.getStatusCode().value());
        verifyNoInteractions(service, idempotency);
    }

    @Test
    void executeWithNonPlatformTenantIsRefused() {
        ManualRecoveryService service = mock(ManualRecoveryService.class);
        WorkflowRequestIdempotency idempotency = mock(WorkflowRequestIdempotency.class);
        Jwt foreign = jwt("tenant-x", List.of("admin.recovery.command"));

        ResponseStatusException denied = assertThrows(ResponseStatusException.class,
                () -> controller(service, idempotency).execute(foreign, "rec-1", null, "exec-key-0002"));
        assertEquals(403, denied.getStatusCode().value());
        verifyNoInteractions(service, idempotency);
    }

    @Test
    void requestWithMissingPermissionsClaimIsRefused() {
        ManualRecoveryService service = mock(ManualRecoveryService.class);
        WorkflowRequestIdempotency idempotency = mock(WorkflowRequestIdempotency.class);

        ResponseStatusException denied = assertThrows(ResponseStatusException.class,
                () -> controller(service, idempotency).request(jwtWithoutPermissionsClaim(), requestBody(), "req-key-0002"));
        assertEquals(403, denied.getStatusCode().value());
        verifyNoInteractions(service, idempotency);
    }

    @Test
    void executeWithNullJwtIsRefused() {
        ManualRecoveryService service = mock(ManualRecoveryService.class);
        WorkflowRequestIdempotency idempotency = mock(WorkflowRequestIdempotency.class);

        ResponseStatusException denied = assertThrows(ResponseStatusException.class,
                () -> controller(service, idempotency).execute(null, "rec-1", null, "exec-key-0003"));
        assertEquals(403, denied.getStatusCode().value());
        verifyNoInteractions(service, idempotency);
    }

    @Test
    void correctlyScopedTokensPassTheEndpointGate() {
        ManualRecoveryService service = mock(ManualRecoveryService.class);
        WorkflowRequestIdempotency idempotency = mock(WorkflowRequestIdempotency.class);
        when(idempotency.execute(any(), any(), any(), any(), any(), any()))
                .thenReturn(Map.of("recoveryId", "rec-1", "status", "REQUESTED"));

        ResponseEntity<Map<String, Object>> requested = controller(service, idempotency)
                .request(jwt("platform", List.of("admin.recovery.request")), requestBody(), "req-key-0003");
        assertEquals(201, requested.getStatusCode().value());

        ResponseEntity<Map<String, Object>> executed = controller(service, idempotency)
                .execute(jwt("platform", List.of("admin.recovery.command")), "rec-1", null, "exec-key-0004");
        assertEquals(200, executed.getStatusCode().value());
        verifyNoInteractions(service);
    }
}
