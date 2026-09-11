package com.englishflow.iam.domain;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;

import java.io.IOException;
import java.sql.ResultSet;
import java.time.Instant;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

/**
 * Server-owned consent policy source backed by the IAM consent-document control table. Only
 * ACTIVE rows are selectable and the latest published document wins per type. A missing, revoked,
 * corrupt or unreadable row is an unavailable policy, never an implicit grant.
 */
public class JdbcConsentPolicy implements ConsentPolicyPort {

    private static final String ACTIVE_SELECT =
            "SELECT consent_type, document_version, document_digest, published_at, policy_version, "
                    + "policy_digest, requirement, capabilities, withdrawal_effect, revoke_sessions, "
                    + "policy_ref, runtime_status FROM iam_consent_document_version "
                    + "WHERE tenant_id = ? AND lifecycle_status = 'ACTIVE' "
                    + "ORDER BY consent_type ASC, published_at DESC, consent_document_id DESC";

    private final JdbcTemplate jdbc;
    private final ObjectMapper objectMapper;

    public JdbcConsentPolicy(JdbcTemplate jdbc, ObjectMapper objectMapper) {
        this.jdbc = Objects.requireNonNull(jdbc, "jdbc");
        this.objectMapper = Objects.requireNonNull(objectMapper, "objectMapper");
    }

    @Override
    public ConsentPolicyDescriptor descriptor(ConsentType type) {
        Objects.requireNonNull(type, "type");
        ConsentPolicyDescriptor descriptor = activeDescriptors().get(type);
        if (descriptor == null) {
            throw new IamPolicyException(IamDecisionCode.POLICY_UNAVAILABLE,
                    "iam.consent.version_unavailable");
        }
        return descriptor;
    }

    @Override
    public Set<ConsentPolicyDescriptor> descriptors() {
        return Set.copyOf(activeDescriptors().values());
    }

    @Override
    public boolean writesEnabled() {
        return true;
    }

    @Override
    public boolean evaluationEnabled() {
        return true;
    }

    private Map<ConsentType, ConsentPolicyDescriptor> activeDescriptors() {
        try {
            List<ConsentPolicyDescriptor> rows = jdbc.query(ACTIVE_SELECT,
                    (ResultSet rs, int rowNum) -> map(rs), TenantScope.PLATFORM_TENANT);
            EnumMap<ConsentType, ConsentPolicyDescriptor> byType = new EnumMap<>(ConsentType.class);
            for (ConsentPolicyDescriptor descriptor : rows) {
                // The ordered select puts the latest published document first for every type, so
                // the first row wins without a per-type query.
                byType.putIfAbsent(descriptor.type(), descriptor);
            }
            return byType;
        } catch (DataAccessException | IllegalArgumentException exception) {
            throw new IamPolicyException(IamDecisionCode.POLICY_UNAVAILABLE,
                    "iam.consent.policy_unavailable");
        }
    }

    private ConsentPolicyDescriptor map(ResultSet rs) throws java.sql.SQLException {
        ConsentType type = ConsentType.fromLegacyStorage(rs.getString("consent_type"));
        return new ConsentPolicyDescriptor(type, type.purpose(),
                new ConsentVersion(rs.getString("document_version")), rs.getString("document_digest"),
                Instant.ofEpochMilli(rs.getTimestamp("published_at").getTime()),
                new ConsentVersion(rs.getString("policy_version")), rs.getString("policy_digest"),
                ConsentPolicyDescriptor.Requirement.valueOf(rs.getString("requirement")),
                capabilities(rs.getString("capabilities")),
                ConsentPolicyDescriptor.WithdrawalEffect.valueOf(rs.getString("withdrawal_effect")),
                rs.getBoolean("revoke_sessions"), rs.getString("policy_ref"),
                rs.getString("runtime_status"));
    }

    private Set<String> capabilities(String json) {
        try {
            List<String> values = objectMapper.readValue(json, new TypeReference<List<String>>() {});
            return values == null ? Set.of() : Set.copyOf(values);
        } catch (IOException exception) {
            throw new IllegalArgumentException("consent document capabilities are invalid", exception);
        }
    }
}
