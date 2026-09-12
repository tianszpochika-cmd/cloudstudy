package com.englishflow.commerce.adapter.jdbc;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.Statement;
import java.time.Instant;

import com.englishflow.commerce.CommerceTestFixtures;
import com.englishflow.commerce.application.security.CommerceAccessPolicy;
import com.englishflow.commerce.domain.CommerceException;
import com.englishflow.commerce.domain.Sku;
import com.englishflow.commerce.domain.SkuStatus;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

@EnabledIfSystemProperty(named = "commerce.tenant.integration", matches = "true")
class CommerceTenantIsolationTest {

    private static final Instant NOW = Instant.parse("2026-09-12T00:00:00Z");

    @Test
    void crossTenantReadsAndSchemaWritesAreIsolated() throws Exception {
        String adminUrl = required("COMMERCE_TENANT_TEST_ADMIN_URL");
        String adminUser = required("COMMERCE_TENANT_TEST_ADMIN_USER");
        String adminPassword = required("COMMERCE_TENANT_TEST_ADMIN_PASSWORD");
        String suffix = Long.toString(System.currentTimeMillis());
        String schema = "commerce_tenant_test_" + suffix;
        String guardSchema = "commerce_tenant_guard_" + suffix;
        String guardUser = "commerce_guard_" + suffix;
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
            JdbcCommerceStore store = new JdbcCommerceStore(jdbc);

            store.saveSku(new Sku(CommerceTestFixtures.TENANT_A, "sku-tenant-real", 1, "Title", "CODE", "CNY",
                    9900, SkuStatus.ACTIVE, NOW));
            assertTrue(store.findSku(CommerceTestFixtures.TENANT_A, "sku-tenant-real").isPresent(),
                    "the owning tenant must read its own sku");
            assertTrue(store.findSku(CommerceTestFixtures.TENANT_B, "sku-tenant-real").isEmpty(),
                    "another tenant must not read the sku");
            assertTrue(store.listSkus(CommerceTestFixtures.TENANT_B).isEmpty(),
                    "another tenant must list zero skus");

            CommerceAccessPolicy policy = new CommerceAccessPolicy();
            CommerceException denied = assertThrows(CommerceException.class,
                    () -> policy.requireOwner(CommerceTestFixtures.user(), CommerceTestFixtures.TENANT_B, "user-1"),
                    "a cross-tenant owner check must be denied");
            assertEquals("RESOURCE_NOT_FOUND", denied.code());

            execute(adminUrl, adminUser, adminPassword, "CREATE USER IF NOT EXISTS " + quote(guardUser)
                    + "@'%' IDENTIFIED BY " + quote("commerce-guard-test"));
            execute(adminUrl, adminUser, adminPassword, "ALTER USER " + quote(guardUser)
                    + "@'%' IDENTIFIED BY " + quote("commerce-guard-test"));
            execute(adminUrl, adminUser, adminPassword, "GRANT SELECT, INSERT, UPDATE, DELETE ON " + schema + ".* TO "
                    + quote(guardUser) + "@'%'");
            DriverManagerDataSource guardDataSource = new DriverManagerDataSource(schemaUrl, guardUser,
                    "commerce-guard-test");
            JdbcTemplate guardJdbc = new JdbcTemplate(guardDataSource);
            guardJdbc.update("""
                    INSERT INTO commerce_sku
                        (tenant_id, sku_id, version, title, entitlement_code, currency, amount_minor, status,
                         effective_from, created_at)
                    VALUES ('tenant-a', 'sku-guard', 1, 'Guard', 'CODE', 'CNY', 9900, 'ACTIVE', NOW(6), NOW(6))
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
