package com.englishflow.content.adapter.failclosed;

import com.englishflow.content.domain.ContentAudience;
import com.englishflow.content.domain.ContentDefinition;
import com.englishflow.content.domain.ContentId;
import com.englishflow.content.domain.ContentIdempotencyKey;
import com.englishflow.content.domain.ContentOutboxEvent;
import com.englishflow.content.domain.ContentRequestContext;
import com.englishflow.content.domain.ContentVersion;
import com.englishflow.content.domain.ContentVersionId;
import com.englishflow.content.domain.PublicContentProjection;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.Map;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.englishflow.content.domain.ContentOperationException;
import org.junit.jupiter.api.function.Executable;

/**
 * Fail-closed adapters must refuse every operation by default when no durable store is configured.
 * This guarantees an unconfigured service never pretends to be durable.
 */
@DisplayName("FailClosed adapters default-deny semantics")
class FailClosedAdaptersTest {

    private static final ContentId CONTENT_ID = ContentId.of("cnt_fail_1");
    private static final ContentVersionId VERSION_ID = ContentVersionId.of(1L);
    private static final String SCOPE = "scope";
    private static final ContentIdempotencyKey KEY = new ContentIdempotencyKey("fail-closed-idempotency-key-1");
    private static final ContentRequestContext REQUEST = ContentRequestContext.local();

    private static ContentVersionId requireVersionId() {
        return VERSION_ID;
    }

    private static ContentVersion aVersion() {
        return ContentVersion.draft(VERSION_ID, 1, com.englishflow.content.domain.ContentKind.VOCABULARY,
                new com.englishflow.content.domain.ContentPayload(Map.of("term", "cat")),
                null, "editor-1", "note", Instant.parse("2026-08-22T00:00:00Z"));
    }

    private static ContentDefinition aContent() {
        return ContentDefinition.create(CONTENT_ID, "platform", "vocab-fail-1",
                com.englishflow.content.domain.ContentKind.VOCABULARY, "Title", "en-US", "A1", "ONB", "editor-1",
                Instant.parse("2026-08-22T00:00:00Z"));
    }

    private static void assertUnavailable(Executable action) {
        ContentOperationException ex = assertThrows(ContentOperationException.class, action);
        assertEquals("CONTENT_PERSISTENCE_UNAVAILABLE", ex.code());
        assertEquals(503, ex.status());
        assertEquals(true, ex.retryable());
    }

    @Test
    @DisplayName("FailClosedContentRepository refuses every read and write")
    void repositoryRefusesAll() {
        FailClosedContentRepository repository = new FailClosedContentRepository();
        assertUnavailable(() -> repository.find(CONTENT_ID));
        assertUnavailable(() -> repository.findByCode("code"));
        assertUnavailable(() -> repository.findAll());
        assertUnavailable(() -> repository.nextVersionId());
        assertUnavailable(() -> repository.create(aContent()));
        assertUnavailable(() -> repository.save(aContent()));
    }

    @Test
    @DisplayName("FailClosedContentIdempotency refuses command execution")
    void idempotencyRefuses() {
        FailClosedContentIdempotency idempotency = new FailClosedContentIdempotency();
        assertUnavailable(() -> idempotency.execute(SCOPE, KEY, "fp", () -> "x"));
    }

    @Test
    @DisplayName("FailClosedContentOutbox refuses append")
    void outboxRefuses() {
        FailClosedContentOutbox outbox = new FailClosedContentOutbox();
        ContentOutboxEvent event = ContentOutboxEvent.create(
                "content_version", "1001", "content.version.created.v1", "actor-1", "dedupe-1",
                "{\"a\":1}", REQUEST, Instant.parse("2026-08-22T00:00:00Z"));
        assertUnavailable(() -> outbox.appendAfterFact(event));
    }

    @Test
    @DisplayName("FailClosedContentCacheInvalidator refuses invalidation")
    void cacheInvalidatorRefuses() {
        FailClosedContentCacheInvalidator invalidator = new FailClosedContentCacheInvalidator();
        assertUnavailable(() -> invalidator.invalidate(CONTENT_ID, requireVersionId(), "reason"));
    }

    @Test
    @DisplayName("FailClosedPublicProjectionStore refuses every operation")
    void projectionStoreRefuses() {
        FailClosedPublicProjectionStore store = new FailClosedPublicProjectionStore();
        PublicContentProjection projection = new PublicContentProjection(
                CONTENT_ID, VERSION_ID, com.englishflow.content.domain.ContentKind.VOCABULARY,
                "Title", "en-US", "A1", "ONB", ContentAudience.PUBLIC, Map.of("term", "cat"),
                "hash", Instant.parse("2026-08-22T00:00:00Z"));
        assertUnavailable(() -> store.find(CONTENT_ID, VERSION_ID, ContentAudience.PUBLIC));
        assertUnavailable(() -> store.put(projection));
        assertUnavailable(() -> store.remove(CONTENT_ID, VERSION_ID));
    }

    @Test
    @DisplayName("FailClosedPublishedContentReadProjectionPort refuses cross-service reads")
    void crossServiceReadRefuses() {
        FailClosedPublishedContentReadProjectionPort port = new FailClosedPublishedContentReadProjectionPort();
        assertUnavailable(() -> port.findPublished("cnt-1", 1L, "platform", "subject-1"));
    }

    @Test
    @DisplayName("ContentPersistenceFailure produces the canonical unavailable error")
    void failureFactoryCanonical() {
        ContentOperationException ex = ContentPersistenceFailure.unavailable();
        assertEquals("CONTENT_PERSISTENCE_UNAVAILABLE", ex.code());
        assertEquals(503, ex.status());
    }
}
