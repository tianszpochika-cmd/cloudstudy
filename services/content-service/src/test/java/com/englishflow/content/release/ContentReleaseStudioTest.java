package com.englishflow.content.release;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.englishflow.content.domain.ContentActor;
import com.englishflow.content.domain.ContentOperationException;

import java.nio.file.Path;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.junit.jupiter.api.Test;

class ContentReleaseStudioTest {

    private final ContentReleaseStudio studio = new ContentReleaseStudio();

    @Test
    void failedCreateLeavesNoGhostDraft() {
        assertEquals(400, studio.handle(editor(), "RELEASE_CREATE", "it6-one", Map.of("title", " ", "idempotencyKey", "c1")).status());
        assertEquals(0, measured("RELEASE_DRAFT_COUNT", "board-empty"));
        ContentReleaseStudio.Stored created = studio.handle(editor(), "RELEASE_CREATE", "it6-one",
                Map.of("title", "第一课", "idempotencyKey", "c2"));
        assertEquals(202, created.status());
        assertEquals(1, data(created).get("versionNumber"));
        assertEquals(false, data(created).get("ghost"));
        assertEquals(1, measured("RELEASE_DRAFT_COUNT", "board-one"));
    }

    @Test
    void staleEditKeepsTheStoredTitle() {
        createReadyDraft("it6-edit");
        ContentReleaseStudio.Stored conflict = studio.handle(editor(), "RELEASE_EDIT", "it6-edit",
                Map.of("expectedStateVersion", 9, "title", "旧标题", "idempotencyKey", "e2"));
        assertEquals(409, conflict.status());
        assertEquals("第一课", error(conflict).get("latestTitle"));
        assertEquals("旧标题", error(conflict).get("uncommitted"));
        assertEquals(false, error(conflict).get("overwritten"));
    }

    @Test
    void denialDoesNotChangeWhenTheCodeExists() {
        createReadyDraft("it6-secret");
        ContentReleaseStudio.Stored known = studio.handle(learner(), "RELEASE_EDIT", "it6-secret",
                Map.of("expectedStateVersion", 1, "title", "偷看", "idempotencyKey", "d1"));
        ContentReleaseStudio.Stored unknown = studio.handle(learner(), "RELEASE_EDIT", "missing-code",
                Map.of("expectedStateVersion", 1, "title", "偷看", "idempotencyKey", "d2"));
        assertEquals(known.body(), unknown.body());
        assertEquals(403, known.status());
        assertFalse(known.body().toString().contains("第一课"));
    }

    @Test
    void submitListsEveryGapAtOnce() {
        studio.handle(editor(), "RELEASE_CREATE", "it6-gaps",
                Map.of("title", "听力", "kind", "LISTENING", "idempotencyKey", "g1"));
        ContentReleaseStudio.Stored submit = studio.handle(editor(), "RELEASE_SUBMIT", "it6-gaps", Map.of("idempotencyKey", "g2"));
        assertEquals(409, submit.status());
        assertEquals(3, gaps(submit).size());
    }

    @Test
    void simpleModeDoesNotRecordASecondReview() {
        prepare("it6-simple");
        ContentReleaseStudio.Stored review = studio.handle(reviewerOne(), "RELEASE_REVIEW_L1", "it6-simple", Map.of("idempotencyKey", "s1"));
        assertEquals(409, review.status());
        assertEquals("SIMPLE_NO_SECOND_SIGNATURE", error(review).get("code"));
        ContentReleaseStudio.Stored published = publish("it6-simple", editor(), "s2");
        assertEquals(false, data(published).get("secondSignaturePresent"));
        assertEquals(0, data(published).get("reviewRecords"));
        assertEquals(false, data(published).get("visibleNow"));
        assertTrue(studio.learnerCards().isEmpty());
    }

