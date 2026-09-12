package com.englishflow.analytics.adapter.jdbc;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.Statement;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

import com.englishflow.analytics.domain.AnalyticsQuery;
import com.englishflow.analytics.domain.MetricProjection;
import com.englishflow.analytics.domain.MetricProjectionKey;
import com.englishflow.analytics.domain.ProjectionState;
import com.englishflow.analytics.domain.TenantScope;

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

@EnabledIfSystemProperty(named = "analytics.tenant.integration", matches = "true")
class AnalyticsTenantIsolationTest {

    private static final Instant NOW = Instant.parse("2026-09-12T00:00:00Z");
    private static final LocalDate PERIOD = LocalDate.parse("2026-09-01");

    @Test
    void projectionReadsAndSchemaWritesAreTenantIsolated() throws Exception {
        String adminUrl = required("ANALYTICS_TENANT_TEST_ADMIN_URL");
        String adminUser = required("ANALYTICS_TENANT_TEST_ADMIN_USER");
        String adminPassword = required("ANALYTICS_TENANT_TEST_ADMIN_PASSWORD");
        String suffix = Long.toString(System.currentTimeMillis());
        String schema = "analytics_tenant_test_" + suffix;
        String guardSchema = "analytics_tenant_guard_" + suffix;
        String guardUser = "analytics_guard_" + suffix;
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
            JdbcAnalyticsProjectionStore store = new JdbcAnalyticsProjectionStore(jdbc, new ObjectMapper());

            TenantScope tenantA = new TenantScope("tenant-a");
            TenantScope tenantB = new TenantScope("tenant-b");
            MetricProjectionKey keyA = new MetricProjectionKey(tenantA, "metric_1", "v1", PERIOD, "dim_1");
            MetricProjectionKey keyB = new MetricProjectionKey(tenantB, "metric_1", "v1", PERIOD, "dim_1");
            store.replaceProjection(new MetricProjection(keyA, ProjectionState.READY, 3, 30, NOW, "wm_1", 1,
                    null, NOW));

            assertTrue(store.findProjection(keyA).isPresent(), "the owning tenant must read its projection");
            assertTrue(store.findProjection(keyB).isEmpty(), "another tenant must not read the projection by key");
            List<MetricProjection> scoped = store.query(new AnalyticsQuery(tenantA, List.of("metric_1"),
                    PERIOD, PERIOD, "v1"));
            assertEquals(1, scoped.size(), "the owning tenant query must return its projection");
            assertTrue(store.query(new AnalyticsQuery(tenantB, List.of("metric_1"), PERIOD, PERIOD, "v1")).isEmpty(),
                    "another tenant query must return zero rows");

            execute(adminUrl, adminUser, adminPassword, "CREATE USER IF NOT EXISTS " + quote(guardUser)
                    + "@'%' IDENTIFIED BY " + quote("analytics-guard-test"));
            execute(adminUrl, adminUser, adminPassword, "ALTER USER " + quote(guardUser)
                    + "@'%' IDENTIFIED BY " + quote("analytics-guard-test"));
            execute(adminUrl, adminUser, adminPassword, "GRANT SELECT, INSERT, UPDATE, DELETE ON " + schema + ".* TO "
                    + quote(guardUser) + "@'%'");
            DriverManagerDataSource guardDataSource = new DriverManagerDataSource(schemaUrl, guardUser,
                    "analytics-guard-test");
            JdbcTemplate guardJdbc = new JdbcTemplate(guardDataSource);
            guardJdbc.update("""
                    INSERT INTO analytics_metric_projection
                        (tenant_id, metric_id, metric_version, period_start, dimension_key, projection_state,
                         event_count, total_value, last_occurred_at, source_watermark, projection_version, error_code,
                         updated_at)
                    VALUES ('tenant-a', 'metric_2', 'v1', '2026-09-01', 'dim_2', 'READY', 1, 1, NOW(6), 'wm_2', 1,
                            NULL, NOW(6))
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
