package com.englishflow.content.adapter.jdbc;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.Statement;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Map;
import java.util.Set;

import com.englishflow.content.adapter.memory.InMemoryContentIdempotency;
import com.englishflow.content.adapter.memory.InMemoryContentOutbox;
import com.englishflow.content.adapter.memory.InMemoryPublicProjectionStore;
import com.englishflow.content.adapter.memory.RecordingContentCacheInvalidator;
import com.englishflow.content.application.ContentCommandService;
import com.englishflow.content.application.ContentReadService;
import com.englishflow.content.domain.ContentActor;
import com.englishflow.content.domain.ContentAudience;
import com.englishflow.content.domain.ContentChannel;
import com.englishflow.content.domain.ContentId;
import com.englishflow.content.domain.ContentIdempotencyKey;
import com.englishflow.content.domain.ContentKind;
import com.englishflow.content.domain.ContentOperationException;
import com.englishflow.content.domain.ContentRequestContext;
import com.englishflow.content.domain.ContentRights;
import com.englishflow.content.domain.ContentVersionId;
import com.englishflow.content.domain.CopyrightStatus;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;

import tools.jackson.databind.ObjectMapper;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

@EnabledIfSystemProperty(named = "content.tenant.integration", matches = "true")
class ContentTenantIsolationTest {

    private static final Instant NOW = Instant.parse("2026-09-12T00:00:00Z");
    private static final Clock CLOCK = Clock.fixed(NOW, ZoneOffset.UTC);
    private static final ContentRequestContext REQUEST =
            new ContentRequestContext("req-content-real-1", "0123456789abcdef0123456789abcdef");

