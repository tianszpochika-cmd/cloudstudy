package com.englishflow.content.application;

import com.englishflow.content.adapter.jdbc.JdbcPhoneticsCatalog;
import com.englishflow.content.adapter.memory.InMemoryContentIdempotency;
import com.englishflow.content.adapter.memory.InMemoryContentItemRepository;
import com.englishflow.content.adapter.memory.InMemoryContentOutbox;
import com.englishflow.content.domain.ContentActor;
import com.englishflow.content.domain.ContentIdempotencyKey;
import com.englishflow.content.domain.ContentItem;
import com.englishflow.content.domain.ContentOperationException;
import com.englishflow.content.domain.ContentRequestContext;
import com.englishflow.content.domain.ItemAvailability;
import com.englishflow.content.domain.ReviewDecision;
import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import tools.jackson.databind.ObjectMapper;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** Content-ops capability 6: phonetics rows share the item lifecycle and project only with canonical provenance. */
class PhoneticsMaintenanceTest {

    private static final Clock CLOCK = Clock.fixed(Instant.parse("2026-10-13T00:00:00Z"), ZoneOffset.UTC);
    private static final ContentRequestContext REQUEST =
            new ContentRequestContext("req-phonetics", "0123456789abcdef0123456789abcdef");
    private static final String PACK = "PHONETICS-FR";
    private final AtomicInteger keys = new AtomicInteger();
    private InMemoryContentItemRepository repo;
    private ContentItemCommandService commands;
    private HikariDataSource dataSource;
    private JdbcTemplate jdbc;

    @BeforeEach
    void setUp() {
        repo = new InMemoryContentItemRepository();
        commands = new ContentItemCommandService(repo, new InMemoryContentOutbox(), new InMemoryContentIdempotency(), CLOCK);
        HikariConfig config = new HikariConfig();
        config.setJdbcUrl("jdbc:h2:mem:phon_" + UUID.randomUUID().toString().replace("-", "") + ";MODE=MySQL;DB_CLOSE_DELAY=-1");
        config.setUsername("sa");
        config.setMaximumPoolSize(2);
        dataSource = new HikariDataSource(config);
        jdbc = new JdbcTemplate(dataSource);
        jdbc.execute("CREATE TABLE b3_content_experience (experience_id VARCHAR(96) PRIMARY KEY, tenant_id VARCHAR(64), "
                + "domain_code VARCHAR(32), resource_type VARCHAR(64), resource_key VARCHAR(96), "
                + "content_version_id BIGINT NOT NULL DEFAULT 301, availability VARCHAR(16), payload_json VARCHAR(4000), "
                + "updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)");
        jdbc.execute("CREATE TABLE content_definition (content_id VARCHAR(128) PRIMARY KEY, tenant_id VARCHAR(64), "
                + "content_code VARCHAR(128), current_published_version_id BIGINT)");
        jdbc.execute("CREATE TABLE content_version (content_version_id BIGINT PRIMARY KEY, content_id VARCHAR(128))");
    }

    @AfterEach
    void tearDown() {
        dataSource.close();
    }

    private ContentIdempotencyKey key() {
        return new ContentIdempotencyKey("phonetics-key-" + keys.incrementAndGet() + "-idempotency");
    }

    private static ContentActor actor(String subject, String... permissions) {
        return new ContentActor(subject, "platform", Set.of("content-editor"), Set.of(permissions), false);
    }

    private static Map<String, Object> phoneme(String symbol) {
        return Map.of("kind", "PHONEME", "stem", symbol,
                "fields", Map.of("symbol", symbol, "group", "NASAL_VOWEL", "exampleWord", "pain"));
    }

    private static void assertCode(String code, Runnable action) {
        assertEquals(code, assertThrows(ContentOperationException.class, action::run).code());
    }