    @Test
    void dualReviewRejectsTheEditorAndDeduplicatesTheFinalReview() {
        studio.handle(publisher(), "RELEASE_MODE", "release-mode", Map.of("mode", "DUAL", "idempotencyKey", "m1"));
        createReadyDraft("it6-dual");
        bind("it6-dual", 1, "DUAL");
        assertEquals(202, studio.handle(editor(), "RELEASE_SUBMIT", "it6-dual", Map.of("idempotencyKey", "sub")).status());
        ContentActor editingReviewer = new ContentActor("editor-1", "platform", Set.of("content-editor", "review-l1"),
                Set.of("content:write", "content:review:first"), false);
        assertEquals(409, studio.handle(editingReviewer, "RELEASE_REVIEW_L1", "it6-dual", Map.of("idempotencyKey", "r1")).status());
        assertEquals(200, studio.handle(reviewerOne(), "RELEASE_REVIEW_L1", "it6-dual", Map.of("idempotencyKey", "r2")).status());
        assertEquals(409, studio.handle(reviewerOne(), "RELEASE_REVIEW_L2", "it6-dual", Map.of("idempotencyKey", "r3")).status());
        ContentReleaseStudio.Stored first = studio.handle(reviewerTwo(), "RELEASE_REVIEW_L2", "it6-dual", Map.of("idempotencyKey", "r4"));
        ContentReleaseStudio.Stored replay = studio.handle(reviewerTwo(), "RELEASE_REVIEW_L2", "it6-dual", Map.of("idempotencyKey", "r5"));
        assertEquals(2, data(first).get("reviewRecords"));
        assertEquals(2, data(replay).get("reviewRecords"));
        assertEquals(409, studio.handle(editor(), "RELEASE_PUBLISH", "it6-dual", Map.of("idempotencyKey", "r6")).status());
        ContentReleaseStudio.Stored published = publish("it6-dual", publisher(), "r7");
        assertEquals(true, data(published).get("secondSignaturePresent"));
        assertEquals("PUBLISHING", data(published).get("catalogState"));
    }

    @Test
    void catalogSyncFailureStaysHiddenAndSuccessBecomesReadable() {
        prepare("it6-catalog");
        publish("it6-catalog", editor(), "p1");
        ContentReleaseStudio.Stored failed = studio.handle(editor(), "RELEASE_SYNC", "it6-catalog",
                Map.of("outcome", "FAILED", "idempotencyKey", "p2"));
        assertEquals("SYNC_FAILED", data(failed).get("catalogState"));
        assertTrue(studio.learnerCards().isEmpty());
        prepare("it6-live");
        publish("it6-live", editor(), "p3");
        studio.handle(editor(), "RELEASE_SYNC", "it6-live", Map.of("idempotencyKey", "p4"));
        assertEquals("it6-live", studio.learnerCards().get(0).get("contentCode"));
    }

    @Test
    void pinnedVersionSurvivesANewerPublishUntilForceOffline() {
        prepare("it6-pin");
        publish("it6-pin", editor(), "u1");
        studio.handle(editor(), "RELEASE_SYNC", "it6-pin", Map.of("idempotencyKey", "u2"));
        studio.handle(editor(), "RELEASE_CREATE", "it6-pin", Map.of("title", "第二课", "idempotencyKey", "u3"));
        bind("it6-pin", 2, "SIMPLE");
        publish("it6-pin", editor(), "u4");
        studio.handle(editor(), "RELEASE_SYNC", "it6-pin", Map.of("idempotencyKey", "u5"));
        studio.handle(editor(), "RELEASE_PIN", "it6-pin", Map.of("versionNumber", 1, "idempotencyKey", "u6"));
        assertTrue(String.valueOf(studio.learnerCards().get(0).get("summary")).contains("已锁定的第 1 版"));
        assertEquals("第一课", studio.learnerCards().get(0).get("title"));
    }

    @Test
    void forceOfflineStopsThePinnedVersionAndTheNewerPublish() {
        prepare("it6-pin-force");
        publish("it6-pin-force", editor(), "pf1");
        studio.handle(editor(), "RELEASE_SYNC", "it6-pin-force", Map.of("idempotencyKey", "pf2"));
        studio.handle(editor(), "RELEASE_CREATE", "it6-pin-force", Map.of("title", "第二课", "idempotencyKey", "pf3"));
        bind("it6-pin-force", 2, "SIMPLE");
        publish("it6-pin-force", editor(), "pf4");
        studio.handle(editor(), "RELEASE_SYNC", "it6-pin-force", Map.of("idempotencyKey", "pf5"));
        studio.handle(editor(), "RELEASE_PIN", "it6-pin-force", Map.of("versionNumber", 1, "idempotencyKey", "pf6"));
        ContentReleaseStudio.Stored force = studio.handle(editor(), "RELEASE_FORCE_OFFLINE", "it6-pin-force",
                Map.of("reason", "停止分发", "idempotencyKey", "pf7"));
        assertEquals("FORCE_OFFLINE", data(force).get("catalogState"));
        assertEquals("SESSION_AND_MEDIA", data(force).get("unpublishScope"));
        assertTrue(studio.learnerCards().stream().noneMatch(card -> "it6-pin-force".equals(card.get("contentCode"))));
        ContentOperationException denied = assertThrows(ContentOperationException.class,
                () -> studio.learnerRead("it6-pin-force", null));
        assertEquals("CONTENT_FORCE_OFFLINE", denied.code());
        ContentOperationException pinned = assertThrows(ContentOperationException.class,
                () -> studio.learnerRead("it6-pin-force", 1L));
        assertEquals("CONTENT_FORCE_OFFLINE", pinned.code());
    }