    @Test
    void crossTenantGuardAndSchemaWritesAreEnforced() throws Exception {
        String adminUrl = required("CONTENT_TENANT_TEST_ADMIN_URL");
        String adminUser = required("CONTENT_TENANT_TEST_ADMIN_USER");
        String adminPassword = required("CONTENT_TENANT_TEST_ADMIN_PASSWORD");
        String suffix = Long.toString(System.currentTimeMillis());
        String schema = "content_tenant_test_" + suffix;
        String guardSchema = "content_tenant_guard_" + suffix;
        String guardUser = "content_guard_" + suffix;
        execute(adminUrl, adminUser, adminPassword, "CREATE DATABASE " + schema
                + " CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
        execute(adminUrl, adminUser, adminPassword, "CREATE DATABASE " + guardSchema
                + " CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
        execute(adminUrl, adminUser, adminPassword, "CREATE TABLE " + guardSchema
                + ".guard_marker (id INT PRIMARY KEY)");
        try {
            DriverManagerDataSource adminDataSource = new DriverManagerDataSource(adminUrl, adminUser, adminPassword);
            Flyway.configure()
                    .dataSource(adminDataSource)
                    .schemas(schema)
                    .createSchemas(false)
                    .locations("classpath:db/migration")
                    .load()
                    .migrate();

            String schemaUrl = databaseUrl(adminUrl, schema);
            DriverManagerDataSource schemaDataSource = new DriverManagerDataSource(schemaUrl, adminUser, adminPassword);
            JdbcTemplate jdbc = new JdbcTemplate(schemaDataSource);
            JdbcContentRepository repository = new JdbcContentRepository(jdbc, new ObjectMapper());
            ContentCommandService commands = new ContentCommandService(repository, new InMemoryContentOutbox(),
                    new InMemoryContentIdempotency(), new InMemoryPublicProjectionStore(),
                    new RecordingContentCacheInvalidator(),
                    new com.englishflow.content.adapter.memory.InMemoryValidationReportStore(), CLOCK);
            ContentReadService reads = new ContentReadService(repository, new InMemoryPublicProjectionStore(), CLOCK);

            ContentActor editor = new ContentActor("editor-real-1", "platform", Set.of("content-editor"),
                    Set.of("content:write"), false);
            ContentActor foreignEditor = new ContentActor("editor-real-1", "other-tenant", Set.of("content-editor"),
                    Set.of("content:write"), false);
            ContentId contentId = new ContentId("cnt_real_1");
            ContentRights rights = new ContentRights("src", "lic", CopyrightStatus.ACTIVE, true,
                    Set.of("PUBLIC", "LEARNER", "ASSESSMENT"), NOW.minusSeconds(60), null, "evidence-1");
            commands.createContent(new ContentCommandService.CreateContent(
                    contentId, "vocab-real-1", ContentKind.VOCABULARY, "Real Title", "en-US", "A1", "ONB"),
                    editor, new ContentIdempotencyKey("create-key-0000000000000000"), REQUEST);
            commands.createVersion(new ContentCommandService.CreateVersion(
                    contentId, new ContentVersionId(9001L), Map.of("term", "cat", "definition", "猫"),
                    rights, "note"), editor, new ContentIdempotencyKey("create-ver-key-0000000000"), REQUEST);
            assertTrue(repository.findByCode("vocab-real-1").isPresent(),
                    "the owning tenant must read the persisted content");

            ContentOperationException versionDenied = assertThrows(ContentOperationException.class,
                    () -> commands.createVersion(new ContentCommandService.CreateVersion(
                            contentId, new ContentVersionId(9002L), Map.of("term", "dog"),
                            rights, "note"), foreignEditor,
                            new ContentIdempotencyKey("foreign-ver-key-000000000"), REQUEST),
                    "a version command from another tenant must be denied");
            assertEquals("CONTENT_TENANT_DENIED", versionDenied.code());

            ContentOperationException readDenied = assertThrows(ContentOperationException.class,
                    () -> reads.readByCodeResult("vocab-real-1", ContentAudience.ADMIN_PREVIEW, ContentChannel.ADMIN,
                            null, false, foreignEditor),
                    "a read from another tenant must be denied");
            assertEquals("CONTENT_TENANT_DENIED", readDenied.code());
            long visibleToForeign = repository.findAll().stream()
                    .filter(content -> content.tenantId().equals(foreignEditor.tenantId()))
                    .count();
            assertEquals(0L, visibleToForeign, "another tenant must see zero content rows");

            execute(adminUrl, adminUser, adminPassword, "CREATE USER IF NOT EXISTS " + quote(guardUser)
                    + "@'%' IDENTIFIED BY " + quote("content-guard-test"));
            execute(adminUrl, adminUser, adminPassword, "ALTER USER " + quote(guardUser)
                    + "@'%' IDENTIFIED BY " + quote("content-guard-test"));
            execute(adminUrl, adminUser, adminPassword, "GRANT SELECT, INSERT, UPDATE, DELETE ON " + schema + ".* TO "
                    + quote(guardUser) + "@'%'");
            DriverManagerDataSource guardDataSource = new DriverManagerDataSource(schemaUrl, guardUser,
                    "content-guard-test");
            JdbcTemplate guardJdbc = new JdbcTemplate(guardDataSource);
            guardJdbc.update("""
                    INSERT INTO content_definition
                        (content_id, tenant_id, content_code, kind, title, locale, target_level, goal_code,
                         created_by, created_at, current_published_version_id, content_epoch, projection_version)
                    VALUES ('cnt_guard_1', 'platform', 'vocab-guard-1', 'VOCABULARY', 'Guard Title', 'en-US', 'A1',
                            'ONB', 'guard', NOW(6), NULL, 0, 0)
                    """);
            assertThrows(DataAccessException.class, () -> guardJdbc.update("INSERT INTO " + guardSchema
                    + ".guard_marker (id) VALUES (1)"), "a schema-scoped credential must not write another schema");
        } finally {
            execute(adminUrl, adminUser, adminPassword, "DROP DATABASE IF EXISTS " + schema);
            execute(adminUrl, adminUser, adminPassword, "DROP DATABASE IF EXISTS " + guardSchema);
            try {
                execute(adminUrl, adminUser, adminPassword, "DROP USER IF EXISTS " + quote(guardUser) + "@'%'");
            } catch (Exception ignored) {
                // the credential may never have been created
            }
        }
    }

    private static String databaseUrl(String adminUrl, String schema) {
        return adminUrl.endsWith("/") ? adminUrl + schema : adminUrl + "/" + schema;
    }

    private static String quote(String value) {
        return "'" + value.replace("'", "''") + "'";
    }

    private static void execute(String url, String user, String password, String sql) throws Exception {
        try (Connection connection = DriverManager.getConnection(url, user, password);
             Statement statement = connection.createStatement()) {
            statement.execute(sql);
        }
    }

    private static String required(String name) {
        String value = System.getenv(name);
        if (value == null || value.isBlank()) {
            value = System.getProperty(name);
        }
        if (value == null || value.isBlank()) {
            throw new AssertionError(name + " is required");
        }
        return value;
    }
}