    @Test
    void phonemeNeedsSymbolAndGroupAndAPhoneticsPack() {
        ContentActor editor = actor("editor-1", "content:write");
        assertCode("ITEM_FIELD_INVALID", () -> commands.upsert(PACK,
                Map.of("kind", "PHONEME", "fields", Map.of("group", "NASAL_VOWEL")), null, 0L, editor, key(), REQUEST));
        assertCode("ITEM_FIELD_INVALID", () -> commands.upsert(PACK,
                Map.of("kind", "PHONEME", "fields", Map.of("symbol", "ɛ̃", "group", "nasal")), null, 0L, editor, key(), REQUEST));
        assertCode("ITEM_FIELD_INVALID", () -> commands.upsert(PACK,
                Map.of("kind", "MINIMAL_PAIR", "fields", Map.of("leftWord", "pain")), null, 0L, editor, key(), REQUEST));
        assertCode("ITEM_KIND_PACK_MISMATCH", () -> commands.upsert("VOCAB-PHASE1", phoneme("ɛ̃"), null, 0L, editor, key(), REQUEST));
        assertCode("ITEM_KIND_PACK_MISMATCH", () -> commands.upsert(PACK,
                Map.of("kind", "QUESTION", "stem", "x", "fields", Map.of()), null, 0L, editor, key(), REQUEST));
    }

    @Test
    void phonemeRunsTheFourEyesRejectAndPublishLoop() {
        ContentActor editor = actor("editor-1", "content:write");
        ContentActor first = actor("reviewer-1", "content:review:first");
        ContentActor fin = actor("reviewer-2", "content:review:final");
        String id = commands.upsert(PACK, phoneme("ɛ̃"), null, 0L, editor, key(), REQUEST).itemId();
        commands.submit(PACK, id, editor, key(), REQUEST);
        ContentActor selfReviewer = actor("editor-1", "content:write", "content:review:first");
        assertCode("ITEM_SELF_APPROVAL_DENIED", () -> commands.reviewFirst(PACK, id, ReviewDecision.APPROVED, selfReviewer, key(), REQUEST));
        assertCode("ITEM_REJECT_REASON_REQUIRED", () -> commands.reviewFirst(PACK, id, ReviewDecision.REJECTED, " ", first, key(), REQUEST));
        commands.reviewFirst(PACK, id, ReviewDecision.CHANGES_REQUESTED, "例词应为 vin", first, key(), REQUEST);
        assertEquals(ItemAvailability.DRAFT, repo.findById(id).orElseThrow().availability());
        long version = repo.findById(id).orElseThrow().stateVersion();
        assertCode("ITEM_VERSION_CONFLICT", () -> commands.upsert(PACK, phoneme("ɛ̃"), id, version - 1, editor, key(), REQUEST));
        commands.upsert(PACK, phoneme("ɛ̃"), id, version, editor, key(), REQUEST);
        commands.submit(PACK, id, editor, key(), REQUEST);
        commands.reviewFirst(PACK, id, ReviewDecision.APPROVED, first, key(), REQUEST);
        commands.reviewFinal(PACK, id, ReviewDecision.APPROVED, fin, key(), REQUEST);
        commands.publish(PACK, id, "PHONETICS_RELEASE", actor("publisher-1", "content:publish"), key(), REQUEST);
        assertEquals(ItemAvailability.PUBLISHED, repo.findById(id).orElseThrow().availability());
    }

    @Test
    void projectionWaitsForAPublishedPackAndWithdrawsOnUnpublish() {
        JdbcPhoneticsCatalog catalog = new JdbcPhoneticsCatalog(jdbc, new ObjectMapper());
        ContentItem row = ContentItem.create("item-ph-1", "platform", PACK, "PHONEME", "ɛ̃",
                Map.of("symbol", "ɛ̃", "group", "NASAL_VOWEL"), null, null, "editor-1", Instant.now());
        assertEquals("PACK_NOT_PUBLISHED", catalog.project(row, true));
        assertTrue(catalog.catalog(PACK, "PHONEME", 50).isEmpty());

        jdbc.update("INSERT INTO content_definition VALUES ('pack-ph-fr', 'platform', ?, 900)", PACK);
        jdbc.update("INSERT INTO content_version VALUES (900, 'pack-ph-fr')");
        assertEquals("PROJECTED", catalog.project(row, true));
        List<Map<String, Object>> rows = catalog.catalog(PACK, "PHONEME", 50);
        assertEquals(1, rows.size());
        assertEquals("ɛ̃", rows.getFirst().get("symbol"));
        assertEquals(true, rows.getFirst().get("learnerVisible"));
        assertEquals(true, rows.getFirst().get("maintainedItem"));

        assertEquals("WITHDRAWN", catalog.project(row, false));
        Map<String, Object> withdrawn = catalog.catalog(PACK, "PHONEME", 50).getFirst();
        assertEquals("UNPUBLISHED", withdrawn.get("availability"));
        assertFalse((Boolean) withdrawn.get("learnerVisible"));
    }
}
