package com.englishflow.content.adapter.jdbc;

import com.englishflow.content.domain.ContentDefinition;
import com.englishflow.content.domain.ContentId;
import com.englishflow.content.domain.ContentKind;
import com.englishflow.content.domain.ContentOperationException;
import com.englishflow.content.domain.ContentRights;
import com.englishflow.content.domain.ContentVersion;
import com.englishflow.content.domain.ContentVersionId;
import com.englishflow.content.domain.ContentVersionStatus;
import com.englishflow.content.domain.CopyrightStatus;
import com.englishflow.content.port.ContentRepository;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.sql.Statement;
import java.util.List;
import java.util.Optional;

import org.springframework.dao.DataAccessException;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import tools.jackson.databind.ObjectMapper;

/** Content-service-owned MySQL aggregate store. It never reads or writes another service schema. */
public final class JdbcContentRepository implements ContentRepository {

    private static final Logger LOG = LoggerFactory.getLogger(JdbcContentRepository.class);

    private static final String DEFINITION_SELECT = """
            SELECT content_id, tenant_id, content_code, kind, title, locale, target_level, goal_code,
                   created_by, created_at, current_published_version_id, content_epoch, projection_version,
                   state_version
              FROM content_definition
             WHERE content_id = ?
            """;

    private static final String VERSION_SELECT = """
            SELECT content_version_id, version_no, kind, status, payload_json, payload_hash,
                   rights_source_code, rights_license_code, copyright_status, rights_allows_learning,
                   rights_permitted_channels, rights_starts_at, rights_expires_at,
                   authorization_evidence_ref, editor, release_note, first_reviewer, final_reviewer,
                   publisher, published_at, archived_at, rollback_of_version_id, first_review_version,
                   final_review_version, state_version, created_at
              FROM content_version
             WHERE content_id = ?
             ORDER BY version_no, content_version_id
            """;

    private static final String DEFINITION_CAS = """
            UPDATE content_definition
               SET current_published_version_id = ?, content_epoch = ?, projection_version = ?,
                   state_version = ?
             WHERE content_id = ? AND state_version = ?
            """;

    private static final String DEFINITION_INSERT = """
            INSERT INTO content_definition
                (content_id, tenant_id, content_code, kind, title, locale, target_level, goal_code,
                 created_by, created_at, current_published_version_id, content_epoch, projection_version,
                 state_version)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """;

    private static final String VERSION_INSERT = """
            INSERT INTO content_version
                (content_version_id, content_id, version_no, kind, status, payload_json, payload_hash,
                 rights_source_code, rights_license_code, copyright_status, rights_allows_learning,
                 rights_permitted_channels, rights_starts_at, rights_expires_at, authorization_evidence_ref,
                 editor, release_note, first_reviewer, final_reviewer, publisher, published_at, archived_at,
                 rollback_of_version_id, first_review_version, final_review_version, state_version, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """;

    private static final String VERSION_STATE_UPDATE = """
            UPDATE content_version
               SET status = ?, first_reviewer = ?, final_reviewer = ?, publisher = ?,
                   published_at = ?, archived_at = ?, rollback_of_version_id = ?,
                   first_review_version = ?, final_review_version = ?, state_version = ?
             WHERE content_version_id = ? AND content_id = ? AND version_no = ? AND state_version = ?
            """;

    private final JdbcTemplate jdbc;
    private final ObjectMapper objectMapper;
    private final TransactionTemplate transaction;

    public JdbcContentRepository(JdbcTemplate jdbc, ObjectMapper objectMapper) {
        this(jdbc, objectMapper, new TransactionTemplate(
                new DataSourceTransactionManager(java.util.Objects.requireNonNull(jdbc.getDataSource()))));
    }

    public JdbcContentRepository(JdbcTemplate jdbc, ObjectMapper objectMapper, TransactionTemplate transaction) {
        this.jdbc = java.util.Objects.requireNonNull(jdbc, "jdbc is required");
        this.objectMapper = java.util.Objects.requireNonNull(objectMapper, "object mapper is required");
        this.transaction = java.util.Objects.requireNonNull(transaction, "transaction is required");
    }

