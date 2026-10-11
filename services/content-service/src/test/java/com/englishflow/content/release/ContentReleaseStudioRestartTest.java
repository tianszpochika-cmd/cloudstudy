package com.englishflow.content.release;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;

import com.englishflow.content.domain.ContentActor;

import java.util.Map;
import java.util.Set;

import org.junit.jupiter.api.Test;

import tools.jackson.databind.ObjectMapper;

class ContentReleaseStudioRestartTest {

    @Test
    void aNewInstanceKeepsTheSimpleReviewFingerprintWithoutReplaying() {
        MemoryReleaseStudioStore store = new MemoryReleaseStudioStore();
        ContentReleaseStudio first = new ContentReleaseStudio(store);
        simpleChain(first);
        String before = fingerprint(first);
        assertFalse(before.contains("fp-read"));

        ContentReleaseStudio second = new ContentReleaseStudio(store);
        assertEquals(before, fingerprint(second));
        assertEquals(202, second.handle(editor(), "RELEASE_CREATE", "it6-simple",
                Map.of("title", "第一课", "idempotencyKey", "simple-create")).status());
        assertEquals(before, fingerprint(second));
        assertEquals(true, before.contains("it6-simple#1\tPUBLISHED\tPUBLISHING\t"));
        assertEquals(true, before.contains("it6-simple=1"));
    }

    @Test
    void fingerprintIsReadOnlyAndSkipsTheIdempotencyCache() {
        ContentReleaseStudio studio = new ContentReleaseStudio();
        String before = fingerprint(studio);
        assertEquals(before, fingerprint(studio));
        assertEquals(202, studio.handle(editor(), "RELEASE_CREATE", "it6-fp",
                Map.of("title", "指纹", "idempotencyKey", "create-fp")).status());
        String after = fingerprint(studio);
        assertNotEquals(before, after);
        assertFalse(after.contains("fp-read"));
    }

    @Test
    void theOwnerDocumentRoundTripsThroughJsonForANewInstance() {
        JsonRoundTripStore store = new JsonRoundTripStore();
        ContentReleaseStudio first = new ContentReleaseStudio(store);
        dualChain(first);
        String before = fingerprint(first);

        ContentReleaseStudio second = new ContentReleaseStudio(store);
        assertEquals(before, fingerprint(second));
        ContentReleaseStudio.Stored replay = second.handle(reviewerTwo(), "RELEASE_REVIEW_L2", "it6-dual",
                Map.of("idempotencyKey", "dual-l2"));
        assertEquals(200, replay.status());
        assertEquals(2, data(replay).get("reviewRecords"));
        assertEquals(before, fingerprint(second));
        ContentReleaseStudio.Stored again = second.handle(reviewerTwo(), "RELEASE_REVIEW_L2", "it6-dual",
                Map.of("idempotencyKey", "dual-l2-again"));
        assertEquals(409, again.status());
        assertEquals("REVIEW_STATE_INVALID", error(again).get("code"));
        assertEquals(true, fingerprint(second).contains("it6-dual#1\tPUBLISHED\tPUBLISHING\t"));
    }

    private static void simpleChain(ContentReleaseStudio studio) {
        assertEquals(202, studio.handle(editor(), "RELEASE_CREATE", "it6-simple",
                Map.of("title", "第一课", "idempotencyKey", "simple-create")).status());
        bind(studio, "it6-simple", "SIMPLE");
        assertEquals(202, studio.handle(editor(), "RELEASE_PUBLISH", "it6-simple",
                Map.of("idempotencyKey", "simple-publish")).status());
        assertEquals(200, studio.handle(editor(), "RELEASE_PIN", "it6-simple",
                Map.of("versionNumber", 1, "idempotencyKey", "simple-pin")).status());
    }

    private static void dualChain(ContentReleaseStudio studio) {
        assertEquals(200, studio.handle(publisher(), "RELEASE_MODE", "release-mode",
                Map.of("mode", "DUAL", "idempotencyKey", "dual-mode")).status());
        assertEquals(202, studio.handle(editor(), "RELEASE_CREATE", "it6-dual",
                Map.of("title", "双签课", "idempotencyKey", "dual-create")).status());
        bind(studio, "it6-dual", "DUAL");
        assertEquals(202, studio.handle(editor(), "RELEASE_SUBMIT", "it6-dual",
                Map.of("idempotencyKey", "dual-submit")).status());
        assertEquals(200, studio.handle(reviewerOne(), "RELEASE_REVIEW_L1", "it6-dual",
                Map.of("idempotencyKey", "dual-l1")).status());
        assertEquals(200, studio.handle(reviewerTwo(), "RELEASE_REVIEW_L2", "it6-dual",
                Map.of("idempotencyKey", "dual-l2")).status());
        assertEquals(202, studio.handle(publisher(), "RELEASE_PUBLISH", "it6-dual",
                Map.of("idempotencyKey", "dual-publish")).status());
    }

    private static void bind(ContentReleaseStudio studio, String code, String reportMode) {
        assertEquals(200, studio.handle(editor(), "RELEASE_BIND_RIGHTS", code, Map.of(
                "copyrightRef", "rights-" + code, "versionNumber", 1, "idempotencyKey", code + "-rights")).status());
        assertEquals(200, studio.handle(editor(), "RELEASE_BIND_REPORT", code, Map.of(
                "reportRef", "report-" + code, "reportMode", reportMode, "versionNumber", 1,
                "idempotencyKey", code + "-report")).status());
    }

    private static String fingerprint(ContentReleaseStudio studio) {
        ContentReleaseStudio.Stored stored = studio.handle(editor(), "RELEASE_FINGERPRINT", "desk",
                Map.of("idempotencyKey", "fp-read"));
        assertEquals(200, stored.status());
        return String.valueOf(data(stored).get("fingerprint"));
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> data(ContentReleaseStudio.Stored stored) {
        return (Map<String, Object>) stored.body().get("data");
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> error(ContentReleaseStudio.Stored stored) {
        return (Map<String, Object>) stored.body().get("error");
    }

    private static ContentActor editor() {
        return new ContentActor("editor-1", "platform", Set.of("content-editor", "content-publisher"),
                Set.of("content:write", "content:publish"), false);
    }

    private static ContentActor publisher() {
        return new ContentActor("publisher-1", "platform", Set.of("content-publisher"),
                Set.of("content:publish"), false);
    }

    private static ContentActor reviewerOne() {
        return new ContentActor("reviewer-1", "platform", Set.of("review-l1", "review-l2"),
                Set.of("content:review:first", "content:review:final"), false);
    }

    private static ContentActor reviewerTwo() {
        return new ContentActor("reviewer-2", "platform", Set.of("review-l2"),
                Set.of("content:review:final"), false);
    }

    private static final class JsonRoundTripStore implements ReleaseStudioStore {
        private final ObjectMapper mapper = new ObjectMapper();
        private String json;

        @Override
        public ReleaseStudioState load() {
            if (json == null) {
                return ReleaseStudioState.empty();
            }
            return mapper.readValue(json, ReleaseStudioState.class);
        }

        @Override
        public void save(ReleaseStudioState state) {
            json = mapper.writeValueAsString(state == null ? ReleaseStudioState.empty() : state);
        }
    }
}
