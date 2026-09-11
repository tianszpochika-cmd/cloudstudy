package com.englishflow.iam;

import com.englishflow.iam.config.IamRuntimeConfiguration;
import com.englishflow.iam.config.IamServiceProperties;
import com.englishflow.iam.domain.IamDecisionCode;
import com.englishflow.iam.domain.IamPolicyException;
import com.englishflow.iam.domain.IamTransactionRunner;
import com.englishflow.iam.domain.IdempotencyRecord;
import com.englishflow.iam.domain.IdempotencyService;
import com.englishflow.iam.domain.JdbcIdempotencyStore;
import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.MigrationVersion;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.core.io.ClassPathResource;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;

import javax.sql.DataSource;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;
import java.util.Objects;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Opt-in MySQL 8.4 proof for the one-way V13 cutover. The test refuses the runtime IAM schema and
 * cleans only an explicitly provisioned {@code iam_v13_test_*} schema.
 */
@EnabledIfSystemProperty(named = "iam.jdbc.migration.integration", matches = "true")
class IdempotencyV13MigrationSecurityTest {
    private static final String ZERO = "00".repeat(32);
    private static final String REPLAY_KEY = "v13-migration-replay-key-material-2026";
    private static final String FINGERPRINT_KEY = "v13-migration-fingerprint-key-material-2026";
    private static final String STRONG_CHECK_CLAUSE = """
            (request_fingerprint_version = 'legacy-invalidated-v0'
              AND request_fingerprint = 0x0000000000000000000000000000000000000000000000000000000000000000
              AND replay_ciphertext IS NULL AND replay_nonce IS NULL AND replay_key_version IS NULL)
            OR
            (request_fingerprint_version = 'hmac-sha256-v1'
              AND request_fingerprint <> 0x0000000000000000000000000000000000000000000000000000000000000000
              AND ((replay_ciphertext IS NULL AND replay_nonce IS NULL AND replay_key_version IS NULL)
                OR (replay_ciphertext IS NOT NULL AND replay_nonce IS NOT NULL
                  AND replay_key_version IS NOT NULL)))
            """;

