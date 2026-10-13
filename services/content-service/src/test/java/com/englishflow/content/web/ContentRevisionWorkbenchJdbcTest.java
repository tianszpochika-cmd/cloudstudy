package com.englishflow.content.web;

import com.englishflow.content.adapter.jdbc.JdbcContentIdempotency;
import com.englishflow.content.adapter.jdbc.JdbcContentRepository;
import com.englishflow.content.adapter.jdbc.JdbcContentReviewNotes;
import com.englishflow.content.adapter.memory.InMemoryContentOutbox;
import com.englishflow.content.adapter.memory.InMemoryPublicProjectionStore;
import com.englishflow.content.adapter.memory.RecordingContentCacheInvalidator;
import com.englishflow.content.application.ContentCommandService;
import com.englishflow.content.application.ContentItemCommandService;
import com.englishflow.content.application.LexemeCommandService;
import com.englishflow.content.application.ScheduledPublishService;
import com.englishflow.content.domain.ContentDefinition;
import com.englishflow.content.domain.ContentOperationException;
import com.englishflow.content.domain.ContentRights;
import com.englishflow.content.domain.ContentVersionId;
import com.englishflow.content.domain.CopyrightStatus;
import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.databind.ObjectMapper;

import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;

/** Content-ops R2: workbench backfill, revision from published, in-review freeze, reject reason. */
class ContentRevisionWorkbenchJdbcTest {

    private HikariDataSource dataSource;
    private JdbcTemplate jdbc;
    private ObjectMapper mapper;
    private JdbcContentRepository repository;

    @BeforeEach
    void setUp() {
        HikariConfig config = new HikariConfig();
        config.setJdbcUrl("jdbc:h2:mem:content_" + UUID.randomUUID().toString().replace("-", "")
                + ";MODE=MySQL;DB_CLOSE_DELAY=-1");
        config.setUsername("sa");
        config.setMaximumPoolSize(2);
        config.setMinimumIdle(0);
        dataSource = new HikariDataSource(config);
        jdbc = new JdbcTemplate(dataSource);
        mapper = new ObjectMapper();
        schema();
        repository = new JdbcContentRepository(jdbc, mapper,
                new TransactionTemplate(new DataSourceTransactionManager(dataSource)));
    }

