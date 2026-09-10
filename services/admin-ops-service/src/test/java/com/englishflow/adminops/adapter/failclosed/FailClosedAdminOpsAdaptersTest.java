package com.englishflow.adminops.adapter.failclosed;

import com.englishflow.adminops.domain.AdminOpsException;
import com.englishflow.adminops.domain.AdminPrincipal;
import org.junit.jupiter.api.Test;

import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * local-real safety boundary: admin-ops must NOT acknowledge projection, command, audit,
 * idempotency or media-authorization facts until durable adapters are wired.
 *
 * Every fail-closed adapter must throw {@code 503 + retryable}, never silently succeed.
 */
class FailClosedAdminOpsAdaptersTest {

    private static final AdminPrincipal PRINCIPAL =
            new AdminPrincipal("admin-1", "tenant-1", Set.of(), Set.of(), null);

    @FunctionalInterface
    private interface Call {
        void run();
    }

    private static void assertUnavailable(String expectedCode, Call call) {
        assertThatThrownBy(call::run).satisfies(thrown -> {
            assertThat(thrown).isInstanceOf(AdminOpsException.class);
            AdminOpsException ex = (AdminOpsException) thrown;
            assertThat(ex.code()).isEqualTo(expectedCode);
            assertThat(ex.status()).isEqualTo(503);
            assertThat(ex.retryable()).isTrue();
            assertThat(ex.getMessage()).isNotBlank();
        });
    }

    @Test
    void projectionRefusesToAcknowledgeFacts() {
        FailClosedAdminOpsAdapters.Projection projection = new FailClosedAdminOpsAdapters.Projection();
        assertUnavailable("ADMIN_PROJECTION_UNAVAILABLE", () -> projection.query(PRINCIPAL, null));
    }

    @Test
    void projectionRefusesEvenWithoutPrincipal() {
        FailClosedAdminOpsAdapters.Projection projection = new FailClosedAdminOpsAdapters.Projection();
        assertUnavailable("ADMIN_PROJECTION_UNAVAILABLE", () -> projection.query(null, null));
    }

    @Test
    void commandForwarderRefusesToForward() {
        FailClosedAdminOpsAdapters.CommandForwarder forwarder = new FailClosedAdminOpsAdapters.CommandForwarder();
        assertUnavailable("ADMIN_DOMAIN_COMMAND_UNAVAILABLE", () -> forwarder.forward(null));
    }

    @Test
    void auditTrailRefusesToAppend() {
        FailClosedAdminOpsAdapters.Audit audit = new FailClosedAdminOpsAdapters.Audit();
        assertUnavailable("ADMIN_AUDIT_UNAVAILABLE", () -> audit.append(null));
    }

    @Test
    void auditTrailRefusesToSnapshot() {
        FailClosedAdminOpsAdapters.Audit audit = new FailClosedAdminOpsAdapters.Audit();
        assertUnavailable("ADMIN_AUDIT_UNAVAILABLE", audit::snapshot);
    }

    @Test
    void idempotencyLedgerRefusesToRead() {
        FailClosedAdminOpsAdapters.Idempotency ledger = new FailClosedAdminOpsAdapters.Idempotency();
        assertUnavailable("ADMIN_IDEMPOTENCY_UNAVAILABLE", () -> ledger.find("scope", "key"));
    }

    @Test
    void idempotencyLedgerRefusesToWrite() {
        FailClosedAdminOpsAdapters.Idempotency ledger = new FailClosedAdminOpsAdapters.Idempotency();
        assertUnavailable("ADMIN_IDEMPOTENCY_UNAVAILABLE", () -> ledger.put("scope", "key", "fingerprint", null));
    }

    @Test
    void mediaAuthorizationRefusesToGrantAccess() {
        FailClosedAdminOpsAdapters.MediaAuthorization authorization =
                new FailClosedAdminOpsAdapters.MediaAuthorization();
        assertUnavailable("ADMIN_MEDIA_AUTHORIZATION_UNAVAILABLE",
                () -> authorization.requireReadable(PRINCIPAL, null));
    }

    @Test
    void mediaAuthorizationRefusesEvenWithoutPrincipal() {
        FailClosedAdminOpsAdapters.MediaAuthorization authorization =
                new FailClosedAdminOpsAdapters.MediaAuthorization();
        assertUnavailable("ADMIN_MEDIA_AUTHORIZATION_UNAVAILABLE",
                () -> authorization.requireReadable(null, null));
    }
}
