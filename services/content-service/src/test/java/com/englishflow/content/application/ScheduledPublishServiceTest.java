package com.englishflow.content.application;

import com.englishflow.content.adapter.memory.InMemoryContentIdempotency;
import com.englishflow.content.adapter.memory.InMemoryContentItemRepository;
import com.englishflow.content.adapter.memory.InMemoryContentOutbox;
import com.englishflow.content.adapter.memory.InMemoryContentRepository;
import com.englishflow.content.adapter.memory.InMemoryLexemeRepository;
import com.englishflow.content.adapter.memory.InMemoryScheduledPublishRepository;
import com.englishflow.content.adapter.memory.InMemoryPublicProjectionStore;
import com.englishflow.content.adapter.memory.RecordingContentCacheInvalidator;
import com.englishflow.content.domain.ContentActor;
import com.englishflow.content.domain.ContentIdempotencyKey;
import com.englishflow.content.domain.ContentOperationException;
import com.englishflow.content.domain.ContentRequestContext;
import com.englishflow.content.domain.ScheduledPublishTask;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

/** B2 schedule tests: task lifecycle, stale-pin failure and due execution. */
@DisplayName("ScheduledPublishService task lifecycle and execution")
class ScheduledPublishServiceTest {

    private static final Instant NOW = Instant.parse("2026-09-21T00:00:00Z");
    private static final Clock CLOCK = Clock.fixed(NOW, ZoneOffset.UTC);
    private static final ContentRequestContext REQUEST =
            new ContentRequestContext("req-sched-001", "0123456789abcdef0123456789abcdef");
    private static final String PACK = "VOCAB-PHASE1";

    private InMemoryScheduledPublishRepository tasks;
    private ScheduledPublishService schedules;
    private ScheduledPublishExecutor executor;
    private LexemeCommandService lexemes;
    private final AtomicInteger keys = new AtomicInteger();

    @BeforeEach
    void setUp() {
        tasks = new InMemoryScheduledPublishRepository();
        InMemoryContentIdempotency idempotency = new InMemoryContentIdempotency();
        schedules = new ScheduledPublishService(tasks, idempotency, CLOCK);
        InMemoryContentRepository contents = new InMemoryContentRepository();
        InMemoryLexemeRepository lexemeRows = new InMemoryLexemeRepository();
        InMemoryContentOutbox outbox = new InMemoryContentOutbox();
        lexemes = new LexemeCommandService(contents, lexemeRows, outbox, idempotency, CLOCK);
        ContentItemCommandService items = new ContentItemCommandService(
                new InMemoryContentItemRepository(), outbox, idempotency, CLOCK);
        executor = new ScheduledPublishExecutor(tasks, contents,
                new ContentCommandService(contents, outbox, idempotency,
                        new InMemoryPublicProjectionStore(), new RecordingContentCacheInvalidator(), CLOCK),
                lexemes, items, CLOCK);
    }

    private ContentIdempotencyKey key() {
        return new ContentIdempotencyKey("sched-test-key-" + keys.incrementAndGet() + "-idempotency");
    }

    private static ContentActor publisher() {
        return new ContentActor("publisher-1", "platform", Set.of("content-publisher"), Set.of("content:publish"), false);
    }

    private static ContentActor editor() {
        return new ContentActor("editor-1", "platform", Set.of("content-editor"), Set.of("content:write"), false);
    }

    @Test
    void pastRunAtIsRejected() {
        assertThrows(ContentOperationException.class, () -> schedules.schedule(
                PACK, "LEXEME", "lx_x", null, NOW.minusSeconds(60), "RELEASE", null,
                publisher(), key(), REQUEST));
    }

    @Test
    void cancelClosesScheduledTask() {
        ScheduledPublishTask task = schedules.schedule(
                PACK, "LEXEME", "lx_x", null, NOW.plusSeconds(3600), "RELEASE", null,
                publisher(), key(), REQUEST);
        assertEquals("SCHEDULED", task.status());
        ScheduledPublishTask cancelled = schedules.cancel(task.taskId(), publisher(), key(), REQUEST);
        assertEquals("CANCELLED", cancelled.status());
        assertThrows(ContentOperationException.class,
                () -> schedules.cancel(task.taskId(), publisher(), key(), REQUEST));
    }

    @Test
    void stalePinFailsExecutionInsteadOfPublishing() {
        LexemeCommandService.LexemeResult created = lexemes.upsert(
                PACK, Map.of("headword", "habit"), null, editor(), key(), REQUEST);
        ScheduledPublishTask task = schedules.schedule(
                PACK, "LEXEME", created.lexemeId(), 999L, NOW.plusSeconds(1), "RELEASE", null,
                publisher(), key(), REQUEST);
        ScheduledPublishExecutor.ExecutionReport report =
                executor.executeDue(task.runAt().plusSeconds(5));
        assertEquals(0, report.executed());
        assertEquals(1, report.failed());
        assertEquals("FAILED", tasks.findById(task.taskId()).orElseThrow().status());
    }

    @Test
    void packWithoutApprovedVersionFailsExecution() {
        ScheduledPublishTask task = schedules.schedule(
                PACK, "PACK", PACK, null, NOW.plusSeconds(1), "RELEASE", "BETA",
                publisher(), key(), REQUEST);
        assertEquals("BETA", tasks.findById(task.taskId()).orElseThrow().cohort());
        ScheduledPublishExecutor.ExecutionReport report =
                executor.executeDue(task.runAt().plusSeconds(5));
        assertEquals(0, report.executed());
        assertEquals(1, report.failed());
    }
}
