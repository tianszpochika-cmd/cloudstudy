package com.englishflow.content.release;

import com.englishflow.content.domain.ContentActor;
import com.englishflow.content.domain.ContentOperationException;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

/**
 * IT-6 release desk. Simple review is the default. Dual review is a switch.
 * This desk does not call {@code ContentVersion.publish}, so the existing four-eyes machine stays intact.
 */
@Component
public class ContentReleaseStudio {

    public static final String HISTORICAL_LABEL = "113+2";
    private static final ZoneId SHANGHAI = ZoneId.of("Asia/Shanghai");
    private static final Pattern B3_EXPERIENCE = Pattern.compile("\\('b3-[^']+'");

    private final Object guard = new Object();
    private final ReleaseStudioStore store;
    private String mode = "SIMPLE";
    private final Map<String, Version> versions = new LinkedHashMap<>();
    private final Map<String, Integer> pins = new LinkedHashMap<>();
    private final Map<String, Stored> idempotency = new LinkedHashMap<>();

    public ContentReleaseStudio() {
        this(new MemoryReleaseStudioStore());
    }

    @Autowired
    public ContentReleaseStudio(ObjectProvider<ReleaseStudioStore> stores) {
        this(stores.getIfAvailable(MemoryReleaseStudioStore::new));
    }

    public ContentReleaseStudio(ReleaseStudioStore store) {
        this.store = store == null ? new MemoryReleaseStudioStore() : store;
        hydrate();
    }

    public Stored handle(ContentActor actor, String command, String contentCode, Map<String, Object> input) {
        synchronized (guard) {
            if ("RELEASE_FINGERPRINT".equals(command)) {
                return ok(Map.of("fingerprint", fingerprint()));
            }
            String key = text(input.get("idempotencyKey"));
            if (!key.isBlank() && idempotency.containsKey(key)) {
                return idempotency.get(key);
            }
            Stored stored = dispatch(actor, command, contentCode, input);
            if (!key.isBlank()) {
                idempotency.put(key, stored);
            }
            persist();
            return stored;
        }
    }

    public List<Map<String, Object>> learnerCards() {
        synchronized (guard) {
            List<Map<String, Object>> cards = new ArrayList<>();
            for (String code : codes()) {
                Version visible = visibleForLearner(code);
                if (visible == null) {
                    continue;
                }
                cards.add(card(visible, pins.get(code)));
            }
            return cards;
        }
    }

    public Optional<Map<String, Object>> learnerRead(String contentCode, Long versionPin) {
        synchronized (guard) {
            Version version = resolveLearnerVersion(contentCode, versionPin);
            if ((version != null && version.force) || (version == null && anyForced(contentCode))) {
                throw ContentOperationException.conflict(
                        "CONTENT_FORCE_OFFLINE", "这份内容已强制停止分发，在学版本也不能继续。");
            }
            if (version == null) {
                return Optional.empty();
            }
            Map<String, Object> content = card(version, version.number);
            Map<String, Object> body = new LinkedHashMap<>();
            body.put("content", content);
            body.put("learnerAccess", Map.of("available", true, "offlineAllowed", false, "reasonCode", "ALLOWED"));
            body.put("pinNote", text(content.get("summary")));
            return Optional.of(body);
        }
    }

