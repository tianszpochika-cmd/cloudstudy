package com.englishflow.social.web;

import com.englishflow.social.domain.SocialException;
import com.englishflow.social.security.SocialAuthenticationToken;
import com.englishflow.social.security.SocialPrincipal;
import jakarta.servlet.http.HttpServletRequest;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.Statement;
import java.time.Duration;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.aop.framework.ProxyFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.transaction.annotation.AnnotationTransactionAttributeSource;
import org.springframework.transaction.interceptor.TransactionInterceptor;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Opt-in owner-schema verification. It only creates and drops a random temporary schema; it never
 * writes the configured database's existing business schemas.
 */
@EnabledIfSystemProperty(named = "social.report.mysql.integration", matches = "true")
class SocialLocalRealReportMySqlTest {

    private static final String TENANT = "tenant-report-it";
    private static final String ROOM = "room-report-it";
    private static final String REPORTER = "subject-report-it";

    @Test
    void transactionalReportReceiptReplayConflictAndMissingOwnerFact() throws Exception {
        try (TemporarySchema schema = TemporarySchema.create()) {
            JdbcTemplate jdbc = schema.jdbc();
            seedRoom(jdbc);
            SocialLocalRealController controller = transactionalController(jdbc, schema.dataSource());

            Map<String, Object> first = callReport(controller, "report-key-mysql-0001", 2, "SPAM");
            Map<String, Object> firstReceipt = receipt(first);
            String reportId = String.valueOf(firstReceipt.get("reportId"));
            assertEquals(ROOM, firstReceipt.get("roomId"));
            assertEquals(2, firstReceipt.get("targetSeatIndex"));
            assertEquals("SPAM", firstReceipt.get("reasonCode"));
            assertEquals("RECEIVED", firstReceipt.get("status"));
            assertEquals("MANUAL", firstReceipt.get("reviewMode"));
            assertEquals("report-key-mysql-0001", firstReceipt.get("clientEventId"));
            assertEquals(false, firstReceipt.get("idempotentReplay"));
            assertTrue(firstReceipt.get("createdAt") instanceof String);
            assertTrue(firstReceipt.get("updatedAt") instanceof String);
            assertEquals(1, jdbc.queryForObject("SELECT COUNT(*) FROM soc_report WHERE tenant_id = ?",
                    Integer.class, TENANT));
            assertEquals(1, jdbc.queryForObject("SELECT COUNT(*) FROM soc_idempotency_record WHERE tenant_id = ?",
                    Integer.class, TENANT));

            Map<String, Object> replay = callReport(controller, "report-key-mysql-0001", 2, "SPAM");
            assertEquals(reportId, receipt(replay).get("reportId"));
            assertEquals("report-key-mysql-0001", receipt(replay).get("clientEventId"));
            assertEquals(true, receipt(replay).get("idempotentReplay"));

            SocialException reusedKey = assertThrows(SocialException.class,
                    () -> callReport(controller, "report-key-mysql-0001", 2, "HARASSMENT"));
            assertEquals(409, reusedKey.status());
            assertEquals("IDEMPOTENCY_KEY_REUSED", reusedKey.code());
            assertEquals(1, jdbc.queryForObject("SELECT COUNT(*) FROM soc_report WHERE tenant_id = ?",
                    Integer.class, TENANT));

            assertEquals(1, jdbc.update("DELETE FROM soc_report WHERE tenant_id = ? AND report_id = ?",
                    TENANT, reportId));
            SocialException missingFact = assertThrows(SocialException.class,
                    () -> callReport(controller, "report-key-mysql-0001", 2, "SPAM"));
            assertEquals(503, missingFact.status());
            assertEquals("SOC_REPORT_RECEIPT_UNAVAILABLE", missingFact.code());
            assertEquals(0, jdbc.queryForObject("SELECT COUNT(*) FROM soc_report WHERE tenant_id = ?",
                    Integer.class, TENANT));
        }
    }

