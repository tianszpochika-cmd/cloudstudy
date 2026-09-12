package com.englishflow.assessment.adapter.jdbc;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.Statement;
import java.time.Instant;
import java.util.Map;

import com.englishflow.assessment.port.AssessmentStatePort;

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

@EnabledIfSystemProperty(named = "assessment.tenant.integration", matches = "true")
class AssessmentTenantIsolationTest {

    @Test
    void tenantScopedIdempotencyAndSchemaWritesAreIsolated() throws Exception {
        String adminUrl = required("ASSESSMENT_TENANT_TEST_ADMIN_URL");
        String adminUser = required("ASSESSMENT_TENANT_TEST_ADMIN_USER");
        String adminPassword = required("ASSESSMENT_TENANT_TEST_ADMIN_PASSWORD");
        String suffix = Long.toString(System.currentTimeMillis());
        String schema = "assessment_tenant_test_" + suffix;
        String guardSchema = "assessment_tenant_guard_" + suffix;
        String guardUser = "assessment_guard_" + suffix;
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
            AssessmentStatePort port = new JdbcAssessmentStatePort(jdbc, new ObjectMapper(), schema);

            assertTrue(port.load().sessions().isEmpty(), "an empty schema must restore an empty state");
            AssessmentStatePort.IdempotencyRecord recordA = new AssessmentStatePort.IdempotencyRecord(
                    "tenant-a", "prn_assessment-a-000001", "attempt.submit", "idem-key-000000001",
                    "a".repeat(64), Map.of("outcome", "tenant-a"), Instant.now());
            port.saveIdempotency(recordA);
            assertTrue(port.findIdempotency("tenant-a", "prn_assessment-a-000001", "attempt.submit",
                    "idem-key-000000001").isPresent(), "the owning tenant must read its idempotency record");
            assertTrue(port.findIdempotency("tenant-b", "prn_assessment-b-000001", "attempt.submit",
                    "idem-key-000000001").isEmpty(), "another tenant must not read the idempotency record");
            AssessmentStatePort.IdempotencyRecord recordB = new AssessmentStatePort.IdempotencyRecord(
                    "tenant-b", "prn_assessment-b-000001", "attempt.submit", "idem-key-000000001",
                    "b".repeat(64), Map.of("outcome", "tenant-b"), Instant.now());
            AssessmentStatePort.IdempotencyRecord storedB = port.saveIdempotency(recordB);
            assertEquals("tenant-b", storedB.tenantId(), "the same key in another tenant must be independent");
            assertEquals(Map.of("outcome", "tenant-b"), storedB.response());
            assertEquals(Map.of("outcome", "tenant-a"), port.findIdempotency("tenant-a", "prn_assessment-a-000001",
                    "attempt.submit", "idem-key-000000001").orElseThrow().response());

            execute(adminUrl, adminUser, adminPassword, "CREATE USER IF NOT EXISTS " + quote(guardUser)
                    + "@'%' IDENTIFIED BY " + quote("assessment-guard-test"));
            execute(adminUrl, adminUser, adminPassword, "ALTER USER " + quote(guardUser)
                    + "@'%' IDENTIFIED BY " + quote("assessment-guard-test"));
            execute(adminUrl, adminUser, adminPassword, "GRANT SELECT, INSERT, UPDATE, DELETE ON " + schema + ".* TO "
                    + quote(guardUser) + "@'%'");
            DriverManagerDataSource guardDataSource = new DriverManagerDataSource(schemaUrl, guardUser,
                    "assessment-guard-test");
            JdbcTemplate guardJdbc = new JdbcTemplate(guardDataSource);
            guardJdbc.update("""
                    INSERT INTO assessment_idempotency
                        (tenant_id, subject_id, operation, idempotency_key, request_digest, response_json, created_at)
                    VALUES ('tenant-c', 'prn_assessment-c-000001', 'attempt.submit', 'idem-key-000000002', ?, '{}', NOW(6))
                    """, "c".repeat(64));
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
