package com.englishflow.media.adapter.jdbc;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.Statement;
import java.time.Instant;
import java.util.List;
import java.util.Set;

import com.englishflow.media.application.MediaAccessPolicy;
import com.englishflow.media.domain.MediaAsset;
import com.englishflow.media.domain.MediaAssetStatus;
import com.englishflow.media.domain.MediaAuthorizationContext;
import com.englishflow.media.domain.MediaContentReference;
import com.englishflow.media.domain.MediaDeliveryChannel;
import com.englishflow.media.domain.MediaKind;
import com.englishflow.media.domain.MediaOperationException;
import com.englishflow.media.domain.MediaRightsReference;
import com.englishflow.media.domain.MediaRightsStatus;
import com.englishflow.media.domain.TranscodingStatus;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

@EnabledIfSystemProperty(named = "media.tenant.integration", matches = "true")
class MediaTenantIsolationTest {

    private static final String OWNER = "prn_owner00000001";
    private static final Instant NOW = Instant.parse("2026-09-12T00:00:00Z");

    @Test
    void crossTenantPolicyDeniesAndSchemaWritesAreIsolated() throws Exception {
        String adminUrl = required("MEDIA_TENANT_TEST_ADMIN_URL");
        String adminUser = required("MEDIA_TENANT_TEST_ADMIN_USER");
        String adminPassword = required("MEDIA_TENANT_TEST_ADMIN_PASSWORD");
        String suffix = Long.toString(System.currentTimeMillis());
        String schema = "media_tenant_test_" + suffix;
        String guardSchema = "media_tenant_guard_" + suffix;
        String guardUser = "media_guard_" + suffix;
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
            JdbcMediaRepository repository = new JdbcMediaRepository(jdbc);

            MediaRightsReference rights = new MediaRightsReference("rights-real-1", "9001", "LIC-1",
                    MediaRightsStatus.ACTIVE, Set.of("STREAM"), NOW.minusSeconds(3600), NOW.plusSeconds(3600),
                    false, "evidence-real-1");
            MediaAsset asset = new MediaAsset("asset-real-1", "platform", OWNER, "key-real-1", MediaKind.AUDIO,
                    "audio/mpeg", "s3", "bucket-real-1", "objects/key-real-1", "v1", "a".repeat(64), 1024L, true,
                    512, 2, MediaAssetStatus.ACTIVE, TranscodingStatus.NOT_REQUIRED,
                    new MediaContentReference("9001", "primary", null), rights, List.of(), 1, NOW, NOW);
            repository.save(asset);
            assertTrue(repository.findById("asset-real-1").isPresent(), "the owner must read the persisted asset");

            MediaAuthorizationContext otherTenant = MediaAuthorizationContext.verified(OWNER, "other-tenant",
                    Set.of(), Set.of("media:read", "media:write"), "phase-1", Set.of(), true, false, "req-real-1");
            MediaOperationException readDenied = assertThrows(MediaOperationException.class,
                    () -> MediaAccessPolicy.requireRead(asset, otherTenant, MediaDeliveryChannel.STREAM, NOW),
                    "a read from another tenant must be denied");
            assertEquals("MEDIA_TENANT_FORBIDDEN", readDenied.code());
            MediaOperationException mutationDenied = assertThrows(MediaOperationException.class,
                    () -> MediaAccessPolicy.requireMutation(asset, otherTenant),
                    "a mutation from another tenant must be denied");
            assertEquals("MEDIA_TENANT_FORBIDDEN", mutationDenied.code());

            execute(adminUrl, adminUser, adminPassword, "CREATE USER IF NOT EXISTS " + quote(guardUser)
                    + "@'%' IDENTIFIED BY " + quote("media-guard-test"));
            execute(adminUrl, adminUser, adminPassword, "ALTER USER " + quote(guardUser)
                    + "@'%' IDENTIFIED BY " + quote("media-guard-test"));
            execute(adminUrl, adminUser, adminPassword, "GRANT SELECT, INSERT, UPDATE, DELETE ON " + schema + ".* TO "
                    + quote(guardUser) + "@'%'");
            DriverManagerDataSource guardDataSource = new DriverManagerDataSource(schemaUrl, guardUser,
                    "media-guard-test");
            JdbcTemplate guardJdbc = new JdbcTemplate(guardDataSource);
            guardJdbc.update("""
                    INSERT INTO media_asset
                        (asset_id, tenant_id, owner_subject, asset_version, checksum_sha256, size_bytes,
                         rights_status, asset_status, rights_id, license_code, asset_key, kind, mime_type,
                         storage_provider, bucket_name, object_key, object_version, supports_range, chunk_size_bytes,
                         part_count, transcoding_status, permitted_channels, allow_offline,
                         authorization_evidence_ref, created_at, updated_at)
                    VALUES ('asset-real-guard', 'platform', ?, 1, ?, 1024, 'ACTIVE', 'ACTIVE', 'rights-real-1', 'LIC-1',
                            'key-real-guard', 'AUDIO', 'audio/mpeg', 's3', 'bucket-real-1', 'objects/key-guard', 'v1',
                            1, 512, 2, 'NOT_REQUIRED', 'STREAM', 0, 'evidence-real-1', NOW(6), NOW(6))
                    """, OWNER, "b".repeat(64));
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
