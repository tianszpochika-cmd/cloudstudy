package com.englishflow.learning.domain;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class LearningPeriodReportTest {
    private static final Instant NOW = Instant.parse("2026-10-11T02:00:00Z");
    private static final LocalDate DAY = LocalDate.parse("2026-10-11");

    @Test
    void dailyWindowUsesShanghaiLearningDayAndKeepsStatesApart() {
        Map<String, Object> ready = LearningPeriodReport.compose("learner", "DAILY", DAY, DAY.plusDays(1),
                List.of(activity("a", "2026-10-10T16:30:00Z", "NEW", true, 90_000L, "ACTIVE")), NOW);
        assertEquals("READY", ready.get("availability"));
        assertEquals("Asia/Shanghai", ready.get("learningDayZone"));
        assertEquals("2026-10-11", ready.get("periodStart"));
        assertEquals("2026-10-12", ready.get("periodEndExclusive"));
        assertEquals(NOW.toString(), ready.get("updatedAt"));

        Map<String, Object> generating = LearningPeriodReport.compose("learner", "DAILY", DAY, DAY.plusDays(1),
                List.of(activity("g", "2026-10-11T01:00:00Z", "NEW", null, null, "GENERATING")), NOW);
        assertEquals("GENERATING", generating.get("availability"));
        assertNull(generating.get("newItems"));

        Map<String, Object> failed = LearningPeriodReport.failed("DAILY", DAY, DAY.plusDays(1), NOW);
        assertEquals("FAILED", failed.get("availability"));
        assertNull(failed.get("accuracy"));
    }

    @Test
    void onlyRecordedActiveTimeCounts() {
        Map<String, Object> counted = LearningPeriodReport.compose("learner", "DAILY", DAY, DAY.plusDays(1), List.of(
                activity("play", "2026-10-11T01:00:00Z", "NEW", true, 30_000L, "ACTIVE"),
                activity("pause", "2026-10-11T01:01:00Z", "NEW", true, 600_000L, "PAUSE"),
                activity("back", "2026-10-11T01:02:00Z", "REVIEW", false, 600_000L, "BACKGROUND")), NOW);
        assertEquals("COUNTED", counted.get("durationStatus"));
        assertEquals(30_000L, counted.get("activeMillis"));
        assertEquals(LearningPeriodReport.DURATION_COUNTED, counted.get("durationCopy"));

        Map<String, Object> missing = LearningPeriodReport.compose("learner", "DAILY", DAY, DAY.plusDays(1),
                List.of(activity("plain", "2026-10-11T01:00:00Z", "NEW", true, null, "ACTIVE")), NOW);
        assertEquals("NOT_RECORDED", missing.get("durationStatus"));
        assertNull(missing.get("activeMillis"));
        assertEquals(LearningPeriodReport.DURATION_MISSING, missing.get("durationCopy"));
    }

    @Test
    void oneActivityIsNotBothNewAndReview() {
        Map<String, Object> once = LearningPeriodReport.compose("learner", "WEEKLY",
                DAY.minusDays(6), DAY.plusDays(1), List.of(
                        activity("same", "2026-10-11T01:00:00Z", "NEW", true, 1_000L, "ACTIVE"),
                        activity("same", "2026-10-11T01:05:00Z", "REVIEW", false, 9_000L, "ACTIVE")), NOW);
        assertEquals(0, once.get("newItems"));
        assertEquals(1, once.get("reviewItems"));
        assertEquals(1_000L, once.get("activeMillis"));
        assertEquals("MISTAKES", once.get("suggestionBasis"));
        assertFalse(String.valueOf(once.get("suggestion")).contains("AI"));
        assertEquals("RULE", once.get("suggestionSource"));
    }

    @Test
    void shareLinkIsUnguessableReadOnlyAndRevocable() {
        Map<String, Object> report = LearningPeriodReport.compose("learner", "DAILY", DAY, DAY.plusDays(1),
                List.of(activity("a", "2026-10-11T01:00:00Z", "REVIEW", true, null, "ACTIVE")), NOW);
        assertThrows(IllegalArgumentException.class, () -> LearningPeriodReport.issue(report, "1", NOW));
        Map<String, Object> share = LearningPeriodReport.issue(report, "ab".repeat(16), NOW);
        Map<String, Object> open = LearningPeriodReport.publicView(share, NOW);
        assertEquals("ACTIVE", open.get("status"));
        assertFalse(open.containsKey("subject"));
        assertFalse(open.containsKey("token"));
        assertEquals("REVOKED", LearningPeriodReport.publicView(LearningPeriodReport.revoke(share, NOW), NOW).get("status"));
        assertEquals("EXPIRED", LearningPeriodReport.publicView(share, NOW.plus(java.time.Duration.ofDays(8))).get("status"));
    }

    @Test
    void neverStudiedIsNotAZeroScoreAndUnreadIsSeparate() {
        Map<String, Object> never = LearningPeriodReport.compose("learner", "DAILY", DAY, DAY.plusDays(1), List.of(), NOW);
        assertEquals("NEVER_STUDIED", never.get("availability"));
        assertEquals(LearningPeriodReport.NEVER_COPY, never.get("copy"));
        assertNull(never.get("newItems"));
        assertNull(never.get("accuracy"));
        assertEquals(false, never.get("officialScore"));

        Map<String, Object> unread = LearningPeriodReport.unread("DAILY", DAY, DAY.plusDays(1), NOW);
        assertEquals("NOT_READY", unread.get("availability"));
        assertEquals(LearningPeriodReport.NOT_READY_COPY, unread.get("copy"));

        Map<String, Object> empty = LearningPeriodReport.compose("learner", "DAILY", DAY, DAY.plusDays(1),
                List.of(activity("old", "2026-09-01T01:00:00Z", "NEW", true, 1L, "ACTIVE")), NOW);
        assertEquals("EMPTY", empty.get("availability"));
        assertNull(empty.get("accuracy"));
    }

    @Test
    void sealedHistoryIsNotRewrittenWhenACorrectionIsIssued() {
        Map<String, Object> open = LearningPeriodReport.compose("learner", "DAILY", DAY, DAY.plusDays(1), List.of(), NOW);
        assertThrows(IllegalStateException.class, () -> LearningPeriodReport.correct(open, open));
        Map<String, Object> sealed = LearningPeriodReport.seal(open);
        String originalCopy = String.valueOf(sealed.get("copy"));
        String originalDigest = String.valueOf(sealed.get("digest"));
        Map<String, Object> next = LearningPeriodReport.compose("learner", "DAILY", DAY, DAY.plusDays(1),
                List.of(activity("later", "2026-10-11T03:00:00Z", "NEW", true, 1L, "ACTIVE")), NOW);
        Map<String, Object> pair = LearningPeriodReport.correct(sealed, next);
        Map<?, ?> previous = (Map<?, ?>) pair.get("previous");
        Map<?, ?> current = (Map<?, ?>) pair.get("current");
        assertEquals(originalCopy, previous.get("copy"));
        assertEquals(originalDigest, previous.get("digest"));
        assertEquals(1, previous.get("reportVersion"));
        assertEquals(2, current.get("reportVersion"));
        assertEquals(1, current.get("previousVersion"));
        assertEquals(sealed.get("reportId"), current.get("supersedes"));
    }

    @Test
    void emptyLibraryReplaysTheSameDigest() {
        Map<String, Object> first = LearningPeriodReport.compose("learner", "DAILY", DAY, DAY.plusDays(1), List.of(), NOW);
        Map<String, Object> second = LearningPeriodReport.compose("learner", "DAILY", DAY, DAY.plusDays(1), List.of(), NOW);
        assertEquals(first.get("digest"), second.get("digest"));
        assertEquals("NEVER_STUDIED", second.get("availability"));
        assertTrue(String.valueOf(second.get("digest")).length() == 64);
    }

    private static LearningPeriodReport.Activity activity(
            String id, String at, String lane, Boolean correct, Long activeMillis, String segment) {
        return new LearningPeriodReport.Activity(id, Instant.parse(at), lane, correct, activeMillis, segment);
    }
}
