package com.englishflow.iam.domain;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

/** MySQL implementation of the IAM-owned policy control-plane store. */
public final class JdbcPolicyStore implements PolicyStore {
    private static final String VERSION_COLUMNS = "policy_version_id, version_label, lifecycle_status, revision, tenant_id, "
            + "document_json, artifact_digest, created_at, updated_at, created_by, submitted_by, approved_by, "
            + "activated_by, revoked_by, activated_at, revoked_at, cache_invalidation_id, "
            + "cache_invalidation_required, cache_invalidation_status, cache_invalidation_scope, "
            + "cache_invalidation_issued_at, cache_invalidation_completed_at, deny_until_current_version_proven";

    private final JdbcTemplate jdbc;
    private final ObjectMapper objectMapper;

    public JdbcPolicyStore(JdbcTemplate jdbc, ObjectMapper objectMapper) {
        this.jdbc = java.util.Objects.requireNonNull(jdbc, "jdbc");
        this.objectMapper = java.util.Objects.requireNonNull(objectMapper, "objectMapper");
    }

    @Override
    public PolicyVersionRecord create(PolicyVersionRecord record, PolicyAuditRecord audit) {
        try {
            int inserted = jdbc.update("INSERT INTO iam_policy_control_version (" + VERSION_COLUMNS + ") VALUES "
                            + "(?, ?, ?, ?, ?, CAST(? AS JSON), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    record.policyVersionId().toString(), record.version(), record.status().name(), record.revision(),
                    record.tenantId(), writeDocument(record.document()), record.artifactDigest(), timestamp(record.createdAt()),
                    timestamp(record.updatedAt()), record.createdBy().toString(), id(record.submittedBy()),
                    id(record.approvedBy()), id(record.activatedBy()), id(record.revokedBy()), timestamp(record.activatedAt()),
                    timestamp(record.revokedAt()), record.cacheInvalidation().invalidationId().toString(),
                    record.cacheInvalidation().required(), record.cacheInvalidation().status(),
                    record.cacheInvalidation().scope(), timestamp(record.cacheInvalidation().issuedAt()),
                    timestamp(record.cacheInvalidation().completedAt()),
                    record.cacheInvalidation().denyUntilCurrentVersionProven());
            if (inserted != 1) throw unavailable();
            for (PrincipalId contributor : record.contributors()) addContributor(record.policyVersionId(), contributor, record.createdAt());
            insertAudit(audit);
            return record;
        } catch (org.springframework.dao.DataIntegrityViolationException exception) {
            throw conflict();
        } catch (DataAccessException exception) {
            throw unavailable();
        }
    }

    @Override
    public Optional<PolicyVersionRecord> find(UUID policyVersionId) {
        try {
            List<PolicyVersionRecord> records = jdbc.query("SELECT " + VERSION_COLUMNS
                            + " FROM iam_policy_control_version WHERE policy_version_id = ?",
                    (resultSet, row) -> mapVersion(resultSet), policyVersionId.toString());
            return records.stream().findFirst();
        } catch (DataAccessException exception) {
            throw unavailable();
        }
    }

    @Override
    public List<PolicyVersionRecord> list(String tenantId) {
        requirePlatform(tenantId);
        try {
            return jdbc.query("SELECT " + VERSION_COLUMNS
                            + " FROM iam_policy_control_version WHERE tenant_id = ? ORDER BY updated_at DESC, policy_version_id DESC",
                    (resultSet, row) -> mapVersion(resultSet), tenantId);
        } catch (DataAccessException exception) {
            throw unavailable();
        }
    }

    @Override
    public List<PolicyAuditRecord> audits(UUID policyVersionId) {
        try {
            return jdbc.query("SELECT audit_id, policy_version_id, revision, event_type, actor_principal_id, tenant_id, "
                            + "request_id, trace_id, reason_digest, recorded_at FROM iam_policy_control_audit "
                            + "WHERE policy_version_id = ? ORDER BY recorded_at ASC, audit_id ASC",
                    (resultSet, row) -> new PolicyAuditRecord(
                            uuid(resultSet.getString("audit_id")), uuid(resultSet.getString("policy_version_id")),
                            resultSet.getInt("revision"), resultSet.getString("event_type"),
                            principal(resultSet.getString("actor_principal_id")), resultSet.getString("tenant_id"),
                            resultSet.getString("request_id"), resultSet.getString("trace_id"),
                            resultSet.getString("reason_digest"), instant(resultSet, "recorded_at")),
                    policyVersionId.toString());
        } catch (DataAccessException exception) {
            throw unavailable();
        }
    }

