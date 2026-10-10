package com.englishflow.learning.domain;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Daily and weekly report built only from learning-owned activity facts.
 * A skipped placement is not this report. Counts are not a formal score.
 */
public final class LearningPeriodReport {
    public static final String RULE = "P1_PERIOD_REPORT_V1";
    public static final ZoneId LEARNING_DAY = ZoneId.of("Asia/Shanghai");
    public static final String NEVER_COPY = "还没有开始学习。这不是能力评分。";
    public static final String NOT_READY_COPY = "统计还没准备好，请稍后刷新。";
    public static final String EMPTY_COPY = "这段时间还没有学习记录。";
    public static final String GENERATING_COPY = "报告还在生成。";
    public static final String PARTIAL_COPY = "这部分统计还不完整。";
    public static final String FAILED_COPY = "报告没有生成，请稍后刷新。";
    public static final String DURATION_MISSING = "有效时长还没有记录，不会用间隔冒充。";
    public static final String DURATION_COUNTED = "只统计已记录的有效学习时段。暂停和后台停留没有计入。";

    private LearningPeriodReport() {
    }

    public record Activity(
            String id,
            Instant at,
            String lane,
            Boolean correct,
            Long activeMillis,
            String segment) {
    }

    public static Map<String, Object> unread(String reportType, LocalDate start, LocalDate end, Instant asOf) {
        return shell(reportType, start, end, asOf, "NOT_READY", NOT_READY_COPY, null, null, null, "NOT_RECORDED", DURATION_MISSING,
                "统计准备好之后，再按今日任务起步。", "NOT_READY", false);
    }

    public static Map<String, Object> failed(String reportType, LocalDate start, LocalDate end, Instant asOf) {
        return shell(reportType, start, end, asOf, "FAILED", FAILED_COPY, null, null, null, "NOT_RECORDED", DURATION_MISSING,
                "报告没有生成，先不要把它当成学习结果。", "FAILED", false);
    }

    public static Map<String, Object> compose(
            String subject,
            String reportType,
            LocalDate start,
            LocalDate end,
            List<Activity> activities,
            Instant asOf) {
        if (activities == null) return unread(reportType, start, end, asOf);
        if (activities.isEmpty()) {
            return shell(reportType, start, end, asOf, "NEVER_STUDIED", NEVER_COPY, null, null, null, "NOT_RECORDED",
                    DURATION_MISSING, "先完成一次练习，再看建议。", "START", false);
        }
        boolean generating = false;
        boolean partial = false;
        List<Activity> inWindow = new ArrayList<>();
        for (Activity activity : activities) {
            if (activity == null || activity.at == null) {
                partial = true;
                continue;
            }
            LocalDate day = activity.at.atZone(LEARNING_DAY).toLocalDate();
            if (day.isBefore(start) || !day.isBefore(end)) continue;
            if ("GENERATING".equals(activity.segment)) {
                generating = true;
                continue;
            }
            inWindow.add(activity);
        }
        if (generating && inWindow.isEmpty()) {
            return shell(reportType, start, end, asOf, "GENERATING", GENERATING_COPY, null, null, null, "NOT_RECORDED",
                    DURATION_MISSING, "报告生成后再看建议。", "GENERATING", false);
        }
        if (inWindow.isEmpty() && !partial) {
            return shell(reportType, start, end, asOf, "EMPTY", EMPTY_COPY, 0, 0, null, "NOT_RECORDED",
                    DURATION_MISSING, "这段时间没有新的练习记录。", "EMPTY_WINDOW", false);
        }
        Map<String, Activity> once = new LinkedHashMap<>();
        for (Activity activity : inWindow) {
            if (activity.id == null || activity.id.isBlank() || lane(activity.lane) == null) {
                partial = true;
                continue;
            }
            Activity prior = once.get(activity.id);
            once.put(activity.id, prior == null ? activity : merge(prior, activity));
        }
        int newItems = 0;
        int reviewItems = 0;
        int graded = 0;
        int correct = 0;
        long activeMillis = 0;
        boolean durationRecorded = false;
        for (Activity activity : once.values()) {
            if ("REVIEW".equals(lane(activity.lane))) reviewItems += 1;
            else newItems += 1;
            if (activity.correct != null) {
                graded += 1;
                if (activity.correct) correct += 1;
            }
            if (isPaused(activity.segment)) continue;
            if (activity.activeMillis != null && activity.activeMillis >= 0) {
                durationRecorded = true;
                activeMillis += activity.activeMillis;
            }
        }
        String availability = partial || generating ? "PARTIAL" : "READY";
        String copy = "PARTIAL".equals(availability) ? PARTIAL_COPY : "这段统计来自已记录的学习活动。";
        Integer accuracy = graded == 0 ? null : (int) Math.round(correct * 100.0 / graded);
        String durationStatus = durationRecorded ? "COUNTED" : "NOT_RECORDED";
        Long shownMillis = durationRecorded ? activeMillis : null;
        String suggestion = suggestion(availability, newItems, reviewItems, graded, correct);
        String basis = basis(availability, newItems, reviewItems, graded, correct);
        Map<String, Object> body = shell(reportType, start, end, asOf, availability, copy, newItems, reviewItems,
                accuracy, durationStatus, durationRecorded ? DURATION_COUNTED : DURATION_MISSING, suggestion, basis, true);
        body.put("activeMillis", shownMillis);
        body.put("reportId", reportId(subject, reportType, start));
        body.put("digest", digest(body));
        return body;
    }