    @AfterEach
    void tearDown() {
        dataSource.close();
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> detail(String code) {
        return (Map<String, Object>) controller().get(code, editor(), new HttpHeaders()).getBody().get("data");
    }

    @Test
    void openingADraftBackfillsStoredFacts() {
        Map<String, Object> draft = draft("Unit summary");
        draft.put("permittedChannels", List.of("APP"));
        draft.put("authorizationEvidenceRef", "EVID-001");
        draft.put("allowsLearning", true);
        command(controller(), "CREATE_DRAFT", "pack-fill", 0, null, draft, "fill-create-key-0001");
        @SuppressWarnings("unchecked")
        Map<String, Object> editorDraft = (Map<String, Object>) detail("pack-fill").get("editorDraft");
        assertEquals(1, ((Number) editorDraft.get("versionNumber")).intValue());
        assertEquals("DRAFT", editorDraft.get("status"));
        assertEquals("SOURCE-TEST", editorDraft.get("sourceCode"));
        assertEquals("LICENSE-TEST", editorDraft.get("licenseCode"));
        assertEquals(List.of("APP"), editorDraft.get("permittedChannels"));
        assertEquals("EVID-001", editorDraft.get("authorizationEvidenceRef"));
        assertEquals(true, editorDraft.get("allowsLearning"));
        assertEquals("Unit summary", ((Map<?, ?>) editorDraft.get("payload")).get("summary"));
        assertEquals("editor-1", editorDraft.get("editor"));
    }

    @Test
    void revisionFromPublishedCreatesNewDraftAndKeepsPublishedPointer() {
        command(controller(), "CREATE_DRAFT", "pack-rev", 0, null, draft("Live"), "rev-create-key-00001");
        long versionId = jdbc.queryForObject(
                "SELECT content_version_id FROM content_version WHERE content_id = 'pack-rev'", Long.class);
        jdbc.update("UPDATE content_version SET status = 'PUBLISHED', published_at = CURRENT_TIMESTAMP, first_reviewer = 'reviewer-1', final_reviewer = 'reviewer-2', publisher = 'publisher-1' WHERE content_version_id = ?", versionId);
        jdbc.update("UPDATE content_definition SET current_published_version_id = ? WHERE content_id = 'pack-rev'",
                versionId);
        long revision = repository.findByCode("pack-rev").orElseThrow().stateVersion();
        command(controller(), "SAVE_DRAFT", "pack-rev", revision, 1, draft("Revised"), "rev-save-key-0000001");

        ContentDefinition stored = repository.findByCode("pack-rev").orElseThrow();
        assertEquals(2, stored.versions().size());
        assertEquals(versionId, stored.currentPublishedVersion().orElseThrow().versionId().value());
        @SuppressWarnings("unchecked")
        Map<String, Object> editorDraft = (Map<String, Object>) detail("pack-rev").get("editorDraft");
        assertEquals(2, ((Number) editorDraft.get("versionNumber")).intValue());
        assertEquals("DRAFT", editorDraft.get("status"));
        assertEquals(1, ((Number) editorDraft.get("publishedVersionNumber")).intValue());
        assertEquals("Revised", ((Map<?, ?>) editorDraft.get("payload")).get("summary"));
    }

    @Test
    void savingWhileLatestIsInReviewIsRefused() {
        command(controller(), "CREATE_DRAFT", "pack-frozen", 0, null, draft("v1"), "frozen-create-key-01");
        jdbc.update("UPDATE content_version SET status = 'IN_REVIEW' WHERE content_id = 'pack-frozen'");
        long revision = repository.findByCode("pack-frozen").orElseThrow().stateVersion();
        ContentOperationException frozen = assertThrows(ContentOperationException.class,
                () -> command(controller(), "SAVE_DRAFT", "pack-frozen", revision, 1, draft("v2"),
                        "frozen-save-key-0001"));
        assertEquals(409, frozen.status());
        assertEquals("CONTENT_IN_REVIEW", frozen.code());
        assertEquals(1, repository.findByCode("pack-frozen").orElseThrow().versions().size());
    }

    @Test
    void staleWorkbenchSaveIsAConflict() {
        command(controller(), "CREATE_DRAFT", "pack-stale2", 0, null, draft("v1"), "stale2-create-key-01");
        command(controller(), "SAVE_DRAFT", "pack-stale2", 1, 1, draft("v2"), "stale2-save-key-0001");
        ContentOperationException stale = assertThrows(ContentOperationException.class,
                () -> command(controller(), "SAVE_DRAFT", "pack-stale2", 1, 1, draft("v3"),
                        "stale2-save-key-0002"));
        assertEquals(409, stale.status());
        assertEquals("VERSION_CONFLICT", stale.code());
    }

    @Test
    void rejectNeedsAReasonAndTheReasonIsShownToTheAuthor() {
        command(controller(), "CREATE_DRAFT", "pack-reject", 0, null, draft("v1"), "reject-create-key-01");
        jdbc.update("UPDATE content_version SET status = 'IN_REVIEW' WHERE content_id = 'pack-reject'");
        long revision = repository.findByCode("pack-reject").orElseThrow().stateVersion();
        ContentOperationException missing = assertThrows(ContentOperationException.class,
                () -> review("pack-reject", revision, "REJECTED", "  ", "reject-review-key-01"));
        assertEquals("CONTENT_REJECT_REASON_REQUIRED", missing.code());
        assertEquals(400, missing.status());

        review("pack-reject", revision, "CHANGES_REQUESTED", "第三题答案解析缺失", "reject-review-key-02");
        assertEquals("DRAFT", repository.findByCode("pack-reject").orElseThrow().versions().getFirst().status().name());
        @SuppressWarnings("unchecked")
        Map<String, Object> rejection = (Map<String, Object>) detail("pack-reject").get("lastRejection");
        assertEquals("第三题答案解析缺失", rejection.get("note"));
        assertEquals("reviewer-1", rejection.get("reviewer"));
        assertEquals("FIRST_REVIEW", rejection.get("reviewStage"));
        assertEquals("CHANGES_REQUESTED", rejection.get("decision"));
    }

    @Test
    void editorCannotReviewOwnVersion() {
        command(controller(), "CREATE_DRAFT", "pack-self", 0, null, draft("v1"), "self-create-key-0001");
        jdbc.update("UPDATE content_version SET status = 'IN_REVIEW' WHERE content_id = 'pack-self'");
        long revision = repository.findByCode("pack-self").orElseThrow().stateVersion();
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("command", "REVIEW_FIRST");
        body.put("contentCode", "pack-self");
        body.put("expectedStateVersion", revision);
        body.put("reviewDecision", "APPROVED");
        ContentOperationException self = assertThrows(ContentOperationException.class,
                () -> controller().command(body, actor("editor-1", "content:review:first"),
                        "self-review-key-0001", new HttpHeaders()));
        assertEquals("FOUR_EYES_REQUIRED", self.code());
    }

    private void review(String code, long expected, String decision, String note, String key) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("command", "REVIEW_FIRST");
        body.put("contentCode", code);
        body.put("expectedStateVersion", expected);
        body.put("reviewDecision", decision);
        body.put("reviewNote", note);
        controller().command(body, reviewer(), key, new HttpHeaders());
    }