    @Test
    void populatedV12UpgradesAtomicallyAndFailsClosedAcrossWriterAndHistoryEdges() throws Exception {
        String jdbcUrl = requiredEnvironment("IAM_V13_TEST_JDBC_URL");
        String username = requiredEnvironment("IAM_V13_TEST_JDBC_USERNAME");
        String password = requiredEnvironmentAllowEmpty("IAM_V13_TEST_JDBC_PASSWORD");
        String schema = requiredEnvironment("IAM_V13_TEST_SCHEMA");
        assertTrue(schema.matches("iam_v13_test_[a-z0-9_]{1,40}"),
                "migration tests require an isolated iam_v13_test_* schema");
        assertTrue(!"iam_service".equals(schema) && schema.equals(databaseName(jdbcUrl)),
                "the dedicated JDBC URL must select exactly the isolated test schema");

        DataSource dataSource = dataSource(jdbcUrl, username, password);
        JdbcTemplate jdbc = new JdbcTemplate(dataSource);
        Flyway setup = flyway(dataSource, schema, MigrationVersion.fromVersion("12"));
        try {
            setup.clean();
            setup.migrate();
            insertLegacyRows(jdbc);

            IamRuntimeConfiguration configuration = new IamRuntimeConfiguration();
            IamServiceProperties properties = migrationProperties(schema, jdbcUrl, false);
            IllegalStateException notDrained = assertThrows(IllegalStateException.class,
                    () -> configuration.iamFlyway(dataSource, properties));
            assertTrue(notDrained.getMessage().contains("drain every old writer"));
            assertEquals(1, count(jdbc, "SELECT COUNT(*) FROM iam_idempotency_record "
                    + "WHERE idempotency_key = 'legacy-populated-key' AND request_hash IS NOT NULL"));

            properties.getIdempotency().setV13WritersDrained(true);
            configuration.iamFlyway(dataSource, properties);
            assertEquals(1, count(jdbc, "SELECT COUNT(*) FROM flyway_schema_history "
                    + "WHERE version = '13' AND success = 1"));
            assertEquals(0, count(jdbc, "SELECT COUNT(*) FROM information_schema.columns "
                    + "WHERE table_schema = DATABASE() AND table_name = 'iam_idempotency_record' "
                    + "AND column_name IN ('request_hash','request_hash_version','response_ciphertext',"
                    + "'response_nonce','response_key_version')"));
            assertEquals(5, count(jdbc, "SELECT COUNT(*) FROM information_schema.columns "
                    + "WHERE table_schema = DATABASE() AND table_name = 'iam_idempotency_record' "
                    + "AND column_name IN ('request_fingerprint','request_fingerprint_version',"
                    + "'replay_ciphertext','replay_nonce','replay_key_version')"));
            assertEquals(1, count(jdbc, "SELECT COUNT(*) FROM iam_idempotency_record "
                    + "WHERE idempotency_key = 'legacy-populated-key' "
                    + "AND HEX(request_fingerprint) = '" + ZERO + "' "
                    + "AND request_fingerprint_version = 'legacy-invalidated-v0' "
                    + "AND replay_ciphertext IS NULL AND replay_nonce IS NULL "
                    + "AND replay_key_version IS NULL"));

            assertStrongCheckRejectsInvalidTuples(jdbc);
            assertThrows(DataAccessException.class, () -> jdbc.update(
                    "INSERT INTO iam_idempotency_record "
                            + "(scope_key,idempotency_key,request_hash,state) "
                            + "VALUES ('old-writer','old-writer-key',UNHEX(?),'IN_PROGRESS')", ZERO));

            JdbcIdempotencyStore store = new JdbcIdempotencyStore(jdbc);
            IdempotencyService idempotency = new IdempotencyService(store,
                    configuration.iamObjectMapper(), IamTransactionRunner.direct(),
                    REPLAY_KEY, FINGERPRINT_KEY, Duration.ofHours(24));
            String current = idempotency.fingerprint("current-request");
            IamPolicyException legacyConflict = assertThrows(IamPolicyException.class,
                    () -> store.claim("migration", "legacy-populated-key", current));
            assertEquals(IamDecisionCode.IDEMPOTENCY_KEY_REUSED, legacyConflict.code());

            assertCurrentVersionCasAndConcurrentWriter(store, idempotency, jdbc);

            replaceFingerprintCheck(jdbc, "(" + STRONG_CHECK_CLAUSE + ") "
                    + "OR request_fingerprint_version = 'hmac-sha256-v1'");
            IllegalStateException weakenedCheck = assertThrows(IllegalStateException.class,
                    () -> configuration.iamFlyway(dataSource, properties));
            assertTrue(weakenedCheck.getMessage().contains("column/default/CHECK drift"));
            replaceFingerprintCheck(jdbc, STRONG_CHECK_CLAUSE);
            configuration.iamFlyway(dataSource, properties);

            jdbc.execute("ALTER TABLE iam_idempotency_record MODIFY COLUMN replay_nonce VARBINARY(12) NULL");
            IllegalStateException schemaDrift = assertThrows(IllegalStateException.class,
                    () -> configuration.iamFlyway(dataSource, properties));
            assertTrue(schemaDrift.getMessage().contains("column/default/CHECK drift"));

            setup.clean();
            setup.migrate();
            insertLegacyRows(jdbc);
            String v13 = new ClassPathResource(
                    "db/migration/V13__key_and_version_idempotency_request_hashes.sql")
                    .getContentAsString(StandardCharsets.UTF_8);
            String forcedFailure = v13.replaceFirst(";\\s*$", "")
                    + ", ADD COLUMN request_fingerprint BINARY(32);";
            assertThrows(DataAccessException.class, () -> jdbc.execute(forcedFailure));
            assertEquals(1, count(jdbc, "SELECT COUNT(*) FROM iam_idempotency_record "
                    + "WHERE idempotency_key = 'legacy-populated-key' "
                    + "AND OCTET_LENGTH(request_hash) = 32 AND response_ciphertext IS NOT NULL"));
            assertEquals(0, count(jdbc, "SELECT COUNT(*) FROM information_schema.columns "
                    + "WHERE table_schema = DATABASE() AND table_name = 'iam_idempotency_record' "
                    + "AND column_name = 'request_fingerprint'"));

            jdbc.execute(v13);
            IllegalStateException historyWindow = assertThrows(IllegalStateException.class,
                    () -> configuration.iamFlyway(dataSource, properties));
            assertTrue(historyWindow.getMessage().contains("Flyway history is pending"));
        } finally {
            setup.clean();
        }
    }