    /** A sealed snapshot stays byte-for-byte. A correction is the next version. */
    public static Map<String, Object> correct(Map<String, Object> sealed, Map<String, Object> next) {
        if (sealed == null || !Boolean.TRUE.equals(sealed.get("sealed"))) {
            throw new IllegalStateException("an open report is not history");
        }
        Map<String, Object> previous = new LinkedHashMap<>(sealed);
        Map<String, Object> revised = new LinkedHashMap<>(next);
        int version = ((Number) sealed.get("reportVersion")).intValue();
        revised.put("reportVersion", version + 1);
        revised.put("previousVersion", version);
        revised.put("sealed", true);
        revised.put("supersedes", sealed.get("reportId"));
        revised.put("digest", digest(revised));
        Map<String, Object> pair = new LinkedHashMap<>();
        pair.put("previous", previous);
        pair.put("current", revised);
        return pair;
    }

    public static Map<String, Object> seal(Map<String, Object> report) {
        Map<String, Object> copy = new LinkedHashMap<>(report);
        copy.put("sealed", true);
        return copy;
    }

    public static Map<String, Object> issue(Map<String, Object> report, String ref, Instant now) {
        if (ref == null || !ref.matches("[0-9a-f]{32}")) {
            throw new IllegalArgumentException("share ref must be 32 hex characters");
        }
        Map<String, Object> share = new LinkedHashMap<>();
        share.put("ref", ref);
        share.put("expiresAt", now.plus(Duration.ofDays(7)).toString());
        share.put("revokedAt", null);
        share.put("publicFields", publicFields(report));
        return share;
    }

    public static Map<String, Object> revoke(Map<String, Object> share, Instant now) {
        Map<String, Object> copy = new LinkedHashMap<>(share);
        copy.put("revokedAt", now.toString());
        return copy;
    }

    public static Map<String, Object> publicView(Map<String, Object> share, Instant now) {
        if (share.get("revokedAt") != null) return Map.of("status", "REVOKED");
        Instant expires = Instant.parse(String.valueOf(share.get("expiresAt")));
        if (!now.isBefore(expires)) return Map.of("status", "EXPIRED");
        Map<String, Object> view = new LinkedHashMap<>();
        view.put("status", "ACTIVE");
        Object fields = share.get("publicFields");
        if (fields instanceof Map<?, ?> map) {
            for (Map.Entry<?, ?> entry : map.entrySet()) view.put(String.valueOf(entry.getKey()), entry.getValue());
        }
        view.remove("subject");
        view.remove("principalId");
        view.remove("token");
        return view;
    }