    @Test
    void uniqueConstraintRaceReadsAndReplaysTheCommittedDatabaseFact() throws Exception {
        try (TemporarySchema schema = TemporarySchema.create()) {
            JdbcTemplate jdbc = schema.jdbc();
            seedRoom(jdbc);
            SocialLocalRealController controller = transactionalController(jdbc, schema.dataSource());
            String key = "report-key-mysql-race-0001";

            try (Connection membershipLock = DriverManager.getConnection(
                    schema.url(), schema.username(), schema.password())) {
                membershipLock.setAutoCommit(false);
                try (PreparedStatement lock = membershipLock.prepareStatement(
                        "SELECT id FROM soc_room_member WHERE tenant_id = ? AND room_id = ? "
                                + "AND subject_id = ? FOR UPDATE")) {
                    lock.setString(1, TENANT);
                    lock.setString(2, ROOM);
                    lock.setString(3, REPORTER);
                    try (ResultSet ignored = lock.executeQuery()) {
                        assertTrue(ignored.next());
                    }
                }

                ExecutorService executor = Executors.newSingleThreadExecutor();
                Future<Map<String, Object>> pending;
                try {
                    pending = executor.submit(() -> callReport(controller, key, 2, "SPAM"));
                    awaitBlockedMembershipRead(schema);
                    assertEquals(0, jdbc.queryForObject("SELECT COUNT(*) FROM soc_idempotency_record "
                                    + "WHERE tenant_id = ? AND subject_id = ? AND operation_scope = ?",
                            Integer.class, TENANT, REPORTER, "social.report:" + ROOM),
                            "the reservation must remain uncommitted while the proxied report call is in flight");
                    jdbc.update("INSERT INTO soc_report(report_id, tenant_id, room_id, reporter_subject_id, "
                                    + "target_subject_id, target_seat_index, reason_code, state, client_event_id, "
                                    + "created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'RECEIVED', ?, "
                                    + "UTC_TIMESTAMP(3), UTC_TIMESTAMP(3))",
                            "report-mysql-race-winner", TENANT, ROOM, REPORTER, "subject-target-it", 2,
                            "SPAM", "report-event-original-0001");
                    membershipLock.commit();
                    Map<String, Object> replay = pending.get(10, TimeUnit.SECONDS);
                    Map<String, Object> receipt = receipt(replay);
                    assertEquals("report-mysql-race-winner", receipt.get("reportId"));
                    assertEquals("report-event-original-0001", receipt.get("clientEventId"));
                    assertEquals(true, receipt.get("idempotentReplay"));
                    assertEquals(1, jdbc.queryForObject("SELECT COUNT(*) FROM soc_report WHERE tenant_id = ?",
                            Integer.class, TENANT));
                    assertEquals(1, jdbc.queryForObject(
                            "SELECT COUNT(*) FROM soc_idempotency_record WHERE tenant_id = ?",
                            Integer.class, TENANT));
                } finally {
                    membershipLock.rollback();
                    executor.shutdownNow();
                    executor.awaitTermination(5, TimeUnit.SECONDS);
                }
            }
        } finally {
            SecurityContextHolder.clearContext();
        }
    }

    private static SocialLocalRealController transactionalController(JdbcTemplate jdbc,
            DriverManagerDataSource dataSource) {
        SocialLocalRealController target = new SocialLocalRealController(jdbc);
        ProxyFactory proxyFactory = new ProxyFactory(target);
        proxyFactory.setProxyTargetClass(true);
        proxyFactory.addAdvice(new TransactionInterceptor(new DataSourceTransactionManager(dataSource),
                new AnnotationTransactionAttributeSource()));
        Object proxy = proxyFactory.getProxy(SocialLocalRealController.class.getClassLoader());
        assertNotSame(target, proxy, "test calls must pass through the real Spring transaction interceptor");
        return (SocialLocalRealController) proxy;
    }

    private static void seedRoom(JdbcTemplate jdbc) {
        jdbc.update("INSERT INTO soc_study_room(room_id, tenant_id, owner_subject, theme_code, display_name_key, "
                        + "capacity, state) VALUES (?, ?, ?, 'FOCUS', 'social.report.test', 20, 'OPEN')",
                ROOM, TENANT, REPORTER);
        jdbc.update("INSERT INTO soc_room_member(membership_id, room_id, tenant_id, subject_id, state, "
                        + "presence_state, room_visibility, privacy_version, joined_at, last_activity_at) "
                        + "VALUES (?, ?, ?, ?, 'ACTIVE', 'ONLINE', 'PUBLIC', 1, UTC_TIMESTAMP(3), UTC_TIMESTAMP(3)), "
                        + "(?, ?, ?, ?, 'ACTIVE', 'ONLINE', 'PUBLIC', 1, UTC_TIMESTAMP(3), UTC_TIMESTAMP(3))",
                "member-report-it", ROOM, TENANT, REPORTER,
                "member-target-it", ROOM, TENANT, "subject-target-it");
        jdbc.update("INSERT INTO soc_seat_lease(room_id, tenant_id, seat_index, subject_id, state, lease_id, "
                        + "lease_version, lease_expires_at, last_activity_at) "
                        + "VALUES (?, ?, 1, ?, 'OCCUPIED', ?, 1, DATE_ADD(UTC_TIMESTAMP(3), INTERVAL 10 MINUTE), UTC_TIMESTAMP(3)), "
                        + "(?, ?, 2, ?, 'OCCUPIED', ?, 1, DATE_ADD(UTC_TIMESTAMP(3), INTERVAL 10 MINUTE), UTC_TIMESTAMP(3))",
                ROOM, TENANT, REPORTER, "lease-report-it-1", ROOM, TENANT,
                "subject-target-it", "lease-report-it-2");
    }

