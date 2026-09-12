package com.englishflow.notification.adapter.jdbc;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.Statement;
import java.util.List;
import java.util.Map;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

@EnabledIfSystemProperty(named = "notification.tenant.integration", matches = "true")
class NotificationTenantIsolationTest {

    private static final List<String> GUARDED_COLUMNS =
            List.of("tenant_id", "principal_id", "trace_id", "request_id");

    @Test
    void unknownDefaultsAreRemovedAndSchemaWritesAreIsolated() throws Exception {
        String adminUrl = required("NOTIFICATION_TENANT_TEST_ADMIN_URL");
        String adminUser = required("NOTIFICATION_TENANT_TEST_ADMIN_USER");
        String adminPassword = required("NOTIFICATION_TENANT_TEST_ADMIN_PASSWORD");
        String suffix = Long.toString(System.currentTimeMillis());
        String schema = "notification_tenant_test_" + suffix;
        String guardSchema = "notification_tenant_guard_" + suffix;
        String guardUser = "notification_guard_" + suffix;
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

            List<Map<String, Object>> columns = jdbc.queryForList("""
                    SELECT COLUMN_NAME, COLUMN_DEFAULT FROM information_schema.COLUMNS
                     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'notification_outbox_event'
                       AND COLUMN_NAME IN ('tenant_id', 'principal_id', 'trace_id', 'request_id')
                    """, schema);
            assertEquals(GUARDED_COLUMNS.size(), columns.size(), "all guarded columns must exist");
            for (Map<String, Object> column : columns) {
                assertNull(column.get("COLUMN_DEFAULT"),
                        "column " + column.get("COLUMN_NAME") + " must not keep an 'unknown' default");
            }
            assertThrows(DataAccessException.class, () -> jdbc.update("""
                    INSERT INTO notification_outbox_event
                        (event_id, aggregate_type, aggregate_id, event_name, schema_version, dedupe_key,
                         payload_json, status, attempt_count, available_at, created_at, occurred_at)
                    VALUES ('evt-missing-tenant', 'notification', 'agg-1', 'notification.created.v1', 1, 'dedupe-1',
                            '{}', 'PENDING', 0, NOW(6), NOW(6), NOW(6))
                    """), "an outbox insert without an explicit tenant must fail");
            jdbc.update("""
                    INSERT INTO notification_outbox_event
                        (event_id, aggregate_type, aggregate_id, event_name, schema_version, dedupe_key,
                         payload_json, status, attempt_count, available_at, created_at, tenant_id, principal_id,
                         trace_id, request_id, occurred_at)
                    VALUES ('evt-tenant-real', 'notification', 'agg-1', 'notification.created.v1', 1, 'dedupe-2',
                            '{}', 'PENDING', 0, NOW(6), NOW(6), 'platform', 'prn_notification-a-000001',
                            'trace-real-1', 'req-real-1', NOW(6))
                    """);

            execute(adminUrl, adminUser, adminPassword, "CREATE USER IF NOT EXISTS " + quote(guardUser)
                    + "@'%' IDENTIFIED BY " + quote("notification-guard-test"));
            execute(adminUrl, adminUser, adminPassword, "ALTER USER " + quote(guardUser)
                    + "@'%' IDENTIFIED BY " + quote("notification-guard-test"));
            execute(adminUrl, adminUser, adminPassword, "GRANT SELECT, INSERT, UPDATE, DELETE ON " + schema + ".* TO "
                    + quote(guardUser) + "@'%'");
            DriverManagerDataSource guardDataSource = new DriverManagerDataSource(schemaUrl, guardUser,
                    "notification-guard-test");
            JdbcTemplate guardJdbc = new JdbcTemplate(guardDataSource);
            guardJdbc.update("""
                    INSERT INTO notification_outbox_event
                        (event_id, aggregate_type, aggregate_id, event_name, schema_version, dedupe_key,
                         payload_json, status, attempt_count, available_at, created_at, tenant_id, principal_id,
                         trace_id, request_id, occurred_at)
                    VALUES ('evt-tenant-guard', 'notification', 'agg-guard', 'notification.created.v1', 1, 'dedupe-3',
                            '{}', 'PENDING', 0, NOW(6), NOW(6), 'platform', 'prn_notification-c-000003',
                            'trace-guard', 'req-guard', NOW(6))
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
