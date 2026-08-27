package com.englishflow.iam.domain;

import org.springframework.dao.DataAccessException;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.sql.ResultSet;
import java.time.Instant;
import java.util.HexFormat;
import java.util.Objects;
import java.util.Optional;

/** JDBC adapter for the IAM-owned immutable issuer/subject mapping. */
public final class JdbcPrincipalMappingPort implements PrincipalMappingPort {

    private final JdbcTemplate jdbc;

    public JdbcPrincipalMappingPort(JdbcTemplate jdbc) {
        this.jdbc = Objects.requireNonNull(jdbc, "jdbc");
    }

    @Override
    public Optional<PrincipalMapping> findByExternalIdentity(ExternalIdentity identity) {
        Objects.requireNonNull(identity, "identity");
        try {
            return jdbc.query(
                    "SELECT principal_id, first_seen_at FROM iam_external_identity "
                            + "WHERE issuer = ? AND subject_hash = ?",
                    (ResultSet rs, int rowNum) -> new PrincipalMapping(
                            identity,
                            new PrincipalId(java.util.UUID.fromString(rs.getString("principal_id"))),
                            rs.getTimestamp("first_seen_at").toInstant()),
                    identity.issuer().toString(),
                    subjectHash(identity.subject())).stream().findFirst()
                    .map(mapping -> {
                        ensureLearnerRole(mapping.principalId());
                        return mapping;
                    });
        } catch (DataAccessException | IllegalArgumentException exception) {
            throw unavailable(exception);
        }
    }

    @Override
    @Transactional(transactionManager = "iamTransactionManager")
    public PrincipalMapping createIfAbsent(PrincipalMapping mapping) {
        Objects.requireNonNull(mapping, "mapping");
        Optional<PrincipalMapping> existing = findByExternalIdentity(mapping.externalIdentity());
        if (existing.isPresent()) {
            if (!existing.get().principalId().equals(mapping.principalId())) {
                throw new IamPolicyException(
                        IamDecisionCode.PRINCIPAL_MAPPING_CONFLICT,
                        "iam.principal_mapping.immutable");
            }
            return existing.get();
        }
        try {
            jdbc.update(
                    "INSERT INTO iam_principal (principal_id, tenant_id, status) VALUES (?, 'platform', 'ACTIVE')",
                    mapping.principalId().toString());
            jdbc.update(
                    "INSERT INTO iam_external_identity "
                            + "(principal_id, issuer, subject_hash, first_seen_at, last_seen_at) "
                            + "VALUES (?, ?, ?, ?, ?)",
                    mapping.principalId().toString(),
                    mapping.externalIdentity().issuer().toString(),
                    subjectHash(mapping.externalIdentity().subject()),
                    java.sql.Timestamp.from(mapping.createdAt()),
                    java.sql.Timestamp.from(mapping.createdAt()));
            ensureLearnerRole(mapping.principalId());
            return mapping;
        } catch (DuplicateKeyException exception) {
            Optional<PrincipalMapping> raced = findByExternalIdentity(mapping.externalIdentity());
            if (raced.isPresent() && raced.get().principalId().equals(mapping.principalId())) {
                return raced.get();
            }
            throw new IamPolicyException(
                    IamDecisionCode.PRINCIPAL_MAPPING_CONFLICT,
                    "iam.principal_mapping.immutable");
        } catch (DataAccessException | IllegalArgumentException exception) {
            throw unavailable(exception);
        }
    }

    private void ensureLearnerRole(PrincipalId principalId) {
        jdbc.update(
                "INSERT IGNORE INTO iam_principal_role (principal_id, role_id) VALUES (?, 'role-learner')",
                principalId.toString());
    }

    private static byte[] subjectHash(String subject) {
        try {
            return MessageDigest.getInstance("SHA-256").digest(subject.getBytes(StandardCharsets.UTF_8));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is required by the JDK", exception);
        }
    }

    private static IamPolicyException unavailable(Exception exception) {
        return new IamPolicyException(
                IamDecisionCode.IAM_PERSISTENCE_UNAVAILABLE,
                "iam.persistence.unavailable");
    }
}