    private static void awaitBlockedMembershipRead(TemporarySchema schema) throws Exception {
        long deadline = System.nanoTime() + Duration.ofSeconds(8).toNanos();
        while (System.nanoTime() < deadline) {
            try (Connection connection = DriverManager.getConnection(schema.url(), schema.username(), schema.password());
                 PreparedStatement statement = connection.prepareStatement(
                         "SELECT COUNT(*) FROM information_schema.PROCESSLIST WHERE DB = ? "
                                 + "AND ID <> CONNECTION_ID() AND INFO LIKE '%soc_room_member m%'")) {
                statement.setString(1, schema.name());
                try (ResultSet results = statement.executeQuery()) {
                    if (results.next() && results.getInt(1) > 0) return;
                }
            }
            Thread.sleep(40);
        }
        throw new AssertionError("report request did not reach the locked membership read");
    }

    private static Map<String, Object> callReport(SocialLocalRealController controller, String key,
            int seat, String reason) {
        SecurityContextHolder.getContext().setAuthentication(SocialAuthenticationToken.fromVerifiedPrincipal(
                SocialPrincipal.phaseOne(REPORTER, TENANT, Set.of("social.report.create.self"))));
        try {
            return controller.report(ROOM, Map.of("targetSeatIndex", seat, "reasonCode", reason,
                    "clientEventId", key), key, new MockHttpServletRequest());
        } finally {
            SecurityContextHolder.clearContext();
        }
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> receipt(Map<String, Object> envelope) {
        return (Map<String, Object>) ((Map<String, Object>) envelope.get("data")).get("report");
    }

    private static String required(String key) {
        String value = System.getenv(key);
        if (value == null || value.isBlank()) value = System.getProperty(key);
        if (value == null || value.isBlank()) throw new AssertionError(key + " is required for opt-in MySQL tests");
        return value;
    }

    private static final class TemporarySchema implements AutoCloseable {
        private static final String ADMIN_URL = "SOCIAL_REPORT_TEST_ADMIN_URL";
        private static final String ADMIN_USER = "SOCIAL_REPORT_TEST_ADMIN_USER";
        private static final String ADMIN_PASSWORD = "SOCIAL_REPORT_TEST_ADMIN_PASSWORD";

        private final String name;
        private final String adminUrl;
        private final String username;
        private final String password;
        private final String url;
        private final DriverManagerDataSource dataSource;
        private final JdbcTemplate jdbc;

        private TemporarySchema(String name, String adminUrl, String username, String password,
                String url, DriverManagerDataSource dataSource) {
            this.name = name;
            this.adminUrl = adminUrl;
            this.username = username;
            this.password = password;
            this.url = url;
            this.dataSource = dataSource;
            this.jdbc = new JdbcTemplate(dataSource);
        }

        static TemporarySchema create() throws Exception {
            String adminUrl = required(ADMIN_URL);
            String username = required(ADMIN_USER);
            String password = required(ADMIN_PASSWORD);
            String name = "social_report_it_" + UUID.randomUUID().toString().replace("-", "").substring(0, 16);
            if (!name.matches("social_report_it_[a-f0-9]{16}")) {
                throw new IllegalStateException("generated schema name failed its safety check");
            }
            String quoted = "`" + name + "`";
            execute(adminUrl, username, password,
                    "CREATE DATABASE " + quoted + " CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
            try {
                DriverManagerDataSource adminDataSource = new DriverManagerDataSource(adminUrl, username, password);
                Flyway.configure().dataSource(adminDataSource).schemas(name).defaultSchema(name)
                        .createSchemas(false).locations("classpath:db/migration").load().migrate();
                String schemaUrl = databaseUrl(adminUrl, name);
                DriverManagerDataSource schemaDataSource = new DriverManagerDataSource(schemaUrl, username, password);
                return new TemporarySchema(name, adminUrl, username, password, schemaUrl, schemaDataSource);
            } catch (Exception failure) {
                execute(adminUrl, username, password, "DROP DATABASE IF EXISTS " + quoted);
                throw failure;
            }
        }

        String name() { return name; }
        String url() { return url; }
        String username() { return username; }
        String password() { return password; }
        DriverManagerDataSource dataSource() { return dataSource; }
        JdbcTemplate jdbc() { return jdbc; }

        @Override
        public void close() throws Exception {
            if (!name.matches("social_report_it_[a-f0-9]{16}")) {
                throw new IllegalStateException("refusing to drop an unrecognized schema name");
            }
            execute(adminUrl, username, password, "DROP DATABASE IF EXISTS `" + name + "`");
        }
    }

    private static String databaseUrl(String url, String schema) {
        int queryAt = url.indexOf('?');
        String options = queryAt < 0 ? "" : url.substring(queryAt);
        String base = queryAt < 0 ? url : url.substring(0, queryAt);
        int schemeAt = base.indexOf("://");
        if (schemeAt < 0) throw new IllegalArgumentException("unsupported MySQL JDBC URL form");
        int pathAt = base.indexOf('/', schemeAt + 3);
        String authority = pathAt < 0 ? base : base.substring(0, pathAt);
        return authority + "/" + schema + options;
    }

    private static void execute(String url, String user, String password, String sql) throws Exception {
        try (Connection connection = DriverManager.getConnection(url, user, password);
             Statement statement = connection.createStatement()) {
            statement.execute(sql);
        }
    }
}