    private B9ContentAdminController controller() {
        JdbcContentIdempotency idempotency = new JdbcContentIdempotency(
                jdbc, new TransactionTemplate(new DataSourceTransactionManager(dataSource)),
                mapper, Clock.systemUTC());
        ContentCommandService commands = new ContentCommandService(repository,
                new InMemoryContentOutbox(), idempotency, new InMemoryPublicProjectionStore(),
                new RecordingContentCacheInvalidator(),
                new com.englishflow.content.adapter.memory.InMemoryValidationReportStore(),
                Clock.systemUTC());
        B9ContentAdminController controller = new B9ContentAdminController(commands, mock(LexemeCommandService.class),
                mock(ContentItemCommandService.class), mock(ScheduledPublishService.class),
                repository, new VerifiedContentPrincipalFactory(), idempotency,
                new com.englishflow.content.adapter.memory.InMemoryValidationReportStore());
        controller.setReviewNotes(new JdbcContentReviewNotes(jdbc));
        return controller;
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> command(B9ContentAdminController controller,
            String operation, String code, long expected, Integer target,
            Map<String, Object> draft, String key) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("command", operation);
        body.put("contentCode", code);
        body.put("expectedStateVersion", expected);
        body.put("content", draft);
        if (target != null) body.put("targetVersionNumber", target);
        return (Map<String, Object>) controller.command(body, editor(), key, new HttpHeaders())
                .getBody().get("data");
    }

    private static Map<String, Object> draft(String summary) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("contentType", "COURSE_UNIT");
        result.put("title", "Lesson");
        result.put("contentLocale", "en-US");
        result.put("targetLevel", "A1");
        result.put("sourceCode", "SOURCE-TEST");
        result.put("licenseCode", "LICENSE-TEST");
        result.put("summary", summary);
        result.put("items", List.of(Map.of("displayText", "A sentence.")));
        return result;
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> batch(B9ContentAdminController controller,
            String code, Map<String, Object> draft, String key) {
        Map<String, Object> item = Map.of("contentCode", code, "content", draft);
        return (Map<String, Object>) controller.importBatch(Map.of("items", List.of(item)),
                editor(), key, new HttpHeaders()).getBody().get("data");
    }

    private static Map<String, Object> payload(String summary) {
        return Map.of("summary", summary, "contentLocale", "en-US", "targetLevel", "A1",
                "items", List.of(Map.of("displayText", "A sentence.")));
    }

    private static ContentRights pendingRights() {
        return new ContentRights("SOURCE-TEST", "LICENSE-TEST", CopyrightStatus.PENDING,
                false, Set.of(), null, null, null);
    }