    @Override
    public Optional<ContentDefinition> find(ContentId contentId) {
        java.util.Objects.requireNonNull(contentId, "content id is required");
        try {
            List<DefinitionRow> rows = jdbc.query(DEFINITION_SELECT,
                    (resultSet, rowNum) -> mapDefinition(resultSet), contentId.value());
            return rows.isEmpty() ? Optional.empty() : Optional.of(rehydrate(rows.getFirst()));
        } catch (DataAccessException exception) {
            LOG.warn("content facts could not be read for contentId={}", contentId.value(), exception);
            throw ContentOperationException.unavailable(
                    "CONTENT_PERSISTENCE_UNAVAILABLE", "content facts could not be read");
        }
    }

    @Override
    public Optional<ContentDefinition> findByCode(String contentCode) {
        return findByCode(contentCode, false);
    }

    @Override
    public Optional<ContentDefinition> findByCodeForUpdate(String contentCode) {
        return findByCode(contentCode, true);
    }

    private Optional<ContentDefinition> findByCode(String contentCode, boolean forUpdate) {
        if (contentCode == null || contentCode.isBlank()) {
            throw ContentOperationException.badRequest("CONTENT_CODE_INVALID", "content code is required");
        }
        try {
            List<DefinitionRow> rows = jdbc.query(
                    DEFINITION_SELECT.replace("WHERE content_id = ?", "WHERE content_code = ?")
                            + (forUpdate ? " FOR UPDATE" : ""),
                    (resultSet, rowNum) -> mapDefinition(resultSet), contentCode);
            return rows.isEmpty() ? Optional.empty() : Optional.of(rehydrate(rows.getFirst()));
        } catch (DataAccessException exception) {
            LOG.warn("content facts could not be read for contentCode={}", contentCode, exception);
            throw ContentOperationException.unavailable(
                    "CONTENT_PERSISTENCE_UNAVAILABLE", "content facts could not be read");
        }
    }

    @Override
    public List<ContentDefinition> findAll() {
        try {
            List<DefinitionRow> rows = jdbc.query(
                    DEFINITION_SELECT.replace("WHERE content_id = ?", "ORDER BY content_code"),
                    (resultSet, rowNum) -> mapDefinition(resultSet));
            return rows.stream().map(this::rehydrate).toList();
        } catch (DataAccessException exception) {
            LOG.warn("content facts could not be listed", exception);
            throw ContentOperationException.unavailable(
                    "CONTENT_PERSISTENCE_UNAVAILABLE", "content facts could not be listed");
        }
    }

    private ContentDefinition rehydrate(DefinitionRow definition) {
        List<ContentVersion> versions = jdbc.query(
                VERSION_SELECT, (resultSet, rowNum) -> mapVersion(resultSet),
                definition.contentId().value());
        return ContentDefinition.rehydrate(
                definition.contentId(), definition.tenantId(), definition.contentCode(),
                definition.kind(), definition.title(), definition.locale(), definition.targetLevel(),
                definition.goalCode(), definition.createdBy(), definition.createdAt(), versions,
                definition.currentPublishedVersionId(), definition.contentEpoch(),
                definition.projectionVersion(), definition.stateVersion());
    }

    @Override
    public ContentVersionId nextVersionId() {
        try {
            GeneratedKeyHolder key = new GeneratedKeyHolder();
            jdbc.update(connection -> connection.prepareStatement(
                    "INSERT INTO content_version_id_sequence (id) VALUES (NULL)", Statement.RETURN_GENERATED_KEYS), key);
            Number value = key.getKey();
            if (value == null) {
                throw ContentOperationException.unavailable(
                        "CONTENT_PERSISTENCE_UNAVAILABLE", "version id allocator returned no id");
            }
            return ContentVersionId.of(value.longValue());
        } catch (DataAccessException exception) {
            LOG.warn("next content version id could not be allocated", exception);
            throw ContentOperationException.unavailable(
                    "CONTENT_PERSISTENCE_UNAVAILABLE", "next content version id could not be allocated");
        }
    }

    @Override
    public void create(ContentDefinition content) {
        java.util.Objects.requireNonNull(content, "content is required");
        try {
            jdbc.update(DEFINITION_INSERT, definitionArguments(content));
        } catch (DuplicateKeyException exception) {
            throw ContentOperationException.conflict("CONTENT_EXISTS", "content already exists");
        } catch (DataAccessException exception) {
            throw ContentOperationException.unavailable(
                    "CONTENT_PERSISTENCE_UNAVAILABLE", "content fact could not be created");
        }
    }