    @Override
    public PolicyVersionRecord compareAndSet(PolicyVersionRecord previous, PolicyVersionRecord next,
                                              PolicyAuditRecord audit, boolean addActorAsContributor) {
        if (!previous.policyVersionId().equals(next.policyVersionId())
                || next.revision() != previous.revision() + 1) {
            throw new IllegalArgumentException("policy compare-and-set snapshot is invalid");
        }
        try {
            int updated = jdbc.update("UPDATE iam_policy_control_version SET lifecycle_status = ?, revision = ?, "
                            + "document_json = CAST(? AS JSON), artifact_digest = ?, updated_at = ?, submitted_by = ?, "
                            + "approved_by = ?, activated_by = ?, revoked_by = ?, activated_at = ?, revoked_at = ?, "
                            + "cache_invalidation_id = ?, cache_invalidation_required = ?, cache_invalidation_status = ?, "
                            + "cache_invalidation_scope = ?, cache_invalidation_issued_at = ?, "
                            + "cache_invalidation_completed_at = ?, deny_until_current_version_proven = ? "
                            + "WHERE policy_version_id = ? AND revision = ? AND lifecycle_status = ?",
                    next.status().name(), next.revision(), writeDocument(next.document()), next.artifactDigest(),
                    timestamp(next.updatedAt()), id(next.submittedBy()), id(next.approvedBy()), id(next.activatedBy()),
                    id(next.revokedBy()), timestamp(next.activatedAt()), timestamp(next.revokedAt()),
                    next.cacheInvalidation().invalidationId().toString(), next.cacheInvalidation().required(),
                    next.cacheInvalidation().status(), next.cacheInvalidation().scope(),
                    timestamp(next.cacheInvalidation().issuedAt()), timestamp(next.cacheInvalidation().completedAt()),
                    next.cacheInvalidation().denyUntilCurrentVersionProven(), next.policyVersionId().toString(),
                    previous.revision(), previous.status().name());
            if (updated != 1) throw conflict();
            if (addActorAsContributor) addContributor(next.policyVersionId(), audit.actor(), audit.recordedAt());
            insertAudit(audit);
            return next;
        } catch (DataAccessException exception) {
            throw unavailable();
        }
    }

    @Override
    public Optional<PolicyVersionRecord> active(String tenantId) {
        requirePlatform(tenantId);
        try {
            List<String> values = jdbc.query("SELECT policy_version_id FROM iam_policy_active_slot WHERE tenant_id = ?",
                    (resultSet, row) -> resultSet.getString(1), tenantId);
            if (values.isEmpty() || values.getFirst() == null) return Optional.empty();
            return find(uuid(values.getFirst()));
        } catch (DataAccessException exception) {
            throw unavailable();
        }
    }

    @Override
    public Optional<PolicyVersionRecord> lockActive(String tenantId) {
        requirePlatform(tenantId);
        try {
            List<String> values = jdbc.query("SELECT policy_version_id FROM iam_policy_active_slot "
                            + "WHERE tenant_id = ? FOR UPDATE", (resultSet, row) -> resultSet.getString(1), tenantId);
            if (values.size() != 1) throw unavailable();
            String current = values.getFirst();
            return current == null ? Optional.empty() : find(uuid(current));
        } catch (DataAccessException exception) {
            throw unavailable();
        }
    }

    @Override
    public void setActive(String tenantId, UUID policyVersionId) {
        requirePlatform(tenantId);
        try {
            if (jdbc.update("UPDATE iam_policy_active_slot SET policy_version_id = ? WHERE tenant_id = ?",
                    policyVersionId.toString(), tenantId) != 1) throw unavailable();
        } catch (DataAccessException exception) {
            throw unavailable();
        }
    }

    @Override
    public void clearActive(String tenantId, UUID expectedPolicyVersionId) {
        requirePlatform(tenantId);
        try {
            if (jdbc.update("UPDATE iam_policy_active_slot SET policy_version_id = NULL "
                            + "WHERE tenant_id = ? AND policy_version_id = ?", tenantId,
                    expectedPolicyVersionId.toString()) != 1) {
                throw conflict();
            }
        } catch (DataAccessException exception) {
            throw unavailable();
        }
    }

