package com.englishflow.content.migration;

import com.englishflow.content.adapter.jdbc.JdbcContentItemRepository;
import com.englishflow.content.adapter.jdbc.JdbcPhoneticsCatalog;
import com.englishflow.content.domain.ContentItem;
import com.englishflow.content.domain.ItemAvailability;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.jdbc.datasource.init.ScriptUtils;
import tools.jackson.databind.ObjectMapper;

import java.sql.Connection;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** V34 on real MySQL: legacy phonetics become DRAFT items, with no 301, no publish, no projection. */
@EnabledIfSystemProperty(named = "content.migration.integration", matches = "true")
class LegacyPhoneticsBackfillMigrationTest {

    private static final String V34 = "db/migration/V34__backfill_legacy_phonetics_items.sql";

    @Test
    void legacyPhoneticsBecomeEditableDraftsIdempotently() throws Exception {
        String url = System.getenv("CONTENT_FLYWAY_TEST_ADMIN_URL");
        String user = System.getenv("CONTENT_FLYWAY_TEST_ADMIN_USER");
        String password = System.getenv("CONTENT_FLYWAY_TEST_ADMIN_PASSWORD");
        String schema = "content_v34_test_" + System.currentTimeMillis();
        JdbcTemplate admin = new JdbcTemplate(new DriverManagerDataSource(url, user, password));
        admin.execute("CREATE DATABASE " + schema + " CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
        try {
            String schemaUrl = url.replaceFirst("/\\?", "/" + schema + "?");
            DriverManagerDataSource dataSource = new DriverManagerDataSource(schemaUrl, user, password);
            Flyway.configure().dataSource(dataSource).locations("classpath:db/migration").load().migrate();
            JdbcTemplate jdbc = new JdbcTemplate(dataSource);

            int legacyEn = count(jdbc, "SELECT COUNT(*) FROM b3_content_experience WHERE domain_code = 'PHONETICS' "
                    + "AND resource_type IN ('PHONEME','MINIMAL_PAIR') AND experience_id NOT LIKE 'b3-phonetics-item-%'");
            int legacyFr = count(jdbc, "SELECT COUNT(*) FROM b3_content_experience WHERE domain_code = 'PHONETICS-FR' "
                    + "AND resource_type IN ('PHONEME','MINIMAL_PAIR') AND experience_id NOT LIKE 'b3-phonetics-item-%'");
            assertTrue(legacyEn > 40 && legacyFr > 35, "legacy catalog must be present");
            assertEquals(legacyEn, count(jdbc, "SELECT COUNT(*) FROM content_item WHERE pack_code = 'PHONETICS' AND item_id LIKE 'legacy-%'"));
            assertEquals(legacyFr, count(jdbc, "SELECT COUNT(*) FROM content_item WHERE pack_code = 'PHONETICS-FR' AND item_id LIKE 'legacy-%'"));
            assertEquals(0, count(jdbc, "SELECT COUNT(*) FROM content_item WHERE item_id LIKE 'legacy-%' AND (availability <> 'DRAFT' "
                    + "OR first_reviewer IS NOT NULL OR final_reviewer IS NOT NULL OR publisher IS NOT NULL "
                    + "OR source_code <> 'SOURCE-PLATFORM-PHONETICS' OR license_code <> 'LICENSE-INTERNAL-REF' "
                    + "OR JSON_CONTAINS_PATH(fields_json, 'one', '$.contentVersionId'))"));
            assertEquals(0, count(jdbc, "SELECT COUNT(*) FROM b3_content_experience WHERE experience_id LIKE 'b3-phonetics-item-%'"));
            assertEquals(0, count(jdbc, "SELECT COUNT(*) FROM b3_content_experience WHERE domain_code IN ('PHONETICS','PHONETICS-FR') "
                    + "AND availability = 'PUBLISHED'"), "V23 withdrawal must stand");
            assertEquals(2, count(jdbc, "SELECT COUNT(*) FROM content_definition WHERE content_code IN ('PHONETICS','PHONETICS-FR') "
                    + "AND current_published_version_id IS NULL"));

            JdbcContentItemRepository items = new JdbcContentItemRepository(jdbc, new ObjectMapper());
            ContentItem nasal = items.findById("legacy-phoneme-3663").orElseThrow();
            assertEquals("ɛ̃", nasal.stem(), "utf8mb4 IPA must survive");
            assertEquals(ItemAvailability.DRAFT, nasal.availability());
            assertEquals("PHONETICS-FR", nasal.packCode());
            ContentItem pair = items.findById("legacy-pair-3961").orElseThrow();
            assertEquals("legacy-phoneme-3605", pair.fields().get("leftItemId"));
            assertEquals(3605, ((Number) pair.fields().get("leftPhonemeId")).intValue());
            assertEquals("bad / bed", pair.stem());
            assertNull(pair.trail().submittedBy());

            nasal.applyUpsert(nasal.stem(), nasal.fields(), "editor-1", java.time.Instant.now());
            nasal.submit("editor-1", java.time.Instant.now());
            items.save(nasal);
            assertEquals("PACK_NOT_PUBLISHED",
                    new JdbcPhoneticsCatalog(jdbc, new ObjectMapper()).project(items.findById("legacy-phoneme-3663").orElseThrow(), true));

            int before = count(jdbc, "SELECT COUNT(*) FROM content_item");
            try (Connection connection = dataSource.getConnection()) {
                ScriptUtils.executeSqlScript(connection, new ClassPathResource(V34));
            }
            assertEquals(before, count(jdbc, "SELECT COUNT(*) FROM content_item"), "V34 must be idempotent");
            assertEquals(ItemAvailability.IN_REVIEW, items.findById("legacy-phoneme-3663").orElseThrow().availability(),
                    "re-running V34 must not overwrite edited rows");
            assertFalse(count(jdbc, "SELECT COUNT(*) FROM content_definition WHERE content_code = 'PHONETICS'") > 1);
        } finally {
            admin.execute("DROP DATABASE IF EXISTS " + schema);
        }
    }

    private static int count(JdbcTemplate jdbc, String sql) {
        return jdbc.queryForObject(sql, Integer.class);
    }
}