    public static Map<String, Object> historicalB3(Path migration, boolean libraryHasPublishedTargets) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("historicalLabel", HISTORICAL_LABEL);
        body.put("mutated", false);
        String text;
        try {
            text = Files.readString(migration, StandardCharsets.UTF_8);
        } catch (IOException exception) {
            body.put("status", "ROSTER_UNREADABLE");
            body.put("experienceCount", 0);
            body.put("listedCount", 0);
            body.put("message", "下线清单文件读不到，不能把 113+2 当成已经再次执行。");
            return body;
        }
        int experiences = 0;
        Matcher matcher = B3_EXPERIENCE.matcher(text);
        while (matcher.find()) {
            experiences++;
        }
        boolean vocabulary = text.contains("vocabulary_id = 'b25-item-001'");
        boolean chunk = text.contains("chunk_id = 32001");
        int listed = experiences + (vocabulary ? 1 : 0) + (chunk ? 1 : 0);
        boolean roster = experiences == 113 && vocabulary && chunk && listed == 115;
        body.put("experienceCount", experiences);
        body.put("vocabularyListed", vocabulary);
        body.put("chunkListed", chunk);
        body.put("listedCount", listed);
        body.put("rosterMatches113Plus2", roster);
        body.put("status", libraryHasPublishedTargets ? "ALREADY_IN_MIGRATION" : "NOT_REPLAYABLE");
        body.put("message", roster
                ? "清单是 113 条体验，加上词汇和语块两条。这是一次性历史口径。本次没有执行下线。"
                : "清单和 113+2 对不上。本次没有执行下线。");
        return body;
    }

    private Stored dispatch(ContentActor actor, String command, String contentCode, Map<String, Object> input) {
        return switch (command) {
            case "RELEASE_CREATE" -> create(actor, contentCode, input);
            case "RELEASE_EDIT" -> edit(actor, contentCode, input);
            case "RELEASE_SUBMIT" -> submit(actor, contentCode);
            case "RELEASE_REVIEW_L1" -> review(actor, contentCode, "L1");
            case "RELEASE_REVIEW_L2" -> review(actor, contentCode, "L2");
            case "RELEASE_PUBLISH" -> publish(actor, contentCode);
            case "RELEASE_SYNC" -> sync(actor, contentCode, input);
            case "RELEASE_UNPUBLISH" -> unpublish(actor, contentCode, input, false);
            case "RELEASE_FORCE_OFFLINE" -> unpublish(actor, contentCode, input, true);
            case "RELEASE_ROLLBACK" -> rollback(actor, contentCode, input);
            case "RELEASE_BIND_RIGHTS" -> bindRights(actor, contentCode, input);
            case "RELEASE_BIND_REPORT" -> bindReport(actor, contentCode, input);
            case "RELEASE_BIND_MEDIA" -> bindMedia(actor, contentCode, input);
            case "RELEASE_PIN" -> pin(actor, contentCode, input);
            case "RELEASE_MODE" -> mode(actor, input);
            case "RELEASE_DASHBOARD" -> dashboard(input);
            case "RELEASE_MEDIA" -> media(contentCode);
            case "RELEASE_B3" -> b3(input);
            default -> error(400, "CONTENT_COMMAND_INVALID", "不认识这个发布命令。", null);
        };
    }

    private Stored create(ContentActor actor, String contentCode, Map<String, Object> input) {
        if (!actor.canEdit()) {
            return denied();
        }
        String title = text(input.get("title"));
        if (title.isBlank() || contentCode.isBlank()) {
            return error(400, "DRAFT_INVALID", "草稿缺少标题，没有写入。", null);
        }
        Version open = latest(contentCode);
        if (open != null && "DRAFT".equals(open.status)) {
            return error(409, "DRAFT_OPEN", "已经有一份草稿，没有再新建一份。", null);
        }
        Version version = new Version();
        version.code = contentCode;
        version.number = open == null ? 1 : open.number + 1;
        version.stateVersion = 1;
        version.title = title;
        version.body = text(input.get("body"));
        version.kind = text(input.get("kind")).isBlank() ? "TEXT" : text(input.get("kind")).toUpperCase();
        version.mediaRequired = bool(input.get("mediaRequired"))
                || "LISTENING".equals(version.kind) || "SPEAKING".equals(version.kind);
        version.status = "DRAFT";
        version.catalog = "NONE";
        version.editor = actor.subjectId();
        versions.put(key(version), version);
        return accepted(view(version, false));
    }

    private Stored edit(ContentActor actor, String contentCode, Map<String, Object> input) {
        if (!actor.canEdit()) {
            return denied();
        }
        Version version = required(contentCode, input);
        if (version == null) {
            return missing();
        }
        long expected = longValue(input.get("expectedStateVersion"));
        String uncommitted = text(input.get("title"));
        if (expected != version.stateVersion) {
            Map<String, Object> extra = new LinkedHashMap<>();
            extra.put("latestVersion", version.stateVersion);
            extra.put("latestTitle", version.title);
            extra.put("uncommitted", uncommitted);
            extra.put("overwritten", false);
            return error(409, "DRAFT_CONFLICT", "版本已变化，没有用旧内容覆盖。", extra);
        }
        if (!"DRAFT".equals(version.status)) {
            return error(409, "DRAFT_REQUIRED", "只有草稿可以修改。", null);
        }
        if (!uncommitted.isBlank()) {
            version.title = uncommitted;
        }
        if (input.get("body") != null) {
            version.body = text(input.get("body"));
        }
        version.stateVersion++;
        return ok(view(version, false));
    }

    private Stored submit(ContentActor actor, String contentCode) {
        if (!actor.canEdit()) {
            return denied();
        }
        Version version = latest(contentCode);
        if (version == null || !"DRAFT".equals(version.status)) {
            return error(409, "DRAFT_REQUIRED", "只有草稿可以送审。", null);
        }
        List<Map<String, String>> gaps = gaps(version);
        if (!gaps.isEmpty()) {
            Map<String, Object> extra = new LinkedHashMap<>();
            extra.put("gaps", gaps);
            return error(409, "SUBMIT_GAPS", "送审缺项要一次列齐。", extra);
        }
        version.status = "IN_REVIEW";
        version.stateVersion++;
        return accepted(view(version, false));
    }

    private Stored review(ContentActor actor, String contentCode, String stage) {
        if ("L1".equals(stage) ? !actor.canReviewFirst() : !actor.canReviewFinal()) {
            return denied();
        }
        if ("SIMPLE".equals(mode)) {
            return error(409, "SIMPLE_NO_SECOND_SIGNATURE", "简审不记录第二审。", null);
        }
        Version version = latest(contentCode);
        if (version == null) {
            return missing();
        }
        if (actor.subjectId().equals(version.editor)) {
            return error(409, "FOUR_EYES_REQUIRED", "编辑不能审核自己的稿。", null);
        }
        if ("L1".equals(stage)) {
            if (!"IN_REVIEW".equals(version.status) || version.firstReviewer != null) {
                return error(409, "REVIEW_STATE_INVALID", "现在不能做初审。", null);
            }
            version.firstReviewer = actor.subjectId();
            version.reviewRecords = 1;
            version.reviewedVersion = version.number;
            version.stateVersion++;
            return ok(view(version, false));
        }
        if (version.firstReviewer == null || !"IN_REVIEW".equals(version.status) && !"APPROVED".equals(version.status)) {
            return error(409, "REVIEW_STATE_INVALID", "终审要等初审完成。", null);
        }
        if (actor.subjectId().equals(version.firstReviewer)) {
            return error(409, "DUAL_REVIEW_REQUIRED", "终审和初审必须是两个人。", null);
        }
        if (actor.subjectId().equals(version.finalReviewer)) {
            return ok(view(version, false));
        }
        if (version.finalReviewer != null) {
            return error(409, "REVIEW_ALREADY_DECIDED", "终审已经有结论，没有再记一条。", null);
        }
        version.finalReviewer = actor.subjectId();
        version.reviewRecords = 2;
        version.status = "APPROVED";
        version.reviewedVersion = version.number;
        version.stateVersion++;
        return ok(view(version, false));
    }

    private Stored publish(ContentActor actor, String contentCode) {
        if (!actor.canPublish()) {
            return denied();
        }
        Version version = latest(contentCode);
        if (version == null) {
            return missing();
        }
        List<Map<String, String>> gaps = gaps(version);
        if (!gaps.isEmpty()) {
            Map<String, Object> extra = new LinkedHashMap<>();
            extra.put("gaps", gaps);
            return error(409, "SUBMIT_GAPS", "发布缺项要一次列齐。", extra);
        }
        if ("DUAL".equals(mode)) {
            if (version.reviewRecords != 2 || version.reviewedVersion != version.number
                    || version.firstReviewer == null || version.finalReviewer == null) {
                return error(409, "DUAL_REVIEW_REQUIRED", "双签还没有完成，不能发布。", null);
            }
            if (actor.subjectId().equals(version.editor)
                    || actor.subjectId().equals(version.firstReviewer)
                    || actor.subjectId().equals(version.finalReviewer)) {
                return error(409, "FOUR_EYES_REQUIRED", "发布者必须和编辑、两位审核人都不同。", null);
            }
        }
        version.publisher = actor.subjectId();
        version.modeAtPublish = mode;
        version.secondSignature = "DUAL".equals(mode) ? version.finalReviewer : null;
        version.publishAudits++;
        version.publishedOnce = true;
        version.status = "PUBLISHED";
        version.catalog = "PUBLISHING";
        version.publishedNumber = version.number;
        version.stateVersion++;
        Map<String, Object> data = view(version, false);
        data.put("visibleNow", false);
        return accepted(data);
    }

    private Stored sync(ContentActor actor, String contentCode, Map<String, Object> input) {
        if (!actor.canPublish()) {
            return denied();
        }
        Version version = byCatalog(contentCode, "PUBLISHING");
        if (version == null) {
            return error(409, "CATALOG_NOT_PUBLISHING", "现在没有等待同步的发布。", null);
        }
        version.catalog = "FAILED".equals(text(input.get("outcome"))) ? "SYNC_FAILED" : "PUBLISHED";
        version.stateVersion++;
        return ok(view(version, true));
    }

    private Stored unpublish(ContentActor actor, String contentCode, Map<String, Object> input, boolean force) {
        if (!actor.canPublish()) {
            return denied();
        }
        Version version = byCatalog(contentCode, "PUBLISHED");
        if (version == null) {
            return missing();
        }
        String reason = text(input.get("reason"));
        if (reason.isBlank()) {
            return error(400, "UNPUBLISH_REASON_REQUIRED", "下架需要写下原因。", null);
        }
        String scope = text(input.get("scope")).isBlank() ? (force ? "SESSION_AND_MEDIA" : "CATALOG") : text(input.get("scope"));
        if (force) {
            for (Version item : versions.values()) {
                if (!item.code.equals(contentCode) || !item.publishedOnce) {
                    continue;
                }
                item.unpublishReason = reason;
                item.unpublishScope = scope;
                item.force = true;
                item.status = "FORCE_OFFLINE";
                item.catalog = "FORCE_OFFLINE";
                item.stateVersion++;
            }
            return ok(view(version, true));
        }
        version.unpublishReason = reason;
        version.unpublishScope = scope;
        version.force = false;
        version.status = "ARCHIVED";
        version.catalog = "UNPUBLISHED";
        version.stateVersion++;
        return ok(view(version, true));
    }

    private Stored rollback(ContentActor actor, String contentCode, Map<String, Object> input) {
        if (!actor.canPublish()) {
            return denied();
        }
        int targetNumber = (int) longValue(input.get("versionNumber"));
        Version target = versions.get(contentCode + "#" + targetNumber);
        if (target == null || !target.publishedOnce) {
            return error(409, "ROLLBACK_INELIGIBLE", "这一版没有发布过，不能回滚到它。", null);
        }
        if (target.force || target.copyrightExpired || target.copyrightVersion != target.number) {
            return error(409, "ROLLBACK_INELIGIBLE", "这一版已经不能再提供，不能回滚到它。", null);
        }
        Version current = byCatalog(contentCode, "PUBLISHED");
        target.rollbackOf = current == null ? null : current.number;
        target.status = "PUBLISHED";
        target.catalog = "PUBLISHING";
        target.force = false;
        target.publishedNumber = target.number;
        target.stateVersion++;
        Map<String, Object> data = view(target, false);
        data.put("visibleNow", false);
        return accepted(data);
    }

    private Stored bindRights(ContentActor actor, String contentCode, Map<String, Object> input) {
        if (!actor.canEdit()) {
            return denied();
        }
        if (latest(contentCode) == null) {
            return missing();
        }
        int bound = (int) longValue(input.get("versionNumber"));
        Version version = versions.get(contentCode + "#" + bound);
        if (version == null || text(input.get("copyrightRef")).isBlank()) {
            return error(409, "RIGHTS_NOT_BOUND", "提案号没有绑定到这个版本，权利仍无效。", null);
        }
        version.copyrightRef = text(input.get("copyrightRef"));
        version.copyrightVersion = bound;
        version.copyrightExpired = bool(input.get("expired"));
        version.stateVersion++;
        return ok(view(version, false));
    }

    private Stored bindReport(ContentActor actor, String contentCode, Map<String, Object> input) {
        if (!actor.canEdit()) {
            return denied();
        }
        if (latest(contentCode) == null) {
            return missing();
        }
        int bound = (int) longValue(input.get("versionNumber"));
        Version version = versions.get(contentCode + "#" + bound);
        String reportMode = text(input.get("reportMode"));
        if (version == null) {
            return error(409, "REPORT_NOT_BOUND", "审核报告和当前版本或模式不一致。", null);
        }
        if (bound != version.number || !mode.equals(reportMode) || text(input.get("reportRef")).isBlank()) {
            return error(409, "REPORT_NOT_BOUND", "审核报告和当前版本或模式不一致。", null);
        }
        version.reportRef = text(input.get("reportRef"));
        version.reportVersion = bound;
        version.reportMode = reportMode;
        version.stateVersion++;
        return ok(view(version, false));
    }

    private Stored bindMedia(ContentActor actor, String contentCode, Map<String, Object> input) {
        if (!actor.canEdit()) {
            return denied();
        }
        Version version = required(contentCode, input);
        if (version == null) {
            return missing();
        }
        String ref = text(input.get("mediaRef"));
        boolean connected = bool(input.get("bytesConnected")) && ref.startsWith("object://");
        version.mediaBytesConnected = connected;
        version.mediaRef = connected ? ref : "";
        version.stateVersion++;
        return ok(view(version, false));
    }

    private Stored pin(ContentActor actor, String contentCode, Map<String, Object> input) {
        if (!actor.canEdit() && !actor.canPublish()) {
            return denied();
        }
        int number = (int) longValue(input.get("versionNumber"));
        Version version = versions.get(contentCode + "#" + number);
        if (version == null || !version.publishedOnce || version.force) {
            return error(409, "PIN_UNAVAILABLE", "这一版不能锁定为在学版本。", null);
        }
        pins.put(contentCode, number);
        return ok(card(version, number));
    }

    private Stored mode(ContentActor actor, Map<String, Object> input) {
        String next = text(input.get("mode")).toUpperCase();
        if (next.isBlank()) {
            return ok(modeView());
        }
        if (!actor.canPublish()) {
            return denied();
        }
        if (!"SIMPLE".equals(next) && !"DUAL".equals(next)) {
            return error(400, "RELEASE_MODE_INVALID", "审核模式只能是简审或双签。", null);
        }
        mode = next;
        return ok(modeView());
    }

    private Stored dashboard(Map<String, Object> input) {
        String probe = text(input.get("probe")).toUpperCase();
        int drafts = countStatus("DRAFT");
        int published = 0;
        for (Version version : versions.values()) {
            if ("PUBLISHED".equals(version.catalog)) {
                published++;
            }
        }
        List<Map<String, Object>> metrics = new ArrayList<>();
        metrics.add(metric("RELEASE_DRAFT_COUNT", "当前租户未送审草稿", probe, drafts));
        metrics.add(metric("RELEASE_PUBLISHED_COUNT", "目录已同步的发布版本", probe, published));
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("ruleVersion", "IT6-RELEASE-1");
        data.put("metrics", metrics);
        return ok(data);
    }

    private Stored media(String contentCode) {
        Version version = latest(contentCode);
        boolean required = version != null && version.mediaRequired;
        boolean connected = version != null && version.mediaBytesConnected;
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("bytesConnected", connected);
        data.put("mediaRequired", required);
        data.put("publishable", !required || connected);
        data.put("message", !connected
                ? (required
                    ? "对象字节还没有接上。现在不能把这份内容显示成可发布。"
                    : "对象字节还没有接上。这份内容不依赖媒体，也不会显示上传进度。")
                : "媒体字节已连接。");
        return ok(data);
    }

    private Stored b3(Map<String, Object> input) {
        Path path = Path.of(text(input.get("migrationPath")).isBlank()
                ? "src/main/resources/db/migration/V23__unpublish_unbound_legacy_content.sql"
                : text(input.get("migrationPath")));
        return ok(historicalB3(path, bool(input.get("libraryHasPublishedTargets"))));
    }

    private Map<String, Object> metric(String code, String caliber, String probe, int measured) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("metricCode", code);
        row.put("metricVersion", "IT6-RELEASE-1");
        row.put("caliber", caliber);
        row.put("periodStart", LocalDate.now(SHANGHAI).toString());
        row.put("updatedAt", Instant.now().toString());
        String state = switch (probe) {
            case "EMPTY" -> "EMPTY";
            case "COMPUTING" -> "COMPUTING";
            case "FAILED" -> "FAILED";
            default -> measured == 0 ? "ZERO" : "READY";
        };
        row.put("state", state);
        row.put("value", "ZERO".equals(state) || "READY".equals(state) ? measured : null);
        row.put("text", switch (state) {
            case "ZERO" -> "实测为零";
            case "EMPTY" -> "暂无";
            case "COMPUTING" -> "计算中";
            case "FAILED" -> "读取失败";
            default -> "已读取";
        });
        return row;
    }

    private List<Map<String, String>> gaps(Version version) {
        List<Map<String, String>> gaps = new ArrayList<>();
        if (version.copyrightVersion != version.number || version.copyrightExpired || version.copyrightRef.isBlank()) {
            gaps.add(gap("copyright", "版权还没有绑定到这个版本"));
        }
        if (version.reportVersion != version.number || !mode.equals(version.reportMode) || version.reportRef.isBlank()) {
            gaps.add(gap("reviewReport", "审核报告还没有绑定到这个版本和当前模式"));
        }
        if (version.mediaRequired && !version.mediaBytesConnected) {
            gaps.add(gap("media", "必要媒体的对象字节还没有接上"));
        }
        return gaps;
    }

    private boolean anyForced(String code) {
        for (Version version : versions.values()) {
            if (version.code.equals(code) && version.force) {
                return true;
            }
        }
        return false;
    }

    private Version visibleForLearner(String code) {
        Integer pin = pins.get(code);
        if (pin != null) {
            Version pinned = versions.get(code + "#" + pin);
            if (pinned != null && pinned.publishedOnce && !pinned.force) {
                return pinned;
            }
            return null;
        }
        return byCatalog(code, "PUBLISHED");
    }

    private Version resolveLearnerVersion(String contentCode, Long versionPin) {
        if (versionPin != null) {
            Version pinned = versions.get(contentCode + "#" + versionPin);
            if (pinned == null || !pinned.publishedOnce) {
                return null;
            }
            return pinned;
        }
        return visibleForLearner(contentCode);
    }

    public boolean owns(String contentCode) {
        synchronized (guard) {
            return latest(contentCode) != null;
        }
    }

    private Version byCatalog(String code, String catalog) {
        Version found = null;
        for (Version version : versions.values()) {
            if (version.code.equals(code) && catalog.equals(version.catalog) && !version.force
                    && (found == null || version.number > found.number)) {
                found = version;
            }
        }
        return found;
    }

    private Version latest(String code) {
        Version found = null;
        for (Version version : versions.values()) {
            if (version.code.equals(code) && (found == null || version.number > found.number)) {
                found = version;
            }
        }
        return found;
    }

    private Version required(String code, Map<String, Object> input) {
        if (input.get("versionNumber") != null) {
            return versions.get(code + "#" + (int) longValue(input.get("versionNumber")));
        }
        return latest(code);
    }

    private List<String> codes() {
        List<String> codes = new ArrayList<>();
        for (Version version : versions.values()) {
            if (!codes.contains(version.code)) {
                codes.add(version.code);
            }
        }
        return codes;
    }

    private int countStatus(String status) {
        int count = 0;
        for (Version version : versions.values()) {
            if (status.equals(version.status)) {
                count++;
            }
        }
        return count;
    }

    private Map<String, Object> view(Version version, boolean includeCatalog) {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("contentCode", version.code);
        data.put("versionNumber", version.number);
        data.put("stateVersion", version.stateVersion);
        data.put("title", version.title);
        data.put("status", version.status);
        data.put("catalogState", version.catalog);
        data.put("processing", "ACCEPTED");
        data.put("ghost", false);
        data.put("reviewMode", mode);
        data.put("modeCopy", modeCopy(mode));
        data.put("reviewRecords", version.reviewRecords);
        data.put("secondSignaturePresent", version.secondSignature != null);
        data.put("publishAudits", version.publishAudits);
        data.put("editor", version.editor);
        data.put("visibleNow", "PUBLISHED".equals(version.catalog));
        if (includeCatalog) {
            data.put("catalogCopy", catalogCopy(version.catalog));
        }
        data.put("unpublishReason", version.unpublishReason);
        data.put("unpublishScope", version.unpublishScope);
        return data;
    }

    private Map<String, Object> card(Version version, Integer pin) {
        Map<String, Object> card = new LinkedHashMap<>();
        card.put("contentCode", version.code);
        card.put("contentType", "COURSE_UNIT");
        card.put("title", version.title);
        Version head = byCatalog(version.code, "PUBLISHED");
        boolean pinned = pin != null && pin == version.number && head != null && head.number != version.number;
        String summary = pinned
                ? "你正在学习的是已锁定的第 " + version.number + " 版。新版本不会替换这一版。"
                : "目录已同步，可以学习。";
        card.put("summary", summary);
        card.put("description", summary);
        card.put("contentLocale", "zh-CN");
        card.put("targetLevel", "A1");
        card.put("contentVersionId", version.number);
        card.put("availability", "PUBLISHED");
        card.put("status", "PUBLISHED");
        return card;
    }

    private Map<String, Object> modeView() {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("reviewMode", mode);
        data.put("modeCopy", modeCopy(mode));
        data.put("defaultMode", "SIMPLE");
        return data;
    }

    static String modeCopy(String mode) {
        return "DUAL".equals(mode)
                ? "当前审核模式：双签。初审和终审必须是两个不同的人，发布者也不能是编辑或审核人。"
                : "当前审核模式：简审。一个人可以发布，并留下可撤销的记录。这里没有第二审签名。";
    }

    static String catalogCopy(String state) {
        return switch (state) {
            case "PUBLISHING" -> "发布事实已写入，目录还在同步。学习端现在还看不到。";
            case "PUBLISHED" -> "目录已同步，学习端可以读取这一版。";
            case "SYNC_FAILED" -> "目录同步失败。学习端不会把未同步的版本当成已可见。";
            case "UNPUBLISHED" -> "已普通下架。目录不再发放这一版。在学中的旧版仍可收尾。";
            case "FORCE_OFFLINE" -> "已强制停止分发。旧会话和媒体也不能继续。";
            default -> "还没有目录投影。";
        };
    }

    private Stored denied() {
        return error(403, "CONTENT_FORBIDDEN", "没有内容权限。", null);
    }

    private Stored missing() {
        return error(404, "CONTENT_NOT_VISIBLE", "内容不存在或还不能学习。", null);
    }

    private Stored ok(Map<String, Object> data) {
        return new Stored(200, Map.of("data", data));
    }

    private Stored accepted(Map<String, Object> data) {
        return new Stored(202, Map.of("data", data));
    }

    private Stored error(int status, String code, String message, Map<String, Object> extra) {
        Map<String, Object> error = new LinkedHashMap<>();
        error.put("code", code);
        error.put("message", message);
        error.put("retryable", false);
        if (extra != null) {
            error.putAll(extra);
        }
        return new Stored(status, Map.of("error", error));
    }

    private static Map<String, String> gap(String field, String message) {
        Map<String, String> gap = new LinkedHashMap<>();
        gap.put("field", field);
        gap.put("message", message);
        return gap;
    }

    private void hydrate() {
        ReleaseStudioState state = store.load();
        if (state == null) {
            return;
        }
        mode = state.mode();
        versions.clear();
        for (ReleaseStudioState.VersionRow row : state.versions()) {
            Version version = Version.from(row);
            versions.put(key(version), version);
        }
        pins.clear();
        for (ReleaseStudioState.PinRow pin : state.pins()) {
            if (pin != null && pin.code() != null && !pin.code().isBlank()) {
                pins.put(pin.code(), pin.pin());
            }
        }
        idempotency.clear();
        for (ReleaseStudioState.IdempotencyRow row : state.idempotency()) {
            if (row != null && row.key() != null && !row.key().isBlank()) {
                idempotency.put(row.key(), new Stored(row.status(), row.body()));
            }
        }
    }

    private void persist() {
        ArrayList<ReleaseStudioState.VersionRow> versionRows = new ArrayList<>();
        for (Version version : versions.values()) {
            versionRows.add(version.row());
        }
        ArrayList<ReleaseStudioState.PinRow> pinRows = new ArrayList<>();
        for (Map.Entry<String, Integer> pin : pins.entrySet()) {
            pinRows.add(new ReleaseStudioState.PinRow(pin.getKey(), pin.getValue() == null ? 0 : pin.getValue()));
        }
        ArrayList<ReleaseStudioState.IdempotencyRow> idemRows = new ArrayList<>();
        for (Map.Entry<String, Stored> entry : idempotency.entrySet()) {
            idemRows.add(new ReleaseStudioState.IdempotencyRow(
                    entry.getKey(), entry.getValue().status(), entry.getValue().body()));
        }
        store.save(new ReleaseStudioState(mode, versionRows, pinRows, idemRows));
    }

    private String fingerprint() {
        ArrayList<String> versionRows = new ArrayList<>();
        for (Version version : versions.values()) {
            versionRows.add(key(version) + "\t" + version.status + "\t" + version.catalog + "\t"
                    + version.stateVersion + "\t" + version.title.replace('\t', ' ').replace('\n', ' '));
        }
        versionRows.sort(String::compareTo);
        ArrayList<String> pinRows = new ArrayList<>();
        for (Map.Entry<String, Integer> pin : pins.entrySet()) {
            pinRows.add(pin.getKey() + "=" + pin.getValue());
        }
        pinRows.sort(String::compareTo);
        ArrayList<String> idemRows = new ArrayList<>();
        for (Map.Entry<String, Stored> entry : idempotency.entrySet()) {
            idemRows.add(entry.getKey() + ":" + entry.getValue().status());
        }
        idemRows.sort(String::compareTo);
        return mode
                + "\nversions\n" + String.join("\n", versionRows)
                + "\npins\n" + String.join("\n", pinRows)
                + "\nidempotency\n" + String.join("\n", idemRows);
    }

    private static String key(Version version) {
        return version.code + "#" + version.number;
    }

    private static String text(Object value) {
        return value == null ? "" : String.valueOf(value).trim();
    }

    private static boolean bool(Object value) {
        return value instanceof Boolean flag && flag || "true".equalsIgnoreCase(text(value));
    }

    private static long longValue(Object value) {
        if (value instanceof Number number) {
            return number.longValue();
        }
        try {
            return Long.parseLong(text(value));
        } catch (NumberFormatException exception) {
            return 0;
        }
    }

    public record Stored(int status, Map<String, Object> body) {
    }

    private static final class Version {
        private String code = "";
        private int number;
        private long stateVersion;
        private String title = "";
        private String body = "";
        private String kind = "TEXT";
        private String status = "DRAFT";
        private String catalog = "NONE";
        private String editor = "";
        private String copyrightRef = "";
        private int copyrightVersion;
        private boolean copyrightExpired;
        private String reportRef = "";
        private int reportVersion;
        private String reportMode = "";
        private boolean mediaRequired;
        private boolean mediaBytesConnected;
        private String mediaRef = "";
        private String firstReviewer;
        private String finalReviewer;
        private String publisher;
        private int reviewRecords;
        private int reviewedVersion;
        private String secondSignature;
        private int publishAudits;
        private boolean publishedOnce;
        private int publishedNumber;
        private String modeAtPublish = "";
        private Integer rollbackOf;
        private String unpublishReason = "";
        private String unpublishScope = "";
        private boolean force;

        private ReleaseStudioState.VersionRow row() {
            return new ReleaseStudioState.VersionRow(
                    code, number, stateVersion, title, body, kind, status, catalog, editor,
                    copyrightRef, copyrightVersion, copyrightExpired, reportRef, reportVersion, reportMode,
                    mediaRequired, mediaBytesConnected, mediaRef, firstReviewer, finalReviewer, publisher,
                    reviewRecords, reviewedVersion, secondSignature, publishAudits, publishedOnce, publishedNumber,
                    modeAtPublish, rollbackOf, unpublishReason, unpublishScope, force);
        }

        private static Version from(ReleaseStudioState.VersionRow row) {
            Version version = new Version();
            version.code = textOrEmpty(row.code());
            version.number = row.number();
            version.stateVersion = row.stateVersion();
            version.title = textOrEmpty(row.title());
            version.body = textOrEmpty(row.body());
            version.kind = textOrEmpty(row.kind()).isBlank() ? "TEXT" : row.kind();
            version.status = textOrEmpty(row.status()).isBlank() ? "DRAFT" : row.status();
            version.catalog = textOrEmpty(row.catalog()).isBlank() ? "NONE" : row.catalog();
            version.editor = textOrEmpty(row.editor());
            version.copyrightRef = textOrEmpty(row.copyrightRef());
            version.copyrightVersion = row.copyrightVersion();
            version.copyrightExpired = row.copyrightExpired();
            version.reportRef = textOrEmpty(row.reportRef());
            version.reportVersion = row.reportVersion();
            version.reportMode = textOrEmpty(row.reportMode());
            version.mediaRequired = row.mediaRequired();
            version.mediaBytesConnected = row.mediaBytesConnected();
            version.mediaRef = textOrEmpty(row.mediaRef());
            version.firstReviewer = row.firstReviewer();
            version.finalReviewer = row.finalReviewer();
            version.publisher = row.publisher();
            version.reviewRecords = row.reviewRecords();
            version.reviewedVersion = row.reviewedVersion();
            version.secondSignature = row.secondSignature();
            version.publishAudits = row.publishAudits();
            version.publishedOnce = row.publishedOnce();
            version.publishedNumber = row.publishedNumber();
            version.modeAtPublish = textOrEmpty(row.modeAtPublish());
            version.rollbackOf = row.rollbackOf();
            version.unpublishReason = textOrEmpty(row.unpublishReason());
            version.unpublishScope = textOrEmpty(row.unpublishScope());
            version.force = row.force();
            return version;
        }

        private static String textOrEmpty(String value) {
            return value == null ? "" : value;
        }
    }
}
