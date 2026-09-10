package com.englishflow.content.adapter.memory;

import com.englishflow.content.domain.ContentAudience;
import com.englishflow.content.domain.ContentOperationException;
import com.englishflow.content.domain.ContentDefinition;
import com.englishflow.content.domain.ContentId;
import com.englishflow.content.domain.ContentIdempotencyKey;
import com.englishflow.content.domain.ContentKind;
import com.englishflow.content.domain.ContentOutboxEvent;
import com.englishflow.content.domain.ContentRequestContext;
import com.englishflow.content.domain.ContentVersionId;
import com.englishflow.content.domain.PublicContentProjection;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.Map;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** In-memory test doubles: idempotency replay, outbox dedupe, repository and projection store. */
@DisplayName("In-memory adapter doubles")
class InMemoryAdaptersTest {

    private static final Instant NOW = Instant.parse("2026-08-22T00:00:00Z");

    private static ContentIdempotencyKey key(String v) {
        return new ContentIdempotencyKey(v + "-key-0000000000000000");
    }

    @Test
    @DisplayName("idempotency replays the same result for an identical key and fingerprint")
    void idempotencyReplays() {
        InMemoryContentIdempotency idempotency = new InMemoryContentIdempotency();
        AtomicInteger runs = new AtomicInteger();
        String first = idempotency.execute("scope", key("k1"), "fp-a",
                () -> "result-" + runs.incrementAndGet());
        String second = idempotency.execute("scope", key("k1"), "fp-a",
                () -> "result-" + runs.incrementAndGet());
        assertEquals(first, second);
        assertEquals(1, runs.get());
    }

    @Test
    @DisplayName("idempotency rejects a key reused for a different fingerprint")
    void idempotencyRejectsReuse() {
        InMemoryContentIdempotency idempotency = new InMemoryContentIdempotency();
        idempotency.execute("scope", key("k2"), "fp-a", () -> "ok");
        ContentOperationException ex = assertThrows(ContentOperationException.class,
                () -> idempotency.execute("scope", key("k2"), "fp-b", () -> "other"));
        assertEquals("IDEMPOTENCY_KEY_REUSE", ex.code());
    }

    @Test
    @DisplayName("outbox deduplicates by key and rejects cross-event reuse")
    void outboxDedupe() {
        InMemoryContentOutbox outbox = new InMemoryContentOutbox();
        ContentRequestContext ctx = ContentRequestContext.local();
        ContentOutboxEvent e1 = ContentOutboxEvent.create(
                "content_version", "1001", "content.version.published.v1", "actor-1", "dedupe-x",
                "{\"a\":1}", ctx, NOW);
        outbox.appendAfterFact(e1);
        outbox.appendAfterFact(e1); // same event, same dedupe key -> no conflict
        assertEquals(1L, outbox.countByType("content.version.published.v1"));

        ContentOutboxEvent e2 = ContentOutboxEvent.create(
                "content_version", "1001", "content.version.unpublished.v1", "actor-1", "dedupe-x",
                "{\"a\":1}", ctx, NOW);
        ContentOperationException ex = assertThrows(ContentOperationException.class,
                () -> outbox.appendAfterFact(e2));
        assertEquals("OUTBOX_DEDUPE_CONFLICT", ex.code());
    }

    @Test
    @DisplayName("repository creates, finds and rejects duplicates")
    void repositoryCreateFind() {
        InMemoryContentRepository repository = new InMemoryContentRepository();
        ContentDefinition content = ContentDefinition.create(
                ContentId.of("cnt_mem_1"), "platform", "vocab-mem-1", ContentKind.VOCABULARY,
                "Title", "en-US", "A1", "ONB", "editor-1", NOW);
        repository.create(content);
        assertTrue(repository.find(ContentId.of("cnt_mem_1")).isPresent());
        assertTrue(repository.findByCode("vocab-mem-1").isPresent());
        assertEquals(1, repository.findAll().size());

        ContentOperationException ex = assertThrows(ContentOperationException.class,
                () -> repository.create(content));
        assertEquals("CONTENT_EXISTS", ex.code());
    }

    @Test
    @DisplayName("repository allocates increasing version ids")
    void repositoryNextVersionId() {
        InMemoryContentRepository repository = new InMemoryContentRepository();
        // no contents -> starts above the reserved base
        assertTrue(repository.nextVersionId().value() > 25000L);
        ContentDefinition content = ContentDefinition.create(
                ContentId.of("cnt_mem_2"), "platform", "vocab-mem-2", ContentKind.VOCABULARY,
                "Title", "en-US", "A1", "ONB", "editor-1", NOW);
        content.addDraft(ContentVersionId.of(30001L), Map.of("term", "cat"), null, "editor-1", "n", NOW);
        repository.create(content);
        assertEquals(30002L, repository.nextVersionId().value());
    }

    @Test
    @DisplayName("projection store puts, finds and removes by content and version")
    void projectionStoreLifecycle() {
        InMemoryPublicProjectionStore store = new InMemoryPublicProjectionStore();
        PublicContentProjection projection = new PublicContentProjection(
                ContentId.of("cnt_mem_3"), ContentVersionId.of(1L), ContentKind.VOCABULARY,
                "Title", "en-US", "A1", "ONB", ContentAudience.PUBLIC, Map.of("term", "cat"),
                "hash", NOW);
        store.put(projection);
        assertTrue(store.find(ContentId.of("cnt_mem_3"), ContentVersionId.of(1L), ContentAudience.PUBLIC).isPresent());
        assertFalse(store.find(ContentId.of("cnt_mem_3"), ContentVersionId.of(1L), ContentAudience.LEARNER).isPresent());
        store.remove(ContentId.of("cnt_mem_3"), ContentVersionId.of(1L));
        assertFalse(store.find(ContentId.of("cnt_mem_3"), ContentVersionId.of(1L), ContentAudience.PUBLIC).isPresent());
    }

    @Test
    @DisplayName("recording cache invalidator records every invalidation")
    void recordingInvalidatorRecords() {
        RecordingContentCacheInvalidator invalidator = new RecordingContentCacheInvalidator();
        invalidator.invalidate(ContentId.of("cnt_mem_4"), ContentVersionId.of(1L), "publish");
        invalidator.invalidate(ContentId.of("cnt_mem_4"), ContentVersionId.of(1L), "unpublish");
        assertEquals(2, invalidator.invalidations().size());
        assertEquals("unpublish", invalidator.invalidations().get(1).reason());
    }

    /** Tiny atomic counter without pulling extra dependencies. */
    static final class AtomicInteger {
        private int value;

        int incrementAndGet() {
            return ++value;
        }

        int get() {
            return value;
        }
    }
}