    public static Map<String, Object> publicFields(Map<String, Object> report) {
        Map<String, Object> fields = new LinkedHashMap<>();
        for (String key : List.of("availability", "copy", "periodStart", "periodEndExclusive", "newItems",
                "reviewItems", "durationStatus", "durationCopy", "activeMillis", "suggestion", "suggestionBasis")) {
            fields.put(key, report.get(key));
        }
        return fields;
    }

    private static Map<String, Object> shell(
            String reportType,
            LocalDate start,
            LocalDate end,
            Instant asOf,
            String availability,
            String copy,
            Integer newItems,
            Integer reviewItems,
            Integer accuracy,
            String durationStatus,
            String durationCopy,
            String suggestion,
            String basis,
            boolean counted) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("reportType", reportType);
        body.put("availability", availability);
        body.put("copy", copy);
        body.put("periodStart", start.toString());
        body.put("periodEndExclusive", end.toString());
        body.put("learningDayZone", LEARNING_DAY.getId());
        body.put("updatedAt", asOf.toString());
        body.put("newItems", newItems);
        body.put("reviewItems", reviewItems);
        body.put("accuracy", accuracy);
        body.put("activeMillis", null);
        body.put("durationStatus", durationStatus);
        body.put("durationCopy", durationCopy);
        body.put("suggestion", suggestion);
        body.put("suggestionBasis", basis);
        body.put("suggestionSource", "RULE");
        body.put("officialScore", false);
        body.put("reportVersion", 1);
        body.put("previousVersion", null);
        body.put("sealed", false);
        body.put("ruleVersion", RULE);
        if (!counted) body.put("digest", digest(body));
        return body;
    }

    private static Activity merge(Activity prior, Activity next) {
        String lane = "REVIEW".equals(lane(prior.lane)) || "REVIEW".equals(lane(next.lane)) ? "REVIEW" : "NEW";
        Boolean correct = prior.correct;
        if (Boolean.FALSE.equals(next.correct) || correct == null) correct = next.correct;
        return new Activity(prior.id, prior.at, lane, correct, prior.activeMillis, prior.segment);
    }

    private static String suggestion(String availability, int newItems, int reviewItems, int graded, int correct) {
        if ("PARTIAL".equals(availability)) return "统计还不完整。先看已经记下的活动，不把缺口当成零分。";
        if (graded > correct) return "先订正这段时间里答错的练习。";
        if (reviewItems > 0 && newItems == 0) return "先完成到期复习。";
        return "按今天的任务继续。练习记录还少，这是起步建议。";
    }

    private static String basis(String availability, int newItems, int reviewItems, int graded, int correct) {
        if ("PARTIAL".equals(availability)) return "PARTIAL_FACTS";
        if (graded > correct) return "MISTAKES";
        if (reviewItems > 0 && newItems == 0) return "DUE_REVIEW";
        return "STARTER";
    }

    private static boolean isPaused(String segment) {
        return "PAUSE".equals(segment) || "BACKGROUND".equals(segment);
    }

    private static String lane(String value) {
        if ("NEW".equals(value) || "REVIEW".equals(value)) return value;
        return null;
    }

    private static String reportId(String subject, String reportType, LocalDate start) {
        return java.util.UUID.nameUUIDFromBytes((subject + "|" + reportType + "|" + start)
                .getBytes(StandardCharsets.UTF_8)).toString();
    }

    static String digest(Map<String, Object> body) {
        String canonical = String.valueOf(body.get("availability")) + "|"
                + body.get("newItems") + "|" + body.get("reviewItems") + "|"
                + body.get("activeMillis") + "|" + body.get("suggestionBasis") + "|"
                + body.get("ruleVersion") + "|" + body.get("periodStart") + "|"
                + body.get("periodEndExclusive") + "|" + body.get("reportVersion");
        try {
            byte[] hash = MessageDigest.getInstance("SHA-256").digest(canonical.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (Exception exception) {
            throw new IllegalStateException("report digest is unavailable", exception);
        }
    }
}
