package com.englishflow.adminops.domain;

import org.junit.jupiter.api.Test;

import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Verified-identity record: server-derived tenant scope, permission/role lookup,
 * and normalization of permission/role sets.
 *
 * Note: production principals are only created by HTTP adapters after token verification;
 * no request body or client header can construct one.
 */
class AdminPrincipalTest {

    private static String codeOf(Throwable thrown) {
        assertThat(thrown).isInstanceOf(AdminOpsException.class);
        return ((AdminOpsException) thrown).code();
    }

    // --- construction guards ---

    @Test
    void rejectsMissingSubjectId() {
        assertThatThrownBy(() -> new AdminPrincipal(null, "tenant-1", Set.of(), Set.of(), null))
                .satisfies(t -> assertThat(codeOf(t)).isEqualTo("ADMIN_UNAUTHENTICATED"));
        assertThatThrownBy(() -> new AdminPrincipal("  ", "tenant-1", Set.of(), Set.of(), null))
                .satisfies(t -> assertThat(codeOf(t)).isEqualTo("ADMIN_UNAUTHENTICATED"));
    }

    @Test
    void rejectsMissingServerDerivedTenant() {
        assertThatThrownBy(() -> new AdminPrincipal("admin-1", null, Set.of(), Set.of(), null))
                .satisfies(t -> assertThat(codeOf(t)).isEqualTo("ADMIN_TENANT_MISSING"));
        assertThatThrownBy(() -> new AdminPrincipal("admin-1", "", Set.of(), Set.of(), null))
                .satisfies(t -> assertThat(codeOf(t)).isEqualTo("ADMIN_TENANT_MISSING"));
    }

    @Test
    void tenantMissingIsForbiddenNotUnauthenticated() {
        assertThatThrownBy(() -> new AdminPrincipal("admin-1", "", Set.of(), Set.of(), null))
                .satisfies(t -> {
                    AdminOpsException ex = (AdminOpsException) t;
                    assertThat(ex.status()).isEqualTo(403);
                    assertThat(ex.retryable()).isFalse();
                });
    }

    // --- permission / role lookup ---

    @Test
    void hasPermissionIsExactMatchAndNullSafe() {
        AdminPrincipal principal = new AdminPrincipal(
                "admin-1", "tenant-1", Set.of("media.read", "audit.view"), Set.of(), null);

        assertThat(principal.hasPermission("media.read")).isTrue();
        assertThat(principal.hasPermission("audit.view")).isTrue();
        assertThat(principal.hasPermission("media.write")).isFalse();
        assertThat(principal.hasPermission("media")).isFalse();
        assertThat(principal.hasPermission(null)).isFalse();
    }

    @Test
    void hasRoleIsExactMatchAndNullSafe() {
        AdminPrincipal principal = new AdminPrincipal(
                "admin-1", "tenant-1", Set.of(), Set.of("reviewer", "auditor"), null);

        assertThat(principal.hasRole("reviewer")).isTrue();
        assertThat(principal.hasRole("auditor")).isTrue();
        assertThat(principal.hasRole("admin")).isFalse();
        assertThat(principal.hasRole(null)).isFalse();
    }

    // --- normalization ---

    @Test
    void nullPermissionAndRoleSetsAreNormalizedToEmpty() {
        AdminPrincipal principal = new AdminPrincipal("admin-1", "tenant-1", null, null, null);

        assertThat(principal.permissions()).isEmpty();
        assertThat(principal.roles()).isEmpty();
        assertThat(principal.hasPermission("anything")).isFalse();
        assertThat(principal.hasRole("anything")).isFalse();
    }

    @Test
    void blankEntrysAreDroppedAndValuesAreTrimmed() {
        AdminPrincipal principal = new AdminPrincipal("admin-1", "tenant-1",
                Set.of(" media.read ", "", "   "), Set.of(" reviewer "), null);

        assertThat(principal.permissions()).containsExactly("media.read");
        assertThat(principal.roles()).containsExactly("reviewer");
    }

    // --- workload identity ---

    @Test
    void blankWorkloadIdBecomesNull() {
        assertThat(new AdminPrincipal("admin-1", "tenant-1", Set.of(), Set.of(), "   ").workloadId()).isNull();
        assertThat(new AdminPrincipal("admin-1", "tenant-1", Set.of(), Set.of(), null).workloadId()).isNull();
    }

    @Test
    void workloadFlagReflectsWorkloadIdPresence() {
        assertThat(new AdminPrincipal("admin-1", "tenant-1", Set.of(), Set.of(), "svc-learning").isWorkload())
                .isTrue();
        assertThat(new AdminPrincipal("admin-1", "tenant-1", Set.of(), Set.of(), null).isWorkload())
                .isFalse();
    }

    @Test
    void workloadFactoryBuildsServicePrincipalWithScopedPermissions() {
        AdminPrincipal principal = AdminPrincipal.workload("svc-learning", "tenant-1", "media.read");

        assertThat(principal.isWorkload()).isTrue();
        assertThat(principal.workloadId()).isEqualTo("svc-learning");
        assertThat(principal.subjectId()).isEqualTo("workload:svc-learning");
        assertThat(principal.tenantId()).isEqualTo("tenant-1");
        assertThat(principal.hasPermission("media.read")).isTrue();
        assertThat(principal.roles()).isEmpty();
    }
}