    private PolicyVersionRecord mapVersion(ResultSet resultSet) throws SQLException {
        UUID policyId = uuid(resultSet.getString("policy_version_id"));
        PolicyCacheInvalidationReceipt receipt = new PolicyCacheInvalidationReceipt(
                uuid(resultSet.getString("cache_invalidation_id")), resultSet.getBoolean("cache_invalidation_required"),
                resultSet.getString("cache_invalidation_status"), resultSet.getString("cache_invalidation_scope"),
                instant(resultSet, "cache_invalidation_issued_at"), instantNullable(resultSet, "cache_invalidation_completed_at"),
                resultSet.getBoolean("deny_until_current_version_proven"));
        return new PolicyVersionRecord(policyId, resultSet.getString("version_label"),
                PolicyLifecycleStatus.valueOf(resultSet.getString("lifecycle_status")), resultSet.getInt("revision"),
                resultSet.getString("tenant_id"), readDocument(resultSet.getString("document_json")),
                resultSet.getString("artifact_digest"), instant(resultSet, "created_at"), instant(resultSet, "updated_at"),
                principal(resultSet.getString("created_by")), contributors(policyId),
                principalNullable(resultSet.getString("submitted_by")), principalNullable(resultSet.getString("approved_by")),
                principalNullable(resultSet.getString("activated_by")), principalNullable(resultSet.getString("revoked_by")),
                instantNullable(resultSet, "activated_at"), instantNullable(resultSet, "revoked_at"), receipt);
    }

    private Set<PrincipalId> contributors(UUID policyVersionId) {
        List<PrincipalId> values = jdbc.query("SELECT principal_id FROM iam_policy_control_contributor "
                        + "WHERE policy_version_id = ? ORDER BY principal_id", (resultSet, row) -> principal(resultSet.getString(1)),
                policyVersionId.toString());
        return Set.copyOf(new LinkedHashSet<>(values));
    }

    private void addContributor(UUID policyVersionId, PrincipalId contributor, Instant at) {
        jdbc.update("INSERT IGNORE INTO iam_policy_control_contributor (policy_version_id, principal_id, added_at) "
                        + "VALUES (?, ?, ?)", policyVersionId.toString(), contributor.toString(), timestamp(at));
    }

    private void insertAudit(PolicyAuditRecord audit) {
        if (jdbc.update("INSERT INTO iam_policy_control_audit (audit_id, policy_version_id, revision, event_type, "
                        + "actor_principal_id, tenant_id, request_id, trace_id, reason_digest, recorded_at) "
                        + "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", audit.auditId().toString(),
                audit.policyVersionId().toString(), audit.revision(), audit.eventType(), audit.actor().toString(),
                audit.tenantId(), audit.requestId(), audit.traceId(), audit.reasonDigest(), timestamp(audit.recordedAt())) != 1) {
            throw unavailable();
        }
    }

    private String writeDocument(PolicyDocument document) {
        try { return objectMapper.writeValueAsString(document); }
        catch (JsonProcessingException exception) { throw new IamPolicyException(IamDecisionCode.POLICY_DOCUMENT_INVALID,
                "iam.policy.document_invalid"); }
    }

    private PolicyDocument readDocument(String json) {
        try { return objectMapper.readValue(json, PolicyDocument.class); }
        catch (JsonProcessingException | IllegalArgumentException exception) { throw unavailable(); }
    }

    private static String id(PrincipalId principal) { return principal == null ? null : principal.toString(); }
    private static Timestamp timestamp(Instant instant) { return instant == null ? null : Timestamp.from(instant); }
    private static Instant instant(ResultSet resultSet, String column) throws SQLException {
        Timestamp value = resultSet.getTimestamp(column);
        if (value == null) throw new SQLException("required policy timestamp is missing");
        return value.toInstant();
    }
    private static Instant instantNullable(ResultSet resultSet, String column) throws SQLException {
        Timestamp value = resultSet.getTimestamp(column);
        return value == null ? null : value.toInstant();
    }
    private static UUID uuid(String value) {
        try { return UUID.fromString(value); }
        catch (IllegalArgumentException | NullPointerException exception) { throw unavailable(); }
    }
    private static PrincipalId principal(String value) { return new PrincipalId(uuid(value)); }
    private static PrincipalId principalNullable(String value) { return value == null ? null : principal(value); }
    private static void requirePlatform(String tenantId) {
        if (!TenantScope.PLATFORM_TENANT.equals(tenantId)) {
            throw new IamPolicyException(IamDecisionCode.CLIENT_TRUSTED_INPUT_REJECTED,
                    "iam.policy.tenant_not_server_derived");
        }
    }
    private static IamPolicyException conflict() {
        return new IamPolicyException(IamDecisionCode.POLICY_REVISION_CONFLICT, "iam.policy.revision_conflict");
    }
    private static IamPolicyException unavailable() {
        return new IamPolicyException(IamDecisionCode.IAM_PERSISTENCE_UNAVAILABLE, "iam.policy.store_unavailable");
    }
}