    @Test
    void normalUnpublishKeepsTheOldReadAndForceStopsIt() {
        prepare("it6-off");
        publish("it6-off", editor(), "off1");
        studio.handle(editor(), "RELEASE_SYNC", "it6-off", Map.of("idempotencyKey", "off2"));
        ContentReleaseStudio.Stored normal = studio.handle(editor(), "RELEASE_UNPUBLISH", "it6-off",
                Map.of("reason", "普通收回", "idempotencyKey", "off3"));
        assertEquals("UNPUBLISHED", data(normal).get("catalogState"));
        assertEquals("CATALOG", data(normal).get("unpublishScope"));
        assertTrue(studio.learnerRead("it6-off", 1L).isPresent());
        prepare("it6-force");
        publish("it6-force", editor(), "off4");
        studio.handle(editor(), "RELEASE_SYNC", "it6-force", Map.of("idempotencyKey", "off5"));
        ContentReleaseStudio.Stored force = studio.handle(editor(), "RELEASE_FORCE_OFFLINE", "it6-force",
                Map.of("reason", "停止分发", "idempotencyKey", "off6"));
        assertEquals("FORCE_OFFLINE", data(force).get("catalogState"));
        ContentOperationException denied = assertThrows(ContentOperationException.class,
                () -> studio.learnerRead("it6-force", 1L));
        assertEquals("CONTENT_FORCE_OFFLINE", denied.code());
    }

    @Test
    void rollbackRejectsAForcedVersion() {
        prepare("it6-roll");
        publish("it6-roll", editor(), "b1");
        studio.handle(editor(), "RELEASE_SYNC", "it6-roll", Map.of("idempotencyKey", "b2"));
        studio.handle(editor(), "RELEASE_FORCE_OFFLINE", "it6-roll", Map.of("reason", "停止", "idempotencyKey", "b3"));
        ContentReleaseStudio.Stored rollback = studio.handle(editor(), "RELEASE_ROLLBACK", "it6-roll",
                Map.of("versionNumber", 1, "idempotencyKey", "b4"));
        assertEquals(409, rollback.status());
        assertEquals("ROLLBACK_INELIGIBLE", error(rollback).get("code"));
    }

    @Test
    void rightsAndReportMustMatchTheVersionAndMode() {
        studio.handle(editor(), "RELEASE_CREATE", "it6-bind", Map.of("title", "绑定", "idempotencyKey", "bind1"));
        assertEquals(409, studio.handle(editor(), "RELEASE_BIND_RIGHTS", "it6-bind",
                Map.of("copyrightRef", "proposal-only", "versionNumber", 9, "idempotencyKey", "bind2")).status());
        studio.handle(publisher(), "RELEASE_MODE", "release-mode", Map.of("mode", "DUAL", "idempotencyKey", "bind3"));
        assertEquals(409, studio.handle(editor(), "RELEASE_BIND_REPORT", "it6-bind",
                Map.of("reportRef", "report-1", "reportMode", "SIMPLE", "versionNumber", 1, "idempotencyKey", "bind4")).status());
    }

    @Test
    void historicalRosterIsCheckedAndNotMutated() {
        Map<String, Object> check = ContentReleaseStudio.historicalB3(
                Path.of("src/main/resources/db/migration/V23__unpublish_unbound_legacy_content.sql"), false);
        assertEquals(113, check.get("experienceCount"));
        assertEquals(115, check.get("listedCount"));
        assertEquals(true, check.get("rosterMatches113Plus2"));
        assertEquals(false, check.get("mutated"));
        assertEquals("NOT_REPLAYABLE", check.get("status"));
    }

