package com.englishflow.gamification.adapter.jdbc;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.Statement;
import java.time.Instant;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.transaction.support.TransactionTemplate;

import tools.jackson.databind.ObjectMapper;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

@EnabledIfSystemProperty(named = "gamification.tenant.integration", matches = "true")
class GamificationTenantIsolationTest {

    private static final Instant NOW = Instant.parse("2026-09-12T00:00:00Z");

    @Test
    void subjectScopedFactsAndSchemaWritesAreIsolated() throws Exception {
        String adminUrl = required("GAMIFICATION_TENANT_TEST_ADMIN_URL");
        String adminUser = required("GAMIFICATION_TENANT_TEST_ADMIN_USER");
        String adminPassword = required("GAMIFICATION_TENANT_TEST_ADMIN_PASSWORD");
        String suffix = Long.toString(System.currentTimeMillis());
        String schema = "gamification_tenant_test_" + suffix;
        String guardSchema = "gamification_tenant_guard_" + suffix;
        String guardUser = "gamification_guard_" + suffix;
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
            JdbcGamificationFactStore store = new JdbcGamificationFactStore(jdbc,
                    new TransactionTemplate(new DataSourceTransactionManager(schemaDataSource)), new ObjectMapper());

            long balance = store.inUserTransaction("prn_gam-subject-a-0001",
                    facts -> facts.appendXp("xp-real-1", 10, "evt-real-1", "LESSON_DONE", "tr-real-1",
                            "rule-v1", NOW, NOW).balanceAfter());
            assertEquals(10L, balance, "the awarded XP must persist for the owning subject");
            long persisted = store.inUserTransaction("prn_gam-subject-a-0001", facts -> facts.xpBalance());
            assertEquals(10L, persisted, "the owning subject must read its persisted balance");
            long foreign = store.inUserTransaction("prn_gam-subject-b-0002", facts -> facts.xpBalance());
            assertEquals(0L, foreign, "another subject must not observe the ledger");
            assertEquals("platform", jdbc.queryForObject(
                    "SELECT tenant_id FROM xp_ledger WHERE ledger_id = 'xp-real-1'", String.class),
                    "phase 1 writes are pinned to the platform tenant");

            execute(adminUrl, adminUser, adminPassword, "CREATE USER IF NOT EXISTS " + quote(guardUser)
                    + "@'%' IDENTIFIED BY " + quote("gamification-guard-test"));
            execute(adminUrl, adminUser, adminPassword, "ALTER USER " + quote(guardUser)
                    + "@'%' IDENTIFIED BY " + quote("gamification-guard-test"));
            execute(adminUrl, adminUser, adminPassword, "GRANT SELECT, INSERT, UPDATE, DELETE ON " + schema + ".* TO "
                    + quote(guardUser) + "@'%'");
            DriverManagerDataSource guardDataSource = new DriverManagerDataSource(schemaUrl, guardUser,
                    "gamification-guard-test");
            JdbcTemplate guardJdbc = new JdbcTemplate(guardDataSource);
            guardJdbc.update("""
                    INSERT INTO xp_ledger (ledger_id, subject_id, tenant_id, source_event_id, delta, balance_after, created_at)
                    VALUES ('xp-real-guard', 'prn_gam-subject-c-0003', 'platform', 'evt-guard', 5, 5, NOW(6))
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
