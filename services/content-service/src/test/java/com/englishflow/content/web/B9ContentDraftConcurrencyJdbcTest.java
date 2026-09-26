package com.englishflow.content.web;

import com.englishflow.content.adapter.jdbc.JdbcContentIdempotency;
import com.englishflow.content.adapter.jdbc.JdbcContentRepository;
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

/** Uses two adapter instances against one SQL database: no real service or owner data is touched. */
class B9ContentDraftConcurrencyJdbcTest {

    private HikariDataSource dataSource;
    private JdbcTemplate jdbc;
    private TransactionTemplate transaction;
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
        config.setConnectionTimeout(5_000L);
        dataSource = new HikariDataSource(config);
        jdbc = new JdbcTemplate(dataSource);
        transaction = new TransactionTemplate(new DataSourceTransactionManager(dataSource));
        mapper = new ObjectMapper();
        schema();
        repository = new JdbcContentRepository(jdbc, mapper, transaction);
    }

    @AfterEach
    void tearDown() {
        dataSource.close();
    }

    @Test
    void staleSaveRejectsAndDoesNotCreateThirdVersion() {
        B9ContentAdminController controller = controller();
        Map<String, Object> created = command(controller, "CREATE_DRAFT", "pack-stale", 0, null,
                draft("First"), "create-stale-key-0001");
        assertEquals(1, ((Number) created.get("stateVersion")).intValue());
        Map<String, Object> saved = command(controller, "SAVE_DRAFT", "pack-stale", 1, 1,
                draft("Second"), "save-stale-key-00001");
        assertEquals(2, ((Number) saved.get("stateVersion")).intValue());
        Map<String, Object> replay = command(controller(), "SAVE_DRAFT", "pack-stale", 1, 1,
                draft("Second"), "save-stale-key-00001");
        assertEquals(((Number) saved.get("contentVersionId")).longValue(),
                ((Number) replay.get("contentVersionId")).longValue());
        assertEquals(((Number) saved.get("stateVersion")).longValue(),
                ((Number) replay.get("stateVersion")).longValue());

        ContentOperationException stale = assertThrows(ContentOperationException.class,
                () -> command(controller, "SAVE_DRAFT", "pack-stale", 1, 1,
                        draft("Third"), "save-stale-key-00002"));
        assertEquals(409, stale.status());
        assertEquals("VERSION_CONFLICT", stale.code());
        ContentDefinition stored = repository.findByCode("pack-stale").orElseThrow();
        assertEquals(2, stored.versions().size());
        assertEquals(2, stored.stateVersion());
        assertEquals("First", stored.versions().getFirst().payload().raw().get("summary"));
    }

    @Test
    void coldReplayUsesDurableReceiptAndChangedBodyConflicts() throws Exception {
        B9ContentAdminController firstProcess = controller();
        Map<String, Object> first = command(firstProcess, "CREATE_DRAFT", "pack-replay", 0, null,
                draft("First"), "replay-key-00000001");
        B9ContentAdminController secondProcess = controller();
        Map<String, Object> replay = command(secondProcess, "CREATE_DRAFT", "pack-replay", 0, null,
                draft("First"), "replay-key-00000001");
        assertEquals(mapper.writeValueAsString(first), mapper.writeValueAsString(replay));
        assertEquals(1, repository.findByCode("pack-replay").orElseThrow().versions().size());

        ContentOperationException changed = assertThrows(ContentOperationException.class,
                () -> command(secondProcess, "CREATE_DRAFT", "pack-replay", 0, null,
                        draft("Different"), "replay-key-00000001"));
        assertEquals(409, changed.status());
        assertEquals("IDEMPOTENCY_KEY_REUSE", changed.code());
    }

    @Test
    @SuppressWarnings("unchecked")
    void automaticValidationColdReplayKeepsTheOriginalTimestampAndRejectsChangedBody() throws Exception {
        Map<String, Object> request = Map.of("content", draft("first validation"));
        Map<String, Object> first = (Map<String, Object>) controller().validateAuto(
                request, editor(), "validation-cold-key-01", new HttpHeaders()).getBody().get("data");
        Map<String, Object> coldReplay = (Map<String, Object>) controller().validateAuto(
                request, editor(), "validation-cold-key-01", new HttpHeaders()).getBody().get("data");
        assertEquals(mapper.writeValueAsString(first), mapper.writeValueAsString(coldReplay));
        assertEquals(1, jdbc.queryForObject(
                "SELECT COUNT(*) FROM content_idempotency_record WHERE scope LIKE '%:content.b9.validate'",
                Integer.class));

        ContentOperationException changed = assertThrows(ContentOperationException.class,
                () -> controller().validateAuto(Map.of("content", draft("changed validation")),
                        editor(), "validation-cold-key-01", new HttpHeaders()));
        assertEquals(409, changed.status());
        assertEquals("IDEMPOTENCY_KEY_REUSE", changed.code());
    }

    @Test
    void failedSecondCreateStepRollsBackDefinitionAndReservations() {
        Map<String, Object> invalid = draft("Missing private answer rule");
        invalid.put("contentType", "QUESTION");
        ContentOperationException failed = assertThrows(ContentOperationException.class,
                () -> command(controller(), "CREATE_DRAFT", "pack-rollback", 0, null,
                        invalid, "rollback-key-000001"));
        assertEquals("QUESTION_ANSWER_RULE_REQUIRED", failed.code());
        assertTrue(repository.findByCode("pack-rollback").isEmpty());
        assertEquals(0, jdbc.queryForObject("SELECT COUNT(*) FROM content_idempotency_record", Integer.class));
    }

    @Test
    void batchDraftRowAlsoRollsBackAndReplaysItsCommittedResult() {
        Map<String, Object> invalid = draft("No answer rule");
        invalid.put("contentType", "QUESTION");
        Map<String, Object> rejected = batch(controller(), "pack-batch-bad", invalid,
                "batch-failed-key-001");
        assertEquals(1L, rejected.get("failed"));
        assertTrue(repository.findByCode("pack-batch-bad").isEmpty());

        Map<String, Object> first = batch(controller(), "pack-batch-good", draft("Valid"),
                "batch-good-key-0001");
        Map<String, Object> second = batch(controller(), "pack-batch-good", draft("Valid"),
                "batch-good-key-0001");
        assertEquals(1L, first.get("accepted"));
        assertEquals(1L, second.get("accepted"));
        assertEquals(1, repository.findByCode("pack-batch-good").orElseThrow().versions().size());
    }

    @Test
    void twoProcessSnapshotsAllowOnlyOneNewVersionAndKeepOldHash() throws Exception {
        command(controller(), "CREATE_DRAFT", "pack-race", 0, null,
                draft("First"), "race-create-key-0001");
        JdbcContentRepository otherProcess = new JdbcContentRepository(jdbc, mapper,
                new TransactionTemplate(new DataSourceTransactionManager(dataSource)));
        ContentDefinition left = repository.findByCode("pack-race").orElseThrow();
        ContentDefinition right = otherProcess.findByCode("pack-race").orElseThrow();
        String oldHash = left.versions().getFirst().contentHash();
        ContentRights rights = pendingRights();
        ContentVersionId leftId = repository.nextVersionId();
        ContentVersionId rightId = otherProcess.nextVersionId();
        assertNotEquals(leftId, rightId);
        left.addDraft(leftId, payload("Left"), rights, "editor-1", "left", Instant.now());
        right.addDraft(rightId, payload("Right"), rights, "editor-1", "right", Instant.now());
        CountDownLatch start = new CountDownLatch(1);
        try (var pool = Executors.newFixedThreadPool(2)) {
            List<Future<String>> outcomes = new ArrayList<>();
            outcomes.add(pool.submit(saveWhenReleased(start, repository, left)));
            outcomes.add(pool.submit(saveWhenReleased(start, otherProcess, right)));
            start.countDown();
            List<String> results = List.of(outcomes.get(0).get(), outcomes.get(1).get());
            assertEquals(1, results.stream().filter("SAVED"::equals).count());
            assertEquals(1, results.stream().filter("VERSION_CONFLICT"::equals).count());
        }
        ContentDefinition stored = repository.findByCode("pack-race").orElseThrow();
        assertEquals(2, stored.versions().size());
        assertEquals(oldHash, stored.versions().getFirst().contentHash());
        assertEquals(2, stored.stateVersion());
    }

    @Test
    void duplicateVersionNumberNeverOverwritesAnExistingRow() {
        command(controller(), "CREATE_DRAFT", "pack-unique", 0, null,
                draft("First"), "unique-create-key-01");
        ContentDefinition stale = repository.findByCode("pack-unique").orElseThrow();
        String foreignHash = "f".repeat(64);
        jdbc.update("""
                INSERT INTO content_version
                    (content_version_id, content_id, version_no, kind, status, payload_json,
                     payload_hash, editor, release_note, first_review_version, final_review_version,
                     state_version, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, 50000, "pack-unique", 2, "COURSE_UNIT", "DRAFT", "{}",
                foreignHash, "legacy-editor", "legacy", 0, 0, 1, java.sql.Timestamp.from(Instant.now()));
        stale.addDraft(repository.nextVersionId(), payload("New"), pendingRights(),
                "editor-1", "new", Instant.now());
        ContentOperationException conflict = assertThrows(ContentOperationException.class,
                () -> repository.save(stale));
        assertEquals(409, conflict.status());
        assertEquals(foreignHash, jdbc.queryForObject(
                "SELECT payload_hash FROM content_version WHERE content_id = ? AND version_no = 2",
                String.class, "pack-unique"));
        assertEquals(1L, jdbc.queryForObject(
                "SELECT state_version FROM content_definition WHERE content_id = ?",
                Long.class, "pack-unique"));
    }

    @Test
    void boundedPoolListsMultiplePagesWithoutCreatingMoreConnections() {
        dataSource.setMaximumPoolSize(1);
        for (int index = 0; index < 205; index++) {
            String code = "list-" + index;
            repository.create(ContentDefinition.create(new com.englishflow.content.domain.ContentId(code),
                    "platform", code, com.englishflow.content.domain.ContentKind.COURSE_UNIT,
                    "Lesson " + index, "en-US", "A1", "PHASE1", "editor-1", Instant.now()));
        }
        assertEquals(205, repository.findAll().size());
        assertTrue(dataSource.getHikariPoolMXBean().getTotalConnections() <= 1);
        assertEquals(0, dataSource.getHikariPoolMXBean().getActiveConnections());
    }

    private static Callable<String> saveWhenReleased(CountDownLatch start, JdbcContentRepository store,
                                                      ContentDefinition content) {
        return () -> {
            start.await();
            try {
                store.save(content);
                return "SAVED";
            } catch (ContentOperationException exception) {
                return exception.code();
            }
        };
    }

    private B9ContentAdminController controller() {
        JdbcContentIdempotency idempotency = new JdbcContentIdempotency(
                jdbc, new TransactionTemplate(new DataSourceTransactionManager(dataSource)),
                mapper, Clock.systemUTC());
        ContentCommandService commands = new ContentCommandService(repository,
                new InMemoryContentOutbox(), idempotency, new InMemoryPublicProjectionStore(),
                new RecordingContentCacheInvalidator(), Clock.systemUTC());
        return new B9ContentAdminController(commands, mock(LexemeCommandService.class),
                mock(ContentItemCommandService.class), mock(ScheduledPublishService.class),
                repository, new VerifiedContentPrincipalFactory(), idempotency);
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
        Instant now = Instant.now();
        Jwt jwt = Jwt.withTokenValue("test-only")
                .header("alg", "RS256")
                .subject("editor-1")
                .issuedAt(now)
                .expiresAt(now.plusSeconds(300))
                .claim("tenant_id", "platform")
                .claim("permissions", List.of("content:write"))
                .build();
        return new JwtAuthenticationToken(jwt, Set.of(), "editor-1");
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
                    release_note VARCHAR(255), first_reviewer VARCHAR(128),
                    final_reviewer VARCHAR(128), publisher VARCHAR(128), published_at TIMESTAMP,
                    archived_at TIMESTAMP, rollback_of_version_id BIGINT,
                    first_review_version INT, final_review_version INT,
                    state_version BIGINT, created_at TIMESTAMP,
                    UNIQUE (content_id, version_no))
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