    @Test
    void dashboardSeparatesZeroEmptyComputingAndFailure() {
        assertEquals("ZERO", metric(studio, "").get("state"));
        assertEquals(0, metric(studio, "").get("value"));
        assertEquals("EMPTY", metric(studio, "EMPTY").get("state"));
        assertEquals(null, metric(studio, "EMPTY").get("value"));
        assertEquals("COMPUTING", metric(studio, "COMPUTING").get("state"));
        assertEquals(null, metric(studio, "FAILED").get("value"));
        assertEquals("读取失败", metric(studio, "FAILED").get("text"));
    }

    @Test
    void disconnectedMediaCannotLookPublishable() {
        studio.handle(editor(), "RELEASE_CREATE", "it6-media",
                Map.of("title", "听力", "kind", "LISTENING", "idempotencyKey", "media1"));
        ContentReleaseStudio.Stored boundary = studio.handle(editor(), "RELEASE_MEDIA", "it6-media", Map.of("idempotencyKey", "media2"));
        assertEquals(false, data(boundary).get("bytesConnected"));
        assertEquals(false, data(boundary).get("publishable"));
        assertTrue(String.valueOf(data(boundary).get("message")).contains("对象字节还没有接上"));
    }

    private ContentReleaseStudio.Stored createReadyDraft(String code) {
        return studio.handle(editor(), "RELEASE_CREATE", code, Map.of("title", "第一课", "idempotencyKey", code + "-create"));
    }

    private void prepare(String code) {
        createReadyDraft(code);
        bind(code, 1, "SIMPLE");
    }

    private void bind(String code, int version, String reportMode) {
        studio.handle(editor(), "RELEASE_BIND_RIGHTS", code, Map.of(
                "copyrightRef", "rights-" + code, "versionNumber", version, "idempotencyKey", code + "-rights-" + version));
        studio.handle(editor(), "RELEASE_BIND_REPORT", code, Map.of(
                "reportRef", "report-" + code, "reportMode", reportMode, "versionNumber", version,
                "idempotencyKey", code + "-report-" + version));
    }

    private ContentReleaseStudio.Stored publish(String code, ContentActor actor, String key) {
        return studio.handle(actor, "RELEASE_PUBLISH", code, Map.of("idempotencyKey", key));
    }

    private int measured(String code, String key) {
        ContentReleaseStudio.Stored board = studio.handle(editor(), "RELEASE_DASHBOARD", "dashboard", Map.of("idempotencyKey", key));
        List<Map<String, Object>> metrics = cast(data(board).get("metrics"));
        for (Map<String, Object> metric : metrics) {
            if (code.equals(metric.get("metricCode"))) {
                return ((Number) metric.get("value")).intValue();
            }
        }
        throw new AssertionError(code);
    }

    private static Map<String, Object> metric(ContentReleaseStudio studio, String probe) {
        ContentReleaseStudio.Stored board = studio.handle(editor(), "RELEASE_DASHBOARD", "dashboard",
                Map.of("probe", probe, "idempotencyKey", "probe-" + probe));
        return cast(data(board).get("metrics")).get(0);
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> data(ContentReleaseStudio.Stored stored) {
        return (Map<String, Object>) stored.body().get("data");
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> error(ContentReleaseStudio.Stored stored) {
        return (Map<String, Object>) stored.body().get("error");
    }

    @SuppressWarnings("unchecked")
    private static List<Map<String, String>> gaps(ContentReleaseStudio.Stored stored) {
        return (List<Map<String, String>>) error(stored).get("gaps");
    }

    @SuppressWarnings("unchecked")
    private static List<Map<String, Object>> cast(Object value) {
        return (List<Map<String, Object>>) value;
    }

    private static ContentActor editor() {
        return new ContentActor("editor-1", "platform", Set.of("content-editor", "content-publisher"),
                Set.of("content:write", "content:publish"), false);
    }

    private static ContentActor publisher() {
        return new ContentActor("publisher-1", "platform", Set.of("content-publisher"), Set.of("content:publish"), false);
    }

    private static ContentActor reviewerOne() {
        return new ContentActor("reviewer-1", "platform", Set.of("review-l1", "review-l2"),
                Set.of("content:review:first", "content:review:final"), false);
    }

    private static ContentActor reviewerTwo() {
        return new ContentActor("reviewer-2", "platform", Set.of("review-l2"), Set.of("content:review:final"), false);
    }

    private static ContentActor learner() {
        return new ContentActor("learner-1", "platform", Set.of("learner"), Set.of("learner.home.read"), false);
    }
}
