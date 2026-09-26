package com.englishflow.adminops.adapter.failclosed;

import com.englishflow.adminops.domain.AdminOpsException;
import com.englishflow.adminops.domain.AdminPrincipal;
import com.englishflow.adminops.domain.AdminProjectionPort;
import com.englishflow.adminops.domain.AuditEvent;
import com.englishflow.adminops.domain.AuditPage;
import com.englishflow.adminops.domain.AuditRecord;
import com.englishflow.adminops.domain.AuditTrail;
import com.englishflow.adminops.domain.CommandForwardResult;
import com.englishflow.adminops.domain.DomainCommand;
import com.englishflow.adminops.domain.DomainCommandPort;
import com.englishflow.adminops.domain.IdempotencyLedger;
import com.englishflow.adminops.domain.ProjectionQuery;
import com.englishflow.adminops.domain.ProjectionRecord;
import com.englishflow.adminops.support.MediaObjectAuthorizationPort;
import com.englishflow.adminops.support.MediaObjectRef;
import java.util.List;
import java.util.Optional;

/**
 * local-real safety boundary. Admin-ops does not acknowledge projection, command, audit,
 * idempotency, or media authorization facts until durable adapters are wired.
 */
public final class FailClosedAdminOpsAdapters {
    private FailClosedAdminOpsAdapters() { }

    public static final class Projection implements AdminProjectionPort {
        @Override
        public List<ProjectionRecord> query(AdminPrincipal principal, ProjectionQuery query) {
            throw unavailable("ADMIN_PROJECTION_UNAVAILABLE");
        }
    }

    public static final class CommandForwarder implements DomainCommandPort {
        @Override
        public CommandForwardResult forward(DomainCommand command) {
            throw unavailable("ADMIN_DOMAIN_COMMAND_UNAVAILABLE");
        }
    }

    public static final class Audit implements AuditTrail {
        @Override
        public AuditRecord append(AuditEvent event) {
            throw unavailable("ADMIN_AUDIT_UNAVAILABLE");
        }

        @Override
        public List<AuditRecord> snapshot() {
            throw unavailable("ADMIN_AUDIT_UNAVAILABLE");
        }

        @Override
        public AuditPage page(String tenantRef, Long beforeSequence, int pageSize) {
            throw unavailable("ADMIN_AUDIT_UNAVAILABLE");
        }
    }

    public static final class Idempotency implements IdempotencyLedger {
        @Override
        public Optional<Entry> find(String scope, String key) {
            throw unavailable("ADMIN_IDEMPOTENCY_UNAVAILABLE");
        }

        @Override
        public void put(String scope, String key, String fingerprint, Object result) {
            throw unavailable("ADMIN_IDEMPOTENCY_UNAVAILABLE");
        }
    }

    public static final class MediaAuthorization implements MediaObjectAuthorizationPort {
        @Override
        public void requireReadable(AdminPrincipal principal, MediaObjectRef mediaObject) {
            throw unavailable("ADMIN_MEDIA_AUTHORIZATION_UNAVAILABLE");
        }
    }

    private static AdminOpsException unavailable(String code) {
        return new AdminOpsException(code, "local-real durable adapter is not configured", 503, true);
    }
}