    @Override
    public void save(ContentDefinition content) {
        java.util.Objects.requireNonNull(content, "content is required");
        try {
            transaction.executeWithoutResult(status -> saveInTransaction(content));
        } catch (DuplicateKeyException exception) {
            throw ContentOperationException.conflict("VERSION_CONFLICT", "content version already exists");
        } catch (DataAccessException exception) {
            throw ContentOperationException.unavailable(
                    "CONTENT_PERSISTENCE_UNAVAILABLE", "content facts could not be saved");
        }
    }

    private void saveInTransaction(ContentDefinition content) {
        int updated = jdbc.update(DEFINITION_CAS,
                content.currentPublishedVersionId().map(ContentVersionId::value).orElse(null),
                content.contentEpoch(), content.projectionVersion(), content.stateVersion(),
                content.contentId().value(), content.persistedStateVersion());
        if (updated != 1) {
            throw ContentOperationException.conflict("VERSION_CONFLICT", "content was changed by another command");
        }
        for (ContentVersion version : content.versions()) {
            List<StoredVersion> rows = jdbc.query(
                    "SELECT version_no, state_version, payload_hash FROM content_version "
                            + "WHERE content_version_id = ? AND content_id = ?",
                    (resultSet, rowNum) -> new StoredVersion(resultSet.getInt("version_no"),
                            resultSet.getLong("state_version"), resultSet.getString("payload_hash")),
                    version.versionId().value(), content.contentId().value());
            if (rows.isEmpty()) {
                jdbc.update(VERSION_INSERT, versionArguments(content, version));
                continue;
            }
            StoredVersion stored = rows.getFirst();
            if (stored.versionNumber() != version.versionNumber()
                    || !java.util.Objects.equals(stored.payloadHash(), version.contentHash())
                    || version.stateVersion() < stored.stateVersion()) {
                throw ContentOperationException.conflict("VERSION_CONFLICT", "stored version identity changed");
            }
            if (version.stateVersion() == stored.stateVersion()) {
                continue;
            }
            int stateUpdated = jdbc.update(VERSION_STATE_UPDATE,
                    version.status().name(), version.firstReviewer().orElse(null),
                    version.finalReviewer().orElse(null), version.publisher().orElse(null),
                    JdbcContentJson.timestamp(version.publishedAt().orElse(null)),
                    JdbcContentJson.timestamp(version.archivedAt().orElse(null)),
                    version.rollbackOfVersionId().map(ContentVersionId::value).orElse(null),
                    version.reviewVersion(com.englishflow.content.domain.ReviewStage.FIRST_REVIEW),
                    version.reviewVersion(com.englishflow.content.domain.ReviewStage.FINAL_REVIEW),
                    version.stateVersion(), version.versionId().value(), content.contentId().value(),
                    version.versionNumber(), stored.stateVersion());
            if (stateUpdated != 1) {
                throw ContentOperationException.conflict("VERSION_CONFLICT", "content version changed by another command");
            }
        }
        content.markPersisted();
    }

    private Object[] definitionArguments(ContentDefinition content) {
        return new Object[]{
                content.contentId().value(), content.tenantId(), content.contentCode(), content.kind().name(),
                content.title(), content.locale(), content.targetLevel(), content.goalCode(), content.createdBy(),
                JdbcContentJson.timestamp(content.createdAt()),
                content.currentPublishedVersionId().map(ContentVersionId::value).orElse(null),
                content.contentEpoch(), content.projectionVersion(), content.stateVersion()};
    }

    private Object[] versionArguments(ContentDefinition content, ContentVersion version) {
        ContentRights rights = version.rights().orElse(null);
        String channels = rights == null ? null : JdbcContentJson.write(
                objectMapper, rights.permittedChannels(), "content rights could not be encoded");
        return new Object[]{
                version.versionId().value(), content.contentId().value(), version.versionNumber(), version.kind().name(),
                version.status().name(), JdbcContentJson.write(
                        objectMapper, version.payload().raw(), "content payload could not be encoded"),
                version.contentHash(),
                rights == null ? null : rights.sourceCode(), rights == null ? null : rights.licenseCode(),
                rights == null ? null : rights.status().name(),
                rights == null ? null : rights.allowsLearning(),
                channels, rights == null ? null : JdbcContentJson.timestamp(rights.startsAt()),
                rights == null ? null : JdbcContentJson.timestamp(rights.expiresAt()),
                rights == null ? null : rights.authorizationEvidenceRef(), version.editor(), version.releaseNote(),
                version.firstReviewer().orElse(null), version.finalReviewer().orElse(null), version.publisher().orElse(null),
                JdbcContentJson.timestamp(version.publishedAt().orElse(null)),
                JdbcContentJson.timestamp(version.archivedAt().orElse(null)),
                version.rollbackOfVersionId().map(ContentVersionId::value).orElse(null), version.reviewVersion(
                        com.englishflow.content.domain.ReviewStage.FIRST_REVIEW), version.reviewVersion(
                        com.englishflow.content.domain.ReviewStage.FINAL_REVIEW), version.stateVersion(),
                JdbcContentJson.timestamp(version.createdAt())};
    }

