package com.englishflow.content.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import com.englishflow.content.adapter.memory.InMemoryContentIdempotency;
import com.englishflow.content.adapter.memory.InMemoryContentItemRepository;
import com.englishflow.content.adapter.memory.InMemoryContentOutbox;
import com.englishflow.content.adapter.memory.InMemoryContentRepository;
import com.englishflow.content.adapter.memory.InMemoryLexemeRepository;
import com.englishflow.content.adapter.memory.InMemoryPublicProjectionStore;
import com.englishflow.content.adapter.memory.InMemoryScheduledPublishRepository;
import com.englishflow.content.adapter.memory.InMemoryValidationReportStore;
import com.englishflow.content.adapter.memory.RecordingContentCacheInvalidator;
import com.englishflow.content.domain.ContentActor;
import com.englishflow.content.domain.ContentId;
import com.englishflow.content.domain.ContentIdempotencyKey;
import com.englishflow.content.domain.ContentKind;
import com.englishflow.content.domain.ContentRequestContext;
import com.englishflow.content.domain.ContentRights;
import com.englishflow.content.domain.ContentVersionSnapshot;
import com.englishflow.content.domain.CopyrightStatus;
import com.englishflow.content.domain.ReviewDecision;
import com.englishflow.content.domain.ReviewStage;
import com.englishflow.content.domain.ScheduledPublishTask;
import com.englishflow.content.port.ScheduledPublishRepository;

/**
 * Executor hardening: one poisoned task must not abort the batch, and a PACK
 * pin guards the APPROVED version that will actually be published (not the
 * global max, which may already be a newer DRAFT).
 */
@DisplayName("ScheduledPublishExecutor batch resilience and pack pinning")
class ScheduledPublishExecutorResilienceTest {

    private static final Instant NOW = Instant.parse("2026-09-21T00:00:00Z");
    private static final Clock CLOCK = Clock.fixed(NOW, ZoneOffset.UTC);
    private static final ContentRequestContext REQUEST =
            new ContentRequestContext("req-exec-001", "0123456789abcdef0123456789abcdef");
    private static final String PACK = "VOCAB-PHASE1";

    private InMemoryScheduledPublishRepository store;
    private ScheduledPublishService schedules;
    private ScheduledPublishExecutor executor;
    private LexemeCommandService lexemes;
    private ContentCommandService contents;
    private InMemoryContentRepository contentRows;
    private final AtomicInteger keys = new AtomicInteger();

    @BeforeEach
    void setUp() {
        store = new InMemoryScheduledPublishRepository();
        InMemoryContentIdempotency idempotency = new InMemoryContentIdempotency();
        schedules = new ScheduledPublishService(store, idempotency, CLOCK);
        contentRows = new InMemoryContentRepository();
        InMemoryLexemeRepository lexemeRows = new InMemoryLexemeRepository();
        InMemoryContentOutbox outbox = new InMemoryContentOutbox();
        lexemes = new LexemeCommandService(contentRows, lexemeRows, outbox, idempotency, CLOCK);
        ContentItemCommandService items = new ContentItemCommandService(
                new InMemoryContentItemRepository(), outbox, idempotency, CLOCK);
        contents = new ContentCommandService(contentRows, outbox, idempotency,
                new InMemoryPublicProjectionStore(), new RecordingContentCacheInvalidator(),
                new InMemoryValidationReportStore(), CLOCK);
        executor = new ScheduledPublishExecutor(store, contentRows, contents, lexemes, items, CLOCK);
    }

    private ContentIdempotencyKey key() {
        return new ContentIdempotencyKey("exec-test-key-" + keys.incrementAndGet() + "-idempotency");
    }

    private static ContentActor editor() {
        return new ContentActor("editor-1", "platform", Set.of("content-editor"), Set.of("content:write"), false);
    }

    private static ContentActor publisher() {
        return new ContentActor("publisher-1", "platform", Set.of("content-publisher"), Set.of("content:publish"), false);
    }

    private static ContentActor reviewerL1() {
        return new ContentActor("reviewer-1", "platform", Set.of("review-l1"), Set.of("content:review:first"), false);
    }

    private static ContentActor reviewerL2() {
        return new ContentActor("reviewer-2", "platform", Set.of("review-l2"), Set.of("content:review:final"), false);
    }

    private static Map<String, Object> lexemeFields(String headword) {
        return Map.of(
                "headword", headword,
                "lemma", headword,
                "pos", List.of("NOUN"),
                "senses", List.of(Map.of("pos", "NOUN", "meaningCn", "含义")));
    }

    private String publishableLexeme(String headword) {
        LexemeCommandService.LexemeResult created =
                lexemes.upsert(PACK, lexemeFields(headword), null, editor(), key(), REQUEST);
        lexemes.submit(PACK, created.lexemeId(), editor(), key(), REQUEST);
        lexemes.reviewFirst(PACK, created.lexemeId(), ReviewDecision.APPROVED, reviewerL1(), key(), REQUEST);
        lexemes.reviewFinal(PACK, created.lexemeId(), ReviewDecision.APPROVED, reviewerL2(), key(), REQUEST);
        return created.lexemeId();
    }

