package com.englishflow.workflow.adapter.http;

import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class ManualRecoveryControllerPermissionTest {

    private static Jwt jwt(String tenant, List<String> permissions) {
        return Jwt.withTokenValue("t").header("alg", "none").subject("ops-1")
                .claim("tenant_id", tenant).claim("permissions", permissions)
                .issuedAt(Instant.now()).expiresAt(Instant.now().plusSeconds(60)).build();
    }

    @Test
    void commandPermissionIsRequired() {
        ResponseStatusException denied = assertThrows(ResponseStatusException.class,
                () -> ManualRecoveryController.requirePermission(jwt("platform", List.of("admin.recovery.read")), "admin.recovery.command"));
        assertEquals(403, denied.getStatusCode().value());
        assertDoesNotThrow(() -> ManualRecoveryController.requirePermission(
                jwt("platform", List.of("admin.recovery.command")), "admin.recovery.command"));
    }

    @Test
    void nonPlatformTenantIsRefused() {
        assertThrows(ResponseStatusException.class, () -> ManualRecoveryController.requirePermission(
                jwt("tenant-x", List.of("admin.recovery.command")), "admin.recovery.command"));
    }
}
