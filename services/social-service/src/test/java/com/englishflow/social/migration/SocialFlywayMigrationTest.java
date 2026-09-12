package com.englishflow.social.migration;

import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.Statement;

import javax.sql.DataSource;

import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.FlywayException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.jdbc.datasource.DriverManagerDataSource;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

@EnabledIfSystemProperty(named = "social.migration.integration", matches = "true")
class SocialFlywayMigrationTest {

    @Test
    void emptyAndExistingDatabasesMigrateAndFailureRecovers(@TempDir Path tempDir) throws Exception {
        String adminUrl = required("SOCIAL_FLYWAY_TEST_ADMIN_URL");
        String adminUser = required("SOCIAL_FLYWAY_TEST_ADMIN_USER");
        String adminPassword = required("SOCIAL_FLYWAY_TEST_ADMIN_PASSWORD");
        String schema = "social_flyway_test_" + System.currentTimeMillis();
        execute(adminUrl, adminUser, adminPassword, "CREATE DATABASE " + schema
                + " CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
        DataSource dataSource = new DriverManagerDataSource(adminUrl, adminUser, adminPassword);
        try {
            Flyway flyway = Flyway.configure()
                    .dataSource(dataSource)
                    .schemas(schema)
                    .createSchemas(false)
                    .locations("classpath:db/migration")
                    .load();
            var first = flyway.migrate();
            assertTrue(first.success, "empty database migration must succeed");
            assertTrue(first.migrationsExecuted >= 1, "empty database must apply the owner baseline");
            var second = flyway.migrate();
            assertTrue(second.success, "re-running migration on the existing database must succeed");
            assertEquals(0, second.migrationsExecuted, "existing database must not reapply migrations");

            Path brokenDir = tempDir.resolve("broken");
            Files.createDirectories(brokenDir);
            Files.writeString(brokenDir.resolve("V99__broken.sql"), "CREATE TABLE broken_table (id INT;\n");
            String location = "filesystem:" + brokenDir.toAbsolutePath().toString().replace('\\', '/');
            Flyway broken = Flyway.configure()
                    .dataSource(dataSource)
                    .schemas(schema)
                    .createSchemas(false)
                    .locations(location)
                    .ignoreMigrationPatterns("*:missing")
                    .load();
            assertThrows(FlywayException.class, broken::migrate, "a failing migration must not report success");
            assertEquals(1, failedRows(adminUrl, adminUser, adminPassword, schema),
                    "the failed migration must be recorded as unsuccessful");
            broken.repair();
            Files.writeString(brokenDir.resolve("V99__broken.sql"), "CREATE TABLE broken_table (id INT PRIMARY KEY);\n");
            var recovered = broken.migrate();
            assertTrue(recovered.success, "a repaired migration must be recoverable");
            assertEquals(0, failedRows(adminUrl, adminUser, adminPassword, schema));
        } finally {
            execute(adminUrl, adminUser, adminPassword, "DROP DATABASE IF EXISTS " + schema);
        }
    }

    private static int failedRows(String url, String user, String password, String schema) throws Exception {
        try (Connection connection = DriverManager.getConnection(url, user, password);
             Statement statement = connection.createStatement();
             ResultSet result = statement.executeQuery("SELECT COUNT(*) FROM " + schema
                     + ".flyway_schema_history WHERE success = 0")) {
            result.next();
            return result.getInt(1);
        }
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
