package com.englishflow.content.web;

import com.englishflow.content.adapter.memory.InMemoryContentIdempotency;
import com.englishflow.content.adapter.memory.InMemoryContentItemRepository;
import com.englishflow.content.adapter.memory.InMemoryContentOutbox;
import com.englishflow.content.adapter.memory.InMemoryContentRepository;
import com.englishflow.content.adapter.memory.InMemoryLexemeRepository;
import com.englishflow.content.adapter.memory.InMemoryPublicProjectionStore;
import com.englishflow.content.adapter.memory.InMemoryValidationReportStore;
import com.englishflow.content.adapter.memory.RecordingContentCacheInvalidator;
import com.englishflow.content.application.ContentCommandService;
import com.englishflow.content.application.ContentItemCommandService;
import com.englishflow.content.application.LexemeCommandService;
import com.englishflow.content.application.ScheduledPublishService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;

import java.time.Clock;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;

/** Content-ops capability 5: precheck (dry run) → error list → apply, idempotent per batch, no duplicates. */
class BatchImportPrecheckTest {

    private static final String PACK = "VOCAB-PHASE1";
    private InMemoryLexemeRepository lexemeRepo;
    private InMemoryContentItemRepository itemRepo;
    private B9ContentAdminController controller;

    @BeforeEach
    void setUp() {
        InMemoryContentRepository contents = new InMemoryContentRepository();
        InMemoryContentIdempotency idempotency = new InMemoryContentIdempotency();
        InMemoryContentOutbox outbox = new InMemoryContentOutbox();
        lexemeRepo = new InMemoryLexemeRepository();
        itemRepo = new InMemoryContentItemRepository();
        ContentCommandService commands = new ContentCommandService(contents, outbox, idempotency,
                new InMemoryPublicProjectionStore(), new RecordingContentCacheInvalidator(),
                new InMemoryValidationReportStore(), Clock.systemUTC());
        controller = new B9ContentAdminController(commands,
                new LexemeCommandService(contents, lexemeRepo, outbox, idempotency, Clock.systemUTC()),
                new ContentItemCommandService(itemRepo, outbox, idempotency, Clock.systemUTC()),
                mock(ScheduledPublishService.class), contents, new VerifiedContentPrincipalFactory(),
                idempotency, new InMemoryValidationReportStore());
    }

    private static Map<String, Object> lexemeEntry(String headword) {
        return Map.of("contentCode", PACK, "lexeme", Map.of(
                "headword", headword, "lemma", headword, "pos", List.of("NOUN"), "cefr", "A2",
                "senses", List.of(Map.of("pos", "NOUN", "meaningCn", "释义"))));
    }

    private static Map<String, Object> itemEntry(String explanation) {
        return Map.of("contentCode", PACK, "item", Map.of(
                "kind", "QUESTION", "stem", "Choose: I ___ a habit.",
                "fields", Map.of("options", List.of("build", "builds"), "answerIndex", 0,
                        "explanation", explanation, "cefr", "A2")));
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> run(List<Map<String, Object>> entries, boolean dryRun, String key) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("items", entries);
        if (dryRun) body.put("dryRun", true);
        return (Map<String, Object>) controller.importBatch(body, editor(), key, new HttpHeaders())
                .getBody().get("data");
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> entry(Map<String, Object> data, int index) {
        return ((List<Map<String, Object>>) data.get("items")).get(index);
    }

    @Test
    void dryRunReportsReadyInvalidAndInBatchDuplicatesWithoutWriting() {
        Map<String, Object> badItem = Map.of("contentCode", PACK, "item", Map.of("kind", "NOPE", "stem", "x"));
        Map<String, Object> data = run(List.of(lexemeEntry("habit"), lexemeEntry("habit"),
                itemEntry("e1"), itemEntry("e1"), badItem, Map.of("contentCode", "", "lexeme", Map.of())),
                true, "batch-dry-key-000001");
        assertEquals(true, data.get("dryRun"));
        assertEquals("READY", entry(data, 0).get("status"));
        assertEquals("DUPLICATE_IN_BATCH", entry(data, 1).get("reason"));
        assertEquals("READY", entry(data, 2).get("status"));
        assertEquals("DUPLICATE_IN_BATCH", entry(data, 3).get("reason"));
        assertEquals("INVALID", entry(data, 4).get("status"));
        assertEquals("ITEM_KIND_INVALID", entry(data, 4).get("errorCode"));
        assertTrue(String.valueOf(entry(data, 4).get("message")).length() > 0);
        assertEquals("INVALID", entry(data, 5).get("status"));
        assertEquals(2L, data.get("ready"));
        assertEquals(2L, data.get("invalid"));
        assertTrue(lexemeRepo.search(PACK, null, null, null, null, 10, null).isEmpty(), "dry run must not write");
        assertTrue(itemRepo.search(PACK, null, null, null, 10, null).isEmpty(), "dry run must not write");
    }

    @Test
    void applyThenReplayAndNewBatchKeyNeverDuplicate() {
        List<Map<String, Object>> entries = List.of(lexemeEntry("habit"), itemEntry("e1"), itemEntry("e1"));
        Map<String, Object> first = run(entries, false, "batch-apply-key-0001");
        assertEquals("ACCEPTED", entry(first, 0).get("status"));
        assertEquals("ACCEPTED", entry(first, 1).get("status"));
        assertEquals("SKIPPED", entry(first, 2).get("status"));

        Map<String, Object> replay = run(entries, false, "batch-apply-key-0001");
        assertEquals("ACCEPTED", entry(replay, 0).get("status"), "replay returns the original receipt");
        assertEquals(entry(first, 1).get("itemId"), entry(replay, 1).get("itemId"));

        Map<String, Object> again = run(entries, false, "batch-apply-key-0002");
        assertEquals("LEXEME_EXISTS", entry(again, 0).get("reason"));
        assertEquals("ITEM_EXISTS", entry(again, 1).get("reason"));
        assertEquals(entry(first, 1).get("itemId"), entry(again, 1).get("itemId"));

        Map<String, Object> precheck = run(entries, true, "batch-apply-key-0003");
        assertEquals("ITEM_EXISTS", entry(precheck, 1).get("reason"));
        assertEquals(0L, precheck.get("ready"));

        assertEquals(1, lexemeRepo.search(PACK, null, null, null, null, 10, null).size());
        assertEquals(1, itemRepo.search(PACK, null, null, null, 10, null).size());
    }

    @Test
    void differentFieldsAreNotTreatedAsDuplicates() {
        run(List.of(itemEntry("e1")), false, "batch-diff-key-00001");
        Map<String, Object> data = run(List.of(itemEntry("e2")), false, "batch-diff-key-00002");
        assertEquals("ACCEPTED", entry(data, 0).get("status"));
        assertEquals(2, itemRepo.search(PACK, null, null, null, 10, null).size());
    }

    @Test
    void failedApplyEntryCarriesAMessage() {
        Map<String, Object> data = run(List.of(Map.of("contentCode", PACK, "item", Map.of("kind", "NOPE"))),
                false, "batch-fail-key-00001");
        assertEquals("FAILED", entry(data, 0).get("status"));
        assertTrue(entry(data, 0).containsKey("message"));
    }

    private static JwtAuthenticationToken editor() {
        Instant now = Instant.now();
        Jwt jwt = Jwt.withTokenValue("test-only").header("alg", "RS256").subject("editor-1")
                .issuedAt(now).expiresAt(now.plusSeconds(300)).claim("tenant_id", "platform")
                .claim("permissions", List.of("content:write")).build();
        return new JwtAuthenticationToken(jwt, Set.of(), "editor-1");
    }
}
