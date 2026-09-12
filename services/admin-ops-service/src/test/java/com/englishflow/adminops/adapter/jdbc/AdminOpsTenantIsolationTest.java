package com.englishflow.adminops.adapter.jdbc;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.Statement;
import java.util.List;

import com.englishflow.adminops.domain.AdminPrincipal;
import com.englishflow.adminops.domain.Domain;
import com.englishflow.adminops.domain.ProjectionQuery;
import com.englishflow.adminops.domain.ProjectionRecord;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;

import tools.jackson.databind.ObjectMapper;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

@EnabledIfSystemProperty(named = "adminops.tenant.integration", matches = "true")
class AdminOpsTenantIsolationTest {

    @Test
    void projectionQueriesAndSchemaWritesAreTenantIsolated() throws Exception {
        String adminUrl = required("ADMINOPS_TENANT_TEST_ADMIN_URL");
        String adminUser = required("ADMINOPS_TENANT_TEST_ADMIN_USER");
        String adminPassword = required("ADMINOPS_TENANT_TEST_ADMIN_PASSWORD");
        String suffix = Long.toString(System.currentTimeMillis());
        String schema = "adminops_tenant_test_" + suffix;
        String guardSchema = "adminops_tenant_guard_" + suffix;
        String guardUser = "adminops_guard_" + suffix;
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
            JdbcAdminOpsAdapters.Projection projection = new JdbcAdminOpsAdapters.Projection(jdbc,
                    new ObjectMapper());
            jdbc.update("""
                    INSERT INTO admin_projection
                        (projection_id, domain_name, resource_ref, projection_version, redacted_payload, updated_at)
                    VALUES ('00000000-0000-0000-0000-0000000000a1', 'SUPPORT', 'res-a', 1,
                            '{"tenantId":"tenant-a","ownerSubjectId":"subject-a","status":"AVAILABLE"}', NOW(6))
                    """);
            jdbc.update("""
                    INSERT INTO admin_projection
                        (projection_id, domain_name, resource_ref, projection_version, redacted_payload, updated_at)
                    VALUES ('00000000-0000-0000-0000-0000000000b1', 'SUPPORT', 'res-b', 1,
                            '{"tenantId":"tenant-b","ownerSubjectId":"subject-b","status":"AVAILABLE"}', NOW(6))
                    """);

            List<ProjectionRecord> tenantA = projection.query(
                    AdminPrincipal.user("operator-1", "tenant-a", "admin.projection.read"),
                    new ProjectionQuery(Domain.SUPPORT, null, 10));
            assertEquals(1, tenantA.size(), "the owning tenant must see exactly its own projection");
            assertEquals("res-a", tenantA.getFirst().resourceRef());
            List<ProjectionRecord> tenantB = projection.query(
                    AdminPrincipal.user("operator-2", "tenant-b", "admin.projection.read"),
                    new ProjectionQuery(Domain.SUPPORT, null, 10));
            assertEquals(1, tenantB.size(), "the other tenant must see exactly its own projection");
            assertEquals("res-b", tenantB.getFirst().resourceRef());
            assertEquals(0, projection.query(AdminPrincipal.user("operator-3", "tenant-c", "admin.projection.read"),
                    new ProjectionQuery(Domain.SUPPORT, "res-a", 10)).size(),
                    "a foreign tenant must not read another tenant's projection by resource ref");

            execute(adminUrl, adminUser, adminPassword, "CREATE USER IF NOT EXISTS " + quote(guardUser)
                    + "@'%' IDENTIFIED BY " + quote("adminops-guard-test"));
            execute(adminUrl, adminUser, adminPassword, "ALTER USER " + quote(guardUser)
                    + "@'%' IDENTIFIED BY " + quote("adminops-guard-test"));
            execute(adminUrl, adminUser, adminPassword, "GRANT SELECT, INSERT, UPDATE, DELETE ON " + schema + ".* TO "
                    + quote(guardUser) + "@'%'");
            DriverManagerDataSource guardDataSource = new DriverManagerDataSource(schemaUrl, guardUser,
                    "adminops-guard-test");
            JdbcTemplate guardJdbc = new JdbcTemplate(guardDataSource);
            guardJdbc.update("""
                    INSERT INTO admin_projection
                        (projection_id, domain_name, resource_ref, projection_version, redacted_payload, updated_at)
                    VALUES ('00000000-0000-0000-0000-0000000000c1', 'SUPPORT', 'res-guard', 1,
                            '{"tenantId":"tenant-a","ownerSubjectId":"subject-a","status":"AVAILABLE"}', NOW(6))
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
