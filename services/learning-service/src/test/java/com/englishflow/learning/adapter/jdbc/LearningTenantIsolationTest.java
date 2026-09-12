package com.englishflow.learning.adapter.jdbc;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.Statement;
import java.time.Instant;

import javax.sql.DataSource;

import com.englishflow.learning.domain.IdempotencyKey;
import com.englishflow.learning.domain.LearningDecisionCode;
import com.englishflow.learning.domain.LearningDomainException;
import com.englishflow.learning.domain.LearningProgress;
import com.englishflow.learning.domain.LearningTenantScope;
import com.englishflow.learning.domain.PlanningKey;
import com.englishflow.learning.port.IdempotentExecution;

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
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

@EnabledIfSystemProperty(named = "learning.tenant.integration", matches = "true")
class LearningTenantIsolationTest {

    private static final LearningTenantScope SCOPE_A =
            new LearningTenantScope("tenant-a", "prn_tenant-a-0000001", 11L);
    private static final LearningTenantScope SCOPE_B =
            new LearningTenantScope("tenant-b", "prn_tenant-b-0000001", 22L);

    @Test
    void crossTenantReadsAndSchemaWritesAreRejected() throws Exception {
        String adminUrl = required("LEARNING_TENANT_TEST_ADMIN_URL");
        String adminUser = required("LEARNING_TENANT_TEST_ADMIN_USER");
        String adminPassword = required("LEARNING_TENANT_TEST_ADMIN_PASSWORD");
        String suffix = Long.toString(System.currentTimeMillis());
        String schema = "learning_tenant_test_" + suffix;
        String guardSchema = "learning_tenant_guard_" + suffix;
        String guardUser = "learning_guard_" + suffix;
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
            JdbcLearningFactStore store = new JdbcLearningFactStore(jdbc,
                    new TransactionTemplate(new DataSourceTransactionManager(schemaDataSource)), new ObjectMapper());

            jdbc.update("""
                    INSERT INTO learning_runtime_plan
                        (plan_id, tenant_id, principal_id, user_id, target_id, goal_code, content_version_id,
                         content_epoch, time_zone_id, daily_quota_minutes, status, plan_version, created_at, updated_at)
                    VALUES (101, ?, ?, ?, 501, 'goal.alpha', 7, 1, 'Asia/Shanghai', 30, 'ACTIVE', 1, NOW(6), NOW(6))
                    """, SCOPE_A.tenantId(), SCOPE_A.principalId(), SCOPE_A.userId());
            PlanningKey keyA = new PlanningKey(SCOPE_A, 501L, 7L, 1L);
            PlanningKey keyB = new PlanningKey(SCOPE_B, 501L, 7L, 1L);

            assertTrue(store.findPlanById(SCOPE_A, 101L).isPresent(), "owner must read its own plan");
            assertTrue(store.findPlan(SCOPE_A, keyA).isPresent(), "owner must read its own planning key");
            assertTrue(store.findPlanById(SCOPE_B, 101L).isEmpty(), "cross-tenant plan read must return zero rows");
            assertTrue(store.findPlan(SCOPE_B, keyB).isEmpty(), "cross-tenant planning key read must return zero rows");
            LearningDomainException mismatch = assertThrows(LearningDomainException.class,
                    () -> store.findPlan(SCOPE_B, keyA), "a key owned by another tenant must be denied");
            assertEquals(LearningDecisionCode.OWNER_MISMATCH, mismatch.code());

            LearningProgress progressA = new LearningProgress(SCOPE_A, 101L, 201L, 1, 2, 60L, 1L, Instant.now());
            LearningProgress progressB = new LearningProgress(SCOPE_B, 101L, 201L, 1, 2, 60L, 1L, Instant.now());
            IdempotentExecution<LearningProgress> first = store.executeIdempotently(SCOPE_A, "progress.record",
                    new IdempotencyKey("idem-key-000000001"), "fingerprint", () -> progressA);
            assertFalse(first.replayed(), "first idempotent execution must not be a replay");
            IdempotentExecution<LearningProgress> replay = store.executeIdempotently(SCOPE_A, "progress.record",
                    new IdempotencyKey("idem-key-000000001"), "fingerprint", () -> progressB);
            assertTrue(replay.replayed(), "same tenant and key must replay the stored response");
            assertEquals(SCOPE_A, replay.value().scope());
            IdempotentExecution<LearningProgress> otherTenant = store.executeIdempotently(SCOPE_B, "progress.record",
                    new IdempotencyKey("idem-key-000000001"), "fingerprint", () -> progressB);
            assertFalse(otherTenant.replayed(), "another tenant must not see tenant-a idempotency facts");
            assertEquals(SCOPE_B, otherTenant.value().scope());

            execute(adminUrl, adminUser, adminPassword, "CREATE USER IF NOT EXISTS " + quote(guardUser)
                    + "@'%' IDENTIFIED BY " + quote("learning-guard-test"));
            execute(adminUrl, adminUser, adminPassword, "ALTER USER " + quote(guardUser)
                    + "@'%' IDENTIFIED BY " + quote("learning-guard-test"));
            execute(adminUrl, adminUser, adminPassword, "GRANT SELECT, INSERT, UPDATE, DELETE ON " + schema + ".* TO "
                    + quote(guardUser) + "@'%'");
            DriverManagerDataSource guardDataSource = new DriverManagerDataSource(schemaUrl, guardUser,
                    "learning-guard-test");
            JdbcTemplate guardJdbc = new JdbcTemplate(guardDataSource);
            guardJdbc.update("""
                    INSERT INTO learning_runtime_plan
                        (plan_id, tenant_id, principal_id, user_id, target_id, goal_code, content_version_id,
                         content_epoch, time_zone_id, daily_quota_minutes, status, plan_version, created_at, updated_at)
                    VALUES (102, ?, ?, ?, 502, 'goal.alpha', 7, 1, 'Asia/Shanghai', 30, 'ACTIVE', 1, NOW(6), NOW(6))
                    """, "tenant-c", "principal-c", 33L);
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
