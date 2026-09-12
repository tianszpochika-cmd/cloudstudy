package com.englishflow.adminops.domain;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class AdminPepTest {

    private static final String TENANT = "platform";
    private final AdminPep pep = new AdminPep();

    @Test
    void missingPrincipalIsUnauthenticated() {
        assertThatThrownBy(() -> pep.requireAuthenticated(null))
                .isInstanceOf(AdminOpsException.class)
                .extracting(failure -> ((AdminOpsException) failure).code())
                .isEqualTo("ADMIN_UNAUTHENTICATED");
    }

    @Test
    void permissionIsRequiredAndDefaultDenied() {
        AdminPrincipal principal = AdminPrincipal.user("operator-1", TENANT, "admin.content.review");

        assertThatCode(() -> pep.requirePermission(principal, "admin.content.review")).doesNotThrowAnyException();
        assertThatThrownBy(() -> pep.requirePermission(principal, "admin.content.publish"))
                .isInstanceOf(AdminOpsException.class)
                .extracting(failure -> ((AdminOpsException) failure).code())
                .isEqualTo("ADMIN_PERMISSION_DENIED");
        assertThatThrownBy(() -> pep.requirePermission(principal, " "))
                .isInstanceOf(AdminOpsException.class);
    }

    @Test
    void tenantMustBePresentAndMatch() {
        AdminPrincipal principal = AdminPrincipal.user("operator-1", TENANT, "admin.content.review");

        assertThatCode(() -> pep.requireTenant(principal, TENANT)).doesNotThrowAnyException();
        assertThatThrownBy(() -> pep.requireTenant(principal, "other"))
                .isInstanceOf(AdminOpsException.class)
                .extracting(failure -> ((AdminOpsException) failure).code())
                .isEqualTo("ADMIN_TENANT_FORBIDDEN");
        assertThatThrownBy(() -> pep.requireTenant(principal, null))
                .isInstanceOf(AdminOpsException.class)
                .extracting(failure -> ((AdminOpsException) failure).code())
                .isEqualTo("ADMIN_RESOURCE_TENANT_MISSING");
    }

    @Test
    void authorCannotOperateTheirOwnResource() {
        AdminPrincipal principal = AdminPrincipal.user("operator-1", TENANT, "admin.content.publish");

        assertThatThrownBy(() -> pep.requireOperatorNotAuthor(principal, "operator-1"))
                .isInstanceOf(AdminOpsException.class)
                .extracting(failure -> ((AdminOpsException) failure).code())
                .isEqualTo("ADMIN_AUTHOR_OPERATOR_CONFLICT");
        assertThatCode(() -> pep.requireOperatorNotAuthor(principal, "author-9")).doesNotThrowAnyException();
        assertThatCode(() -> pep.requireOperatorNotAuthor(principal, null)).doesNotThrowAnyException();
    }

    @Test
    void exceptionCarriesStableStatuses() {
        assertThat(AdminOpsException.unauthenticated().status()).isEqualTo(401);
        assertThat(AdminOpsException.forbidden("X", "x").status()).isEqualTo(403);
    }
}