    private DefinitionRow mapDefinition(ResultSet resultSet) throws SQLException {
        Object current = resultSet.getObject("current_published_version_id");
        return new DefinitionRow(
                new ContentId(resultSet.getString("content_id")), resultSet.getString("tenant_id"),
                resultSet.getString("content_code"), ContentKind.valueOf(resultSet.getString("kind")),
                resultSet.getString("title"), resultSet.getString("locale"), resultSet.getString("target_level"),
                resultSet.getString("goal_code"), resultSet.getString("created_by"),
                JdbcContentJson.instant(resultSet, "created_at"),
                current == null ? null : new ContentVersionId(((Number) current).longValue()),
                resultSet.getLong("content_epoch"), resultSet.getLong("projection_version"),
                resultSet.getLong("state_version"));
    }

    private ContentVersion mapVersion(ResultSet resultSet) throws SQLException {
        try {
            String rightsStatus = resultSet.getString("copyright_status");
            ContentRights rights = null;
            if (rightsStatus != null
                    && resultSet.getString("rights_source_code") != null
                    && resultSet.getString("rights_license_code") != null
                    && resultSet.getString("rights_permitted_channels") != null) {
                rights = new ContentRights(
                        resultSet.getString("rights_source_code"), resultSet.getString("rights_license_code"),
                        CopyrightStatus.valueOf(rightsStatus), resultSet.getBoolean("rights_allows_learning"),
                        JdbcContentJson.readStringSet(
                                objectMapper, resultSet.getString("rights_permitted_channels"),
                                "stored content rights channels are unreadable"),
                        JdbcContentJson.instant(resultSet, "rights_starts_at"),
                        JdbcContentJson.instant(resultSet, "rights_expires_at"),
                        resultSet.getString("authorization_evidence_ref"));
            }
            Object rollback = resultSet.getObject("rollback_of_version_id");
            return ContentVersion.rehydrate(
                    new ContentVersionId(resultSet.getLong("content_version_id")),
                    resultSet.getInt("version_no"), ContentKind.valueOf(resultSet.getString("kind")),
                    JdbcContentJson.readMap(
                            objectMapper, resultSet.getString("payload_json"),
                            "stored content payload is unreadable"), resultSet.getString("payload_hash"), rights,
                    resultSet.getString("editor"), resultSet.getString("release_note"),
                    JdbcContentJson.instant(resultSet, "created_at"),
                    ContentVersionStatus.valueOf(resultSet.getString("status")),
                    resultSet.getString("first_reviewer"), resultSet.getString("final_reviewer"),
                    resultSet.getString("publisher"), JdbcContentJson.instant(resultSet, "published_at"),
                    JdbcContentJson.instant(resultSet, "archived_at"),
                    rollback == null ? null : new ContentVersionId(((Number) rollback).longValue()),
                    resultSet.getInt("first_review_version"), resultSet.getInt("final_review_version"),
                    resultSet.getLong("state_version"));
        } catch (RuntimeException exception) {
            if (exception instanceof ContentOperationException contentException
                    && "CONTENT_FACT_CORRUPT".equals(contentException.code())) {
                throw contentException;
            }
            throw ContentOperationException.unavailable(
                    "CONTENT_FACT_CORRUPT", "stored content version is unreadable");
        }
    }

    private record DefinitionRow(
            ContentId contentId,
            String tenantId,
            String contentCode,
            ContentKind kind,
            String title,
            String locale,
            String targetLevel,
            String goalCode,
            String createdBy,
            Instant createdAt,
            ContentVersionId currentPublishedVersionId,
            long contentEpoch,
            long projectionVersion,
            long stateVersion) {
    }

    private record StoredVersion(int versionNumber, long stateVersion, String payloadHash) {
    }
}
