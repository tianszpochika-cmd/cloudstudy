package com.englishflow.content.domain;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.Set;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** Boundary/validation tests for the value objects that guard identity, authority and outbox facts. */
@DisplayName("Value-object boundary and validation rules")
class ContentValueObjectBoundaryTest {

    @Test
    @DisplayName("ContentId accepts a safe identifier and rejects invalid formats")
    void contentIdBoundaries() {
        assertEquals("cnt_b9_x", new ContentId("cnt_b9_x").value());
        ContentOperationException shortId = assertThrows(ContentOperationException.class, () -> new ContentId("a"));
        assertEquals("CONTENT_ID_INVALID", shortId.code());
        ContentOperationException dots = assertThrows(ContentOperationException.class, () -> new ContentId(".."));
        assertEquals("CONTENT_ID_INVALID", dots.code());
    }

    @Test
    @DisplayName("ContentId rejects a null value")
    void contentIdNullRejected() {
        assertThrows(NullPointerException.class, () -> new ContentId(null));
    }

    @Test
    @DisplayName("ContentVersionId accepts long and textual ids and rejects invalid ones")
    void contentVersionIdBoundaries() {
        assertEquals(1001L, ContentVersionId.of(1001L).value());
        assertEquals(123L, ContentVersionId.of("123").value());
        ContentOperationException zero = assertThrows(ContentOperationException.class, () -> ContentVersionId.of("0"));
        assertEquals("CONTENT_VERSION_ID_INVALID", zero.code());
        ContentOperationException text = assertThrows(ContentOperationException.class, () -> ContentVersionId.of("abc"));
        assertEquals("CONTENT_VERSION_ID_INVALID", text.code());
        ContentOperationException tooLong = assertThrows(ContentOperationException.class,
                () -> ContentVersionId.of("123456789012345678901")); // 21 digits
        assertEquals("CONTENT_VERSION_ID_INVALID", tooLong.code());
    }

    @Test
    @DisplayName("ContentIdempotencyKey requires 16-128 safe characters")
    void idempotencyKeyBoundaries() {
        String ok = "abc-def-ghi-jkl-mno-1234567890";
        assertEquals(ok, new ContentIdempotencyKey(ok).value());
        ContentOperationException shortKey = assertThrows(ContentOperationException.class,
                () -> new ContentIdempotencyKey("tooshortkey1234"));
        assertEquals("IDEMPOTENCY_KEY_INVALID", shortKey.code());
        // A null key is rejected before the format check (defensive non-null contract).
        assertThrows(NullPointerException.class, () -> new ContentIdempotencyKey(null));
    }

    @Test
    @DisplayName("ContentActor exposes role/permission facts and rejects invalid ones")
    void contentActorBoundaries() {
        ContentActor editor = new ContentActor("editor-1", "platform",
                Set.of("content-editor"), Set.of("content:write"), false);
        assertTrue(editor.canEdit());
        assertFalse(editor.canReviewFirst());
        assertFalse(editor.canReadAnswerRules());

        ContentActor serviceActor = new ContentActor("assessment", "platform",
                Set.of(), Set.of("content:answer-rules:read"), true);
        assertTrue(serviceActor.canReadAnswerRules());

        ContentOperationException badRole = assertThrows(ContentOperationException.class,
                () -> new ContentActor("editor-1", "platform", Set.of(" "), Set.of(), false));
        assertEquals("ACTOR_FACT_INVALID", badRole.code());
        ContentOperationException badSubject = assertThrows(ContentOperationException.class,
                () -> new ContentActor("x", "platform", Set.of(), Set.of(), false));
        assertEquals("ACTOR_FACT_INVALID", badSubject.code());
    }

    @Test
    @DisplayName("ContentRequestContext validates correlation identifiers")
    void requestContextBoundaries() {
        ContentRequestContext ctx = new ContentRequestContext(
                "req-b9-content-001", "0123456789abcdef0123456789abcdef");
        assertEquals("req-b9-content-001", ctx.requestId());
        ContentOperationException badRequest = assertThrows(ContentOperationException.class,
                () -> new ContentRequestContext("short", "0123456789abcdef0123456789abcdef"));
        assertEquals("CORRELATION_INVALID", badRequest.code());
        ContentOperationException badTrace = assertThrows(ContentOperationException.class,
                () -> new ContentRequestContext("req-b9-content-001", "not-a-hex-trace-value!!"));
        assertEquals("CORRELATION_INVALID", badTrace.code());
        ContentRequestContext local = ContentRequestContext.local();
        assertTrue(local.requestId().startsWith("local-"));
    }

    @Test
    @DisplayName("ContentOutboxEvent validates envelope facts")
    void outboxEventBoundaries() {
        ContentRequestContext ctx = ContentRequestContext.local();
        ContentOutboxEvent event = ContentOutboxEvent.create(
                "content_version", "1001", "content.version.created.v1",
                "actor-1", "dedupe-1", "{\"a\":1}", ctx, Instant.parse("2026-08-22T00:00:00Z"));
        assertEquals("content.event.v1", event.schemaVersion());
        assertEquals(1, event.version());

        ContentOperationException badType = assertThrows(ContentOperationException.class,
                () -> ContentOutboxEvent.create("content_version", "1001", "invalid-type",
                        "actor-1", "dedupe-2", "{\"a\":1}", ctx, Instant.parse("2026-08-22T00:00:00Z")));
        assertEquals("EVENT_TYPE_INVALID", badType.code());

        ContentOperationException badPayload = assertThrows(ContentOperationException.class,
                () -> ContentOutboxEvent.create("content_version", "1001", "content.version.created.v1",
                        "actor-1", "dedupe-3", "not-json", ctx, Instant.parse("2026-08-22T00:00:00Z")));
        assertEquals("EVENT_PAYLOAD_INVALID", badPayload.code());

        ContentOperationException invalidAggregate = assertThrows(ContentOperationException.class,
                () -> new ContentOutboxEvent(UUID.randomUUID(), "bad id!", "content_version", "1001",
                        "content.version.created.v1", "content.event.v1", 1, "actor-1", "dedupe",
                        "{\"a\":1}", "req-1", "0123456789abcdef0123456789abcdef",
                        Instant.parse("2026-08-22T00:00:00Z")));
        assertEquals("EVENT_ID_INVALID", invalidAggregate.code());
    }

    @Test
    @DisplayName("UUID event ids are accepted by the outbox envelope")
    void outboxEventAcceptsUuid() {
        ContentOutboxEvent event = new ContentOutboxEvent(
                UUID.randomUUID(), "content", "content_version", "1001",
                "content.version.created.v1", "content.event.v1", 1, "actor-1", "dedupe-x",
                "{\"a\":1}", "req-1", "0123456789abcdef0123456789abcdef",
                Instant.parse("2026-08-22T00:00:00Z"));
        assertEquals("content.event.v1", event.schemaVersion());
    }
}
