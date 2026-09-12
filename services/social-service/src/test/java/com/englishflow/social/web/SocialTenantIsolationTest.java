package com.englishflow.social.web;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.Statement;
import java.util.Map;
import java.util.Set;

import com.englishflow.social.domain.SocialException;
import com.englishflow.social.security.SocialAuthenticationToken;
import com.englishflow.social.security.SocialPrincipal;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.core.context.SecurityContextHolder;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

@EnabledIfSystemProperty(named = "social.tenant.integration", matches = "true")
class SocialTenantIsolationTest {

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void focusUpdatesCannotReadAnotherTenantSession() throws Exception {
        String adminUrl = required("SOCIAL_TENANT_TEST_ADMIN_URL");
        String adminUser = required("SOCIAL_TENANT_TEST_ADMIN_USER");
        String adminPassword = required("SOCIAL_TENANT_TEST_ADMIN_PASSWORD");
        String suffix = Long.toString(System.currentTimeMillis());
        String schema = "social_tenant_test_" + suffix;
        String guardSchema = "social_tenant_guard_" + suffix;
        String guardUser = "social_guard_" + suffix;
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
            SocialLocalRealController controller = new SocialLocalRealController(jdbc);
            jdbc.update("""
                    INSERT INTO soc_focus_state
                        (focus_id, tenant_id, room_id, subject_id, seat_index, lease_id, duration_minutes,
                         focus_tag_code, state, started_at)
                    VALUES ('focus-real-1', 'tenant-a', 'room-real-1', 'subject-a', 1, 'lease-real-1', 25,
                            'VOCABULARY', 'RUNNING', UTC_TIMESTAMP(3))
                    """);

            authenticate(SocialPrincipal.phaseOne("subject-a", "tenant-a", Set.of("social.focus.write")));
            Map<String, Object> ownerResult = controller.updateFocus("room-real-1",
                    Map.of("focusId", "focus-real-1", "action", "HEARTBEAT"), new MockHttpServletRequest());
            Object ownerData = ownerResult.get("data");
            Map<String, Object> ownerSession = ownerData instanceof Map<?, ?> data
                    ? castSession(data) : Map.of();
            assertEquals("RUNNING", ownerSession.get("state"), "the owner must update and read its own focus session");

            authenticate(SocialPrincipal.phaseOne("subject-b", "tenant-b", Set.of("social.focus.write")));
            SocialException denied = assertThrows(SocialException.class,
                    () -> controller.updateFocus("room-real-1",
                            Map.of("focusId", "focus-real-1", "action", "HEARTBEAT"), new MockHttpServletRequest()),
                    "another tenant must never read the focus session back");
            assertEquals("SOCIAL_FOCUS_NOT_FOUND", denied.code());

            execute(adminUrl, adminUser, adminPassword, "CREATE USER IF NOT EXISTS " + quote(guardUser)
                    + "@'%' IDENTIFIED BY " + quote("social-guard-test"));
            execute(adminUrl, adminUser, adminPassword, "ALTER USER " + quote(guardUser)
                    + "@'%' IDENTIFIED BY " + quote("social-guard-test"));
            execute(adminUrl, adminUser, adminPassword, "GRANT SELECT, INSERT, UPDATE, DELETE ON " + schema + ".* TO "
                    + quote(guardUser) + "@'%'");
            DriverManagerDataSource guardDataSource = new DriverManagerDataSource(schemaUrl, guardUser,
                    "social-guard-test");
            JdbcTemplate guardJdbc = new JdbcTemplate(guardDataSource);
            guardJdbc.update("""
                    INSERT INTO soc_focus_state
                        (focus_id, tenant_id, room_id, subject_id, seat_index, lease_id, duration_minutes,
                         focus_tag_code, state, started_at)
                    VALUES ('focus-guard-1', 'tenant-a', 'room-real-1', 'subject-c', 2, 'lease-guard-1', 25,
                            'VOCABULARY', 'RUNNING', UTC_TIMESTAMP(3))
                    """);
            assertThrows(DataAccessException.class, () -> guardJdbc.update("INSERT INTO " + guardSchema
                    + ".guard_marker (id) VALUES (1)"), "a schema-scoped credential must not write another schema");
            assertTrue(guardJdbc.queryForObject("SELECT COUNT(*) FROM soc_focus_state", Integer.class) >= 1,
                    "the schema-scoped credential must read its own schema");
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

    private static void authenticate(SocialPrincipal principal) {
        SecurityContextHolder.getContext().setAuthentication(SocialAuthenticationToken.fromVerifiedPrincipal(principal));
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> castSession(Map<?, ?> data) {
        Object session = data.get("session");
        return session instanceof Map<?, ?> map ? (Map<String, Object>) map : Map.of();
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