    private static JwtAuthenticationToken editor() {
        return actor("editor-1", "content:write");
    }

    private static JwtAuthenticationToken reviewer() {
        return actor("reviewer-1", "content:review:first");
    }

    private static JwtAuthenticationToken actor(String subject, String permission) {
        Instant now = Instant.now();
        Jwt jwt = Jwt.withTokenValue("test-only")
                .header("alg", "RS256")
                .subject(subject)
                .issuedAt(now)
                .expiresAt(now.plusSeconds(300))
                .claim("tenant_id", "platform")
                .claim("permissions", List.of(permission))
                .build();
        return new JwtAuthenticationToken(jwt, Set.of(), subject);
    }

    private void schema() {
        jdbc.execute("""
                CREATE TABLE content_definition (
                    content_id VARCHAR(128) PRIMARY KEY, tenant_id VARCHAR(128),
                    content_code VARCHAR(128) UNIQUE, kind VARCHAR(32), title VARCHAR(255),
                    locale VARCHAR(64), target_level VARCHAR(64), goal_code VARCHAR(128),
                    created_by VARCHAR(128), created_at TIMESTAMP,
                    current_published_version_id BIGINT, content_epoch BIGINT,
                    projection_version BIGINT, state_version BIGINT NOT NULL)
                """);
        jdbc.execute("""
                CREATE TABLE content_version (
                    content_version_id BIGINT PRIMARY KEY, content_id VARCHAR(128),
                    version_no BIGINT, kind VARCHAR(32), status VARCHAR(32),
                    payload_json CLOB, payload_hash VARCHAR(64), rights_source_code VARCHAR(128),
                    rights_license_code VARCHAR(128), copyright_status VARCHAR(32),
                    rights_allows_learning BOOLEAN, rights_permitted_channels CLOB,
                    rights_starts_at TIMESTAMP, rights_expires_at TIMESTAMP,
                    authorization_evidence_ref VARCHAR(128), editor VARCHAR(128),
                    rights_proposed_channels CLOB, rights_proposed_evidence_ref VARCHAR(128),
                    rights_proposed_allows_learning BOOLEAN,
                    release_note VARCHAR(255), first_reviewer VARCHAR(128),
                    final_reviewer VARCHAR(128), publisher VARCHAR(128), published_at TIMESTAMP,
                    archived_at TIMESTAMP, rollback_of_version_id BIGINT,
                    first_review_version INT, final_review_version INT,
                    state_version BIGINT, created_at TIMESTAMP,
                    UNIQUE (content_id, version_no))
                """);
        jdbc.execute("""
                CREATE TABLE content_validation_report (
                    report_id VARCHAR(128) PRIMARY KEY, report_version BIGINT,
                    content_version_id BIGINT, payload_hash VARCHAR(64), rule_version VARCHAR(64),
                    passed BOOLEAN, finding_count INT, blocker_count INT,
                    findings_json CLOB, media_refs_json CLOB,
                    checked_by VARCHAR(128), checked_at TIMESTAMP, created_at TIMESTAMP)
                """);
        jdbc.execute("""
                CREATE TABLE content_review_note (
                    note_id BIGINT AUTO_INCREMENT PRIMARY KEY, tenant_id VARCHAR(128) DEFAULT 'platform',
                    content_code VARCHAR(128), content_version_id BIGINT, version_number INT,
                    review_stage VARCHAR(24), decision VARCHAR(24), note VARCHAR(512),
                    reviewer VARCHAR(128), decided_at TIMESTAMP)
                """);
        jdbc.execute("CREATE TABLE content_version_id_sequence (id BIGINT AUTO_INCREMENT PRIMARY KEY)");
        jdbc.update("INSERT INTO content_version_id_sequence (id) VALUES (25000)");
        jdbc.execute("""
                CREATE TABLE content_idempotency_record (
                    scope VARCHAR(255), idempotency_key VARCHAR(128), request_fingerprint VARCHAR(64),
                    status VARCHAR(24), response_json CLOB, recorded_at TIMESTAMP,
                    PRIMARY KEY (scope, idempotency_key))
                """);
    }
}