    private static void assertCurrentVersionCasAndConcurrentWriter(JdbcIdempotencyStore store,
                                                                    IdempotencyService idempotency,
                                                                    JdbcTemplate jdbc) throws Exception {
        String completeHash = idempotency.fingerprint("complete-cas");
        store.claim("migration-current", "complete-cas-key", completeHash);
        store.complete("migration-current", "complete-cas-key", completeHash, 200, "result", null);
        assertEquals("hmac-sha256-v1", jdbc.queryForObject(
                "SELECT request_fingerprint_version FROM iam_idempotency_record "
                        + "WHERE scope_key = 'migration-current' AND idempotency_key = 'complete-cas-key'",
                String.class));

        String staleHash = idempotency.fingerprint("stale-version-cas");
        store.claim("migration-current", "stale-version-key", staleHash);
        jdbc.update("UPDATE iam_idempotency_record SET request_fingerprint = UNHEX(?), "
                        + "request_fingerprint_version = 'legacy-invalidated-v0' "
                        + "WHERE scope_key = 'migration-current' AND idempotency_key = 'stale-version-key'",
                ZERO);
        IamPolicyException stale = assertThrows(IamPolicyException.class, () ->
                store.complete("migration-current", "stale-version-key", staleHash, 200, "bad", null));
        assertEquals(IamDecisionCode.IDEMPOTENCY_KEY_REUSED, stale.code());
        assertEquals("IN_PROGRESS", jdbc.queryForObject(
                "SELECT state FROM iam_idempotency_record WHERE scope_key = 'migration-current' "
                        + "AND idempotency_key = 'stale-version-key'", String.class));

        String firstHash = idempotency.fingerprint("concurrent-first");
        String secondHash = idempotency.fingerprint("concurrent-second");
        CountDownLatch start = new CountDownLatch(1);
        ExecutorService pool = Executors.newFixedThreadPool(2);
        try {
            Future<Object> first = pool.submit(() -> claimAfter(start, store, firstHash));
            Future<Object> second = pool.submit(() -> claimAfter(start, store, secondHash));
            start.countDown();
            List<Object> outcomes = List.of(first.get(), second.get());
            assertEquals(1, outcomes.stream().filter(IdempotencyRecord.class::isInstance).count());
            Object rejected = outcomes.stream().filter(value -> value instanceof IamDecisionCode)
                    .findFirst().orElseThrow();
            assertEquals(IamDecisionCode.IDEMPOTENCY_KEY_REUSED, rejected);
            assertEquals(1, count(jdbc, "SELECT COUNT(*) FROM iam_idempotency_record "
                    + "WHERE scope_key = 'migration-concurrent' "
                    + "AND idempotency_key = 'concurrent-writer-key' "
                    + "AND request_fingerprint_version = 'hmac-sha256-v1'"));
        } finally {
            pool.shutdownNow();
        }
    }

    private static Object claimAfter(CountDownLatch start, JdbcIdempotencyStore store,
                                     String fingerprint) throws InterruptedException {
        start.await();
        try {
            return store.claim("migration-concurrent", "concurrent-writer-key", fingerprint);
        } catch (IamPolicyException exception) {
            return exception.code();
        }
    }