    @Test
    void runtimeFailureOnOneTaskDoesNotAbortTheBatch() {
        String goodId = publishableLexeme("resilient");
        schedules.schedule(PACK, "LEXEME", "lx_missing_target", null, NOW.plusSeconds(60),
                "RELEASE", null, publisher(), key(), REQUEST);
        schedules.schedule(PACK, "LEXEME", goodId, null, NOW.plusSeconds(60),
                "RELEASE", null, publisher(), key(), REQUEST);

        AtomicBoolean poisoned = new AtomicBoolean(true);
        ScheduledPublishRepository flaky = new ScheduledPublishRepository() {
            @Override
            public Optional<ScheduledPublishTask> findById(String taskId) {
                return store.findById(taskId);
            }

            @Override
            public List<ScheduledPublishTask> listByPack(String packCode, int limit) {
                return store.listByPack(packCode, limit);
            }

            @Override
            public List<ScheduledPublishTask> dueTasks(Instant now, int limit) {
                return store.dueTasks(now, limit);
            }

            @Override
            public void save(ScheduledPublishTask task) {
                // Deterministic outage: only the poisoned task's failure record
                // cannot be persisted, whatever batch order the store returns.
                if (poisoned.get() && "lx_missing_target".equals(task.targetRef())) {
                    throw new IllegalStateException("simulated store outage");
                }
                store.save(task);
            }
        };
        ScheduledPublishExecutor underTest = new ScheduledPublishExecutor(
                flaky, contentRows, contents, lexemes,
                new ContentItemCommandService(new InMemoryContentItemRepository(),
                        new InMemoryContentOutbox(), new InMemoryContentIdempotency(), CLOCK),
                CLOCK);

        ScheduledPublishExecutor.ExecutionReport report = underTest.executeDue(NOW.plusSeconds(120));

        assertEquals(1, report.executed(), "the healthy task must still publish");
        assertEquals(1, report.failed(), "the poisoned task must be recorded as failed");
        assertTrue(store.listByPack(PACK, 50).stream()
                .filter(task -> goodId.equals(task.targetRef()))
                .allMatch(task -> "EXECUTED".equals(task.status())),
                "the healthy task must be EXECUTED");
        // The poisoned task's failure record could not be persisted (against a real
        // database it would stay SCHEDULED for the next tick); the report count is
        // the observable contract here, plus the batch was not aborted.
    }

    @Test
    void packPinGuardsTheApprovedVersionNotTheNewerDraft() {
        ContentId packId = ContentId.of("PACK-PIN-1");
        contents.createContent(new ContentCommandService.CreateContent(
                packId, "PACK-PIN-1", ContentKind.VOCABULARY, "Pin pack", "en-US", "A1", "PHASE1"),
                editor(), key(), REQUEST);
        ContentRights rights = new ContentRights("LOCAL_SRC", "LOCAL_LIC", CopyrightStatus.ACTIVE,
                true, Set.of("LEARNER", "PUBLIC"), NOW.minusSeconds(60), null, "evidence-1");
        Map<String, Object> payload = Map.of("summary", "v1", "contentLocale", "en-US",
                "targetLevel", "A1", "items", List.of(Map.of("displayText", "one")));
        ContentVersionSnapshot approved = contents.createVersion(
                new ContentCommandService.CreateVersion(packId, contentRows.nextVersionId(), payload, rights, "v1"),
                editor(), key(), REQUEST);
        contents.submitForReview(new ContentCommandService.VersionCommand(packId, approved.versionId()),
                editor(), key(), REQUEST);
        contents.review(new ContentCommandService.ReviewCommand(packId, approved.versionId(),
                ReviewStage.FIRST_REVIEW, ReviewDecision.APPROVED, "R", ""), reviewerL1(), key(), REQUEST);
        ContentVersionSnapshot reviewed = contents.review(new ContentCommandService.ReviewCommand(packId, approved.versionId(),
                ReviewStage.FINAL_REVIEW, ReviewDecision.APPROVED, "R", ""), reviewerL2(), key(), REQUEST);
        // A newer DRAFT revision moves the global max past the approved version.
        contents.createVersion(
                new ContentCommandService.CreateVersion(packId, contentRows.nextVersionId(), payload, rights, "v2"),
                editor(), key(), REQUEST);

        ScheduledPublishTask task = schedules.schedule("PACK-PIN-1", "PACK", "PACK-PIN-1",
                reviewed.stateVersion(), NOW.plusSeconds(60), "RELEASE", null, publisher(), key(), REQUEST);
        ScheduledPublishExecutor.ExecutionReport report = executor.executeDue(NOW.plusSeconds(120));

        assertEquals(1, report.executed(), "a pin matching the APPROVED version must publish despite the newer draft");
        assertEquals(0, report.failed());
        assertEquals("EXECUTED", store.findById(task.taskId()).orElseThrow().status());
    }
}
