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
import java.util.List;
import java.util.Optional;

import org.springframework.dao.DataAccessException;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import tools.jackson.databind.ObjectMapper;

/** Content-service-owned MySQL aggregate store. It never reads or writes another service schema. */
public final class JdbcContentRepository implements ContentRepository {

    private static final Logger LOG = LoggerFactory.getLogger(JdbcContentRepository.class);

    private static final String DEFINITION_SELECT = """
            SELECT content_id, tenant_id, content_code, kind, title, locale, target_level, goal_code,
                   created_by, created_at, current_published_version_id, content_epoch, projection_version
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

    private static final String NEXT_VERSION_ID = """
            SELECT COALESCE(MAX(content_version_id), 25000) + 1
              FROM content_version
            """;

    private static final String DEFINITION_UPSERT = """
            INSERT INTO content_definition
                (content_id, tenant_id, content_code, kind, title, locale, target_level, goal_code,
                 created_by, created_at, current_published_version_id, content_epoch, projection_version)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE tenant_id = VALUES(tenant_id), content_code = VALUES(content_code),
                kind = VALUES(kind), title = VALUES(title), locale = VALUES(locale),
                target_level = VALUES(target_level), goal_code = VALUES(goal_code),
                created_by = VALUES(created_by), created_at = VALUES(created_at),
                current_published_version_id = VALUES(current_published_version_id),
                content_epoch = VALUES(content_epoch), projection_version = VALUES(projection_version)
            """;

    private static final String DEFINITION_INSERT = """
            INSERT INTO content_definition
                (content_id, tenant_id, content_code, kind, title, locale, target_level, goal_code,
                 created_by, created_at, current_published_version_id, content_epoch, projection_version)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """;

    private static final String VERSION_UPSERT = """
            INSERT INTO content_version
                (content_version_id, content_id, version_no, kind, status, payload_json, payload_hash,
                 rights_source_code, rights_license_code, copyright_status, rights_allows_learning,
                 rights_permitted_channels, rights_starts_at, rights_expires_at, authorization_evidence_ref,
                 editor, release_note, first_reviewer, final_reviewer, publisher, published_at, archived_at,
                 rollback_of_version_id, first_review_version, final_review_version, state_version, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE version_no = VALUES(version_no), kind = VALUES(kind),
                status = VALUES(status), payload_json = VALUES(payload_json), payload_hash = VALUES(payload_hash),
                rights_source_code = VALUES(rights_source_code), rights_license_code = VALUES(rights_license_code),
                copyright_status = VALUES(copyright_status), rights_allows_learning = VALUES(rights_allows_learning),
                rights_permitted_channels = VALUES(rights_permitted_channels), rights_starts_at = VALUES(rights_starts_at),
                rights_expires_at = VALUES(rights_expires_at), authorization_evidence_ref = VALUES(authorization_evidence_ref),
                editor = VALUES(editor), release_note = VALUES(release_note), first_reviewer = VALUES(first_reviewer),
                final_reviewer = VALUES(final_reviewer), publisher = VALUES(publisher), published_at = VALUES(published_at),
                archived_at = VALUES(archived_at), rollback_of_version_id = VALUES(rollback_of_version_id),
                first_review_version = VALUES(first_review_version), final_review_version = VALUES(final_review_version),
                state_version = VALUES(state_version), created_at = VALUES(created_at)
            """;

    private final JdbcTemplate jdbc;
    private final ObjectMapper objectMapper;

    public JdbcContentRepository(JdbcTemplate jdbc, ObjectMapper objectMapper) {
        this.jdbc = java.util.Objects.requireNonNull(jdbc, "jdbc is required");
        this.objectMapper = java.util.Objects.requireNonNull(objectMapper, "object mapper is required");
    }

    @Override
    public Optional<ContentDefinition> find(ContentId contentId) {
        java.util.Objects.requireNonNull(contentId, "content id is required");
        try {
            return jdbc.query(DEFINITION_SELECT, resultSet -> {
                if (!resultSet.next()) {
                    return Optional.empty();
                }
                DefinitionRow definition = mapDefinition(resultSet);
                List<ContentVersion> versions = jdbc.query(
                        VERSION_SELECT, (versionResultSet, rowNum) -> mapVersion(versionResultSet),
                        contentId.value());
                return Optional.of(ContentDefinition.rehydrate(
                        definition.contentId(), definition.tenantId(), definition.contentCode(),
                        definition.kind(), definition.title(), definition.locale(), definition.targetLevel(),
                        definition.goalCode(), definition.createdBy(), definition.createdAt(), versions,
                        definition.currentPublishedVersionId(), definition.contentEpoch(),
                        definition.projectionVersion()));
            }, contentId.value());
        } catch (DataAccessException exception) {
            LOG.warn("content facts could not be read for contentId={}", contentId.value(), exception);
            throw ContentOperationException.unavailable(
                    "CONTENT_PERSISTENCE_UNAVAILABLE", "content facts could not be read");
        }
    }

    @Override
    public Optional<ContentDefinition> findByCode(String contentCode) {
        if (contentCode == null || contentCode.isBlank()) {
            throw ContentOperationException.badRequest("CONTENT_CODE_INVALID", "content code is required");
        }
        try {
            return jdbc.query(
                    DEFINITION_SELECT.replace("WHERE content_id = ?", "WHERE content_code = ?"),
                    resultSet -> {
                        if (!resultSet.next()) {
                            return Optional.empty();
                        }
                        DefinitionRow definition = mapDefinition(resultSet);
                        List<ContentVersion> versions = jdbc.query(
                                VERSION_SELECT, (versionResultSet, rowNum) -> mapVersion(versionResultSet),
                                definition.contentId().value());
                        return Optional.of(ContentDefinition.rehydrate(
                                definition.contentId(), definition.tenantId(), definition.contentCode(),
                                definition.kind(), definition.title(), definition.locale(), definition.targetLevel(),
                                definition.goalCode(), definition.createdBy(), definition.createdAt(), versions,
                                definition.currentPublishedVersionId(), definition.contentEpoch(),
                                definition.projectionVersion()));
                    }, contentCode);
        } catch (DataAccessException exception) {
            LOG.warn("content facts could not be read for contentCode={}", contentCode, exception);
            throw ContentOperationException.unavailable(
                    "CONTENT_PERSISTENCE_UNAVAILABLE", "content facts could not be read");
        }
    }

    @Override
    public List<ContentDefinition> findAll() {
        try {
            return jdbc.query(
                    DEFINITION_SELECT.replace("WHERE content_id = ?", "ORDER BY content_code"),
                    (resultSet, rowNum) -> {
                        DefinitionRow definition = mapDefinition(resultSet);
                        List<ContentVersion> versions = jdbc.query(
                                VERSION_SELECT, (versionResultSet, versionRow) -> mapVersion(versionResultSet),
                                definition.contentId().value());
                        return ContentDefinition.rehydrate(
                                definition.contentId(), definition.tenantId(), definition.contentCode(),
                                definition.kind(), definition.title(), definition.locale(), definition.targetLevel(),
                                definition.goalCode(), definition.createdBy(), definition.createdAt(), versions,
                                definition.currentPublishedVersionId(), definition.contentEpoch(),
                                definition.projectionVersion());
                    });
        } catch (DataAccessException exception) {
            LOG.warn("content facts could not be listed", exception);
            throw ContentOperationException.unavailable(
                    "CONTENT_PERSISTENCE_UNAVAILABLE", "content facts could not be listed");
        }
    }

    @Override
    public ContentVersionId nextVersionId() {
        try {
            Long next = jdbc.queryForObject(NEXT_VERSION_ID, Long.class);
            return ContentVersionId.of(next == null ? 25001L : next);
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
            jdbc.update(DEFINITION_UPSERT, definitionArguments(content));
            for (ContentVersion version : content.versions()) {
                jdbc.update(VERSION_UPSERT, versionArguments(content, version));
            }
        } catch (DataAccessException exception) {
            throw ContentOperationException.unavailable(
                    "CONTENT_PERSISTENCE_UNAVAILABLE", "content facts could not be saved");
        }
    }

    private Object[] definitionArguments(ContentDefinition content) {
        return new Object[]{
                content.contentId().value(), content.tenantId(), content.contentCode(), content.kind().name(),
                content.title(), content.locale(), content.targetLevel(), content.goalCode(), content.createdBy(),
                JdbcContentJson.timestamp(content.createdAt()),
                content.currentPublishedVersionId().map(ContentVersionId::value).orElse(null),
                content.contentEpoch(), content.projectionVersion()};
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
                resultSet.getLong("content_epoch"), resultSet.getLong("projection_version"));
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
            long projectionVersion) {
    }
}