    private static void assertStrongCheckRejectsInvalidTuples(JdbcTemplate jdbc) {
        String nonZero = "11".repeat(32);
        assertThrows(DataAccessException.class, () -> jdbc.update(
                "INSERT INTO iam_idempotency_record "
                        + "(scope_key,idempotency_key,request_fingerprint,request_fingerprint_version,state) "
                        + "VALUES ('constraint','legacy-nonzero',UNHEX(?),'legacy-invalidated-v0','IN_PROGRESS')",
                nonZero));
        assertThrows(DataAccessException.class, () -> jdbc.update(
                "INSERT INTO iam_idempotency_record "
                        + "(scope_key,idempotency_key,request_fingerprint,request_fingerprint_version,state) "
                        + "VALUES ('constraint','current-zero',UNHEX(?),'hmac-sha256-v1','IN_PROGRESS')",
                ZERO));
        assertThrows(DataAccessException.class, () -> jdbc.update(
                "INSERT INTO iam_idempotency_record "
                        + "(scope_key,idempotency_key,request_fingerprint,request_fingerprint_version,state,"
                        + "replay_ciphertext,replay_nonce,replay_key_version) "
                        + "VALUES ('constraint','legacy-replay',UNHEX(?),'legacy-invalidated-v0','IN_PROGRESS',"
                        + "X'01',UNHEX('000000000000000000000000'),'v1')", ZERO));
        assertThrows(DataAccessException.class, () -> jdbc.update(
                "INSERT INTO iam_idempotency_record "
                        + "(scope_key,idempotency_key,request_fingerprint,request_fingerprint_version,state,"
                        + "replay_ciphertext,replay_nonce,replay_key_version) "
                        + "VALUES ('constraint','partial-tuple',UNHEX(?),'hmac-sha256-v1','IN_PROGRESS',"
                        + "X'01',NULL,'v1')", nonZero));
    }

    private static void insertLegacyRows(JdbcTemplate jdbc) {
        jdbc.update("INSERT INTO iam_idempotency_record "
                        + "(scope_key,idempotency_key,request_hash,state,response_status,result_reference,"
                        + "response_ciphertext,response_nonce,response_key_version) "
                        + "VALUES ('migration','legacy-populated-key',UNHEX(?),'COMPLETED',200,'legacy-ref',"
                        + "X'010203',UNHEX('000000000000000000000000'),'v1')",
                "ab".repeat(32));
    }

    private static void replaceFingerprintCheck(JdbcTemplate jdbc, String clause) {
        jdbc.execute("ALTER TABLE iam_idempotency_record "
                + "DROP CHECK chk_iam_idempotency_request_fingerprint");
        jdbc.execute("ALTER TABLE iam_idempotency_record "
                + "ADD CONSTRAINT chk_iam_idempotency_request_fingerprint CHECK (" + clause + ")");
    }

    private static IamServiceProperties migrationProperties(String schema, String jdbcUrl,
                                                             boolean writersDrained) {
        IamServiceProperties properties = new IamServiceProperties();
        properties.getPersistence().setEnabled(true);
        properties.getPersistence().setSchema(schema);
        properties.getPersistence().setJdbcUrl(jdbcUrl);
        properties.getIdempotency().setV13WritersDrained(writersDrained);
        return properties;
    }

    private static Flyway flyway(DataSource dataSource, String schema, MigrationVersion target) {
        return Flyway.configure().dataSource(dataSource).locations("classpath:db/migration")
                .schemas(schema).defaultSchema(schema).createSchemas(false).baselineOnMigrate(true)
                .baselineVersion("0").target(target).cleanDisabled(false).load();
    }

    private static DataSource dataSource(String jdbcUrl, String username, String password) {
        DriverManagerDataSource dataSource = new DriverManagerDataSource();
        dataSource.setDriverClassName("com.mysql.cj.jdbc.Driver");
        dataSource.setUrl(jdbcUrl);
        dataSource.setUsername(username);
        dataSource.setPassword(password);
        return dataSource;
    }

    private static int count(JdbcTemplate jdbc, String sql) {
        return Objects.requireNonNull(jdbc.queryForObject(sql, Integer.class));
    }

    private static String databaseName(String jdbcUrl) {
        int slash = jdbcUrl.lastIndexOf('/');
        if (slash < 0 || slash == jdbcUrl.length() - 1) return "";
        String database = jdbcUrl.substring(slash + 1);
        int query = database.indexOf('?');
        return query < 0 ? database : database.substring(0, query);
    }

    private static String requiredEnvironment(String name) {
        String value = System.getenv(name);
        if (value == null || value.isBlank()) value = System.getProperty(name);
        if (value == null || value.isBlank()) throw new AssertionError(name + " is required");
        return value;
    }

    private static String requiredEnvironmentAllowEmpty(String name) {
        String value = System.getenv(name);
        if (value == null) value = System.getProperty(name);
        if (value == null) throw new AssertionError(name + " is required (an empty value is allowed)");
        return value;
    }
}
