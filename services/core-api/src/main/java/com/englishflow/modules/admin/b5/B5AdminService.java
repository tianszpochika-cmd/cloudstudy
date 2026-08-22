package com.englishflow.modules.admin.b5;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

import com.englishflow.modules.b5.B5Exception;
import org.springframework.stereotype.Service;

/** B5 admin state machines before the persistence and outbox adapters land. */
@Service
public final class B5AdminService {
    private final ConcurrentMap<String, Content> contents = new ConcurrentHashMap<>();
    private final ConcurrentMap<String, ReviewTask> reviewTasks = new ConcurrentHashMap<>();
    private final ConcurrentMap<String, ImportJob> importJobs = new ConcurrentHashMap<>();
    private final ConcurrentMap<Long, RiskProfile> riskProfiles = new ConcurrentHashMap<>();
    private final ConcurrentMap<String, Flag> flags = new ConcurrentHashMap<>();
    private final ConcurrentMap<String, ReconBatch> reconciliationBatches = new ConcurrentHashMap<>();
    private final ConcurrentMap<String, Map<String, Object>> idempotentResults = new ConcurrentHashMap<>();
    private final List<Map<String, Object>> auditLog = new ArrayList<>();

    public B5AdminService() {
        flags.put("commerce.wechat.enabled", new Flag("commerce.wechat.enabled"));
        flags.put("commerce.alipay.enabled", new Flag("commerce.alipay.enabled"));
        flags.put("commerce.apple.production", new Flag("commerce.apple.production"));
        flags.put("b5.cms.import.enabled", new Flag("b5.cms.import.enabled"));
    }

    public synchronized Map<String, Object> createContentDraft(long actorId, Map<String, Object> body, String key) {
        requireKey(key);
        String replayKey = "content-create:" + actorId + ":" + key;
        if (idempotentResults.containsKey(replayKey)) return idempotentResults.get(replayKey);
        String code = required(body, "contentCode");
        if (contents.values().stream().anyMatch(value -> value.contentCode.equals(code))) throw conflict("CONTENT_EXISTS", "content code already exists");
        String contentId = "cnt_" + UUID.randomUUID().toString().replace("-", "");
        Content content = new Content(contentId, code, required(body, "contentType"), required(body, "title"), actorId);
        content.addVersion(body, actorId);
        contents.put(contentId, content);
        Map<String, Object> result = reply(content.view());
        idempotentResults.put(replayKey, result);
        audit(actorId, "CONTENT_CREATED", "cms_content", contentId, "SUCCESS");
        return result;
    }

    public synchronized Map<String, Object> saveContentDraft(String contentId, Map<String, Object> body, long actorId, String key) {
        requireKey(key);
        Content content = requireContent(contentId);
        if ("PUBLISHED".equals(content.status)) throw conflict("CONTENT_VERSION_LOCKED", "published content requires a new version");
        String replayKey = "content-save:" + contentId + ":" + key;
        if (idempotentResults.containsKey(replayKey)) return idempotentResults.get(replayKey);
        Version version = content.addVersion(body, actorId);
        Map<String, Object> result = reply(version.view(content));
        idempotentResults.put(replayKey, result);
        audit(actorId, "CONTENT_VERSION_SAVED", "cms_content_version", version.id, "SUCCESS");
        return result;
    }

    public synchronized Map<String, Object> validateContentDraft(String contentId, long actorId, String key) {
        requireKey(key);
        Content content = requireContent(contentId);
        Version version = content.current();
        boolean invalid = version.payload.containsKey("invalid") && Boolean.TRUE.equals(version.payload.get("invalid"));
        boolean sensitive = version.payload.containsKey("sensitiveHit") && Boolean.TRUE.equals(version.payload.get("sensitiveHit"));
        version.validated = !invalid && !sensitive;
        version.validationCode = sensitive ? "SENSITIVE_CONTENT_BLOCKED" : invalid ? "CONTENT_SCHEMA_INVALID" : "VALID";
        audit(actorId, "CONTENT_VALIDATED", "cms_content_version", version.id, version.validated ? "SUCCESS" : version.validationCode);
        return reply(Map.of("contentId", contentId, "versionId", version.id, "valid", version.validated, "resultCode", version.validationCode, "failClosed", !version.validated));
    }

    public synchronized Map<String, Object> submitContentReview(String contentId, long actorId, String key) {
        requireKey(key);
        Content content = requireContent(contentId);
        Version version = content.current();
        if (!version.validated) throw conflict("CONTENT_SCHEMA_INVALID", "content must pass validation before review");
        content.status = "IN_REVIEW";
        ReviewTask first = new ReviewTask("rev_" + UUID.randomUUID(), contentId, version.id, "FIRST", "CONTENT_REVIEW_L1");
        ReviewTask finalTask = new ReviewTask("rev_" + UUID.randomUUID(), contentId, version.id, "FINAL", "CONTENT_REVIEW_L2");
        reviewTasks.put(first.id, first);
        reviewTasks.put(finalTask.id, finalTask);
        audit(actorId, "CONTENT_SUBMITTED_REVIEW", "cms_content", contentId, "SUCCESS");
        return reply(Map.of("contentId", contentId, "versionId", version.id, "status", content.status, "reviewTaskIds", List.of(first.id, finalTask.id)));
    }

    public Map<String, Object> listReviewTasks(String cursor, int limit) {
        int bounded = Math.max(1, Math.min(limit, 100));
        List<Map<String, Object>> items = reviewTasks.values().stream().filter(task -> "PENDING".equals(task.status)).sorted((left, right) -> Integer.compare(reviewStageRank(left.stage), reviewStageRank(right.stage))).limit(bounded).map(ReviewTask::view).toList();
        return reply(Map.of("items", items, "nextCursor", items.size() == bounded ? "b5-review-next" : ""));
    }

    public synchronized Map<String, Object> decideReviewTask(String reviewTaskId, Map<String, Object> body, long actorId, String actorRole, String key) {
        requireKey(key);
        ReviewTask task = reviewTasks.get(reviewTaskId);
        if (task == null) throw notFound("REVIEW_TASK_NOT_FOUND", "review task does not exist");
        Content content = requireContent(task.contentId);
        Version version = content.version(task.versionId);
        if (!task.role.equals(actorRole)) throw new B5Exception("REVIEW_ROLE_FORBIDDEN", "reviewer role cannot decide this stage", 403, false);
        if (version.editorId == actorId) throw conflict("REVIEW_ROLE_CONFLICT", "editor cannot review own content");
        String decision = text(body, "decision", "").toUpperCase();
        if (!List.of("APPROVED", "REJECTED", "CHANGES_REQUESTED").contains(decision)) throw bad("REVIEW_DECISION_INVALID", "unsupported review decision");
        if ("APPROVED".equals(decision) && "FINAL".equals(task.stage) && version.firstReviewerId == actorId) throw conflict("REVIEW_ROLE_CONFLICT", "first and final reviewers must be distinct");
        task.status = decision;
        task.reviewerId = actorId;
        version.validationCode = decision;
        if ("APPROVED".equals(decision)) {
            if ("FIRST".equals(task.stage)) version.firstReviewerId = actorId;
            if ("FINAL".equals(task.stage)) version.finalReviewerId = actorId;
            if (version.firstReviewerId != null && version.finalReviewerId != null && !version.firstReviewerId.equals(version.finalReviewerId)) content.status = "APPROVED";
        } else content.status = "DRAFT";
        audit(actorId, "REVIEW_DECIDED", "cms_review_task", reviewTaskId, decision);
        return reply(Map.of("reviewTaskId", reviewTaskId, "contentId", content.id, "versionId", version.id, "decision", decision, "contentStatus", content.status));
    }

    public synchronized Map<String, Object> publishContent(String contentId, long actorId, String key) {
        requireKey(key);
        Content content = requireContent(contentId);
        Version version = content.current();
        if (!"APPROVED".equals(content.status) || version.firstReviewerId == null || version.finalReviewerId == null || version.firstReviewerId.equals(version.finalReviewerId)) throw conflict("PUBLISH_REVIEW_REQUIRED", "distinct first and final approvals are required");
        content.status = "PUBLISHED";
        content.publishedVersionId = version.id;
        version.publisherId = actorId;
        audit(actorId, "CONTENT_PUBLISHED", "cms_content", contentId, "SUCCESS");
        return reply(version.view(content));
    }

    public synchronized Map<String, Object> rollbackContent(String contentId, Map<String, Object> body, long actorId, String key) {
        requireKey(key);
        Content content = requireContent(contentId);
        String target = text(body, "targetVersionId", null);
        if (target == null || content.versions.get(target) == null) throw bad("ROLLBACK_TARGET_REQUIRED", "targetVersionId is required");
        content.publishedVersionId = target;
        content.status = "PUBLISHED";
        audit(actorId, "CONTENT_ROLLED_BACK", "cms_content", contentId, "SUCCESS");
        return reply(Map.of("contentId", contentId, "publishedVersionId", target, "status", content.status, "rollback", true));
    }

    public synchronized Map<String, Object> createImportJob(Map<String, Object> body, long actorId, String key) {
        requireKey(key);
        String replayKey = "import:" + actorId + ":" + key;
        if (idempotentResults.containsKey(replayKey)) return idempotentResults.get(replayKey);
        List<?> rows = body != null && body.get("rows") instanceof List<?> values ? values : List.of();
        int accepted = 0, rejected = 0;
        List<Map<String, Object>> issues = new ArrayList<>();
        java.util.Set<String> seen = new java.util.HashSet<>();
        for (int index = 0; index < rows.size(); index++) {
            Object row = rows.get(index);
            String normalizedKey = row instanceof Map<?, ?> map && map.get("normalizedKey") != null ? String.valueOf(map.get("normalizedKey")) : "";
            if (normalizedKey.isBlank()) { rejected++; issues.add(Map.of("rowNumber", index + 1, "code", "NORMALIZED_KEY_REQUIRED")); }
            else if (!seen.add(normalizedKey)) { rejected++; issues.add(Map.of("rowNumber", index + 1, "code", "DUPLICATE")); }
            else accepted++;
        }
        String id = "imp_" + UUID.randomUUID();
        ImportJob job = new ImportJob(id, text(body, "targetType", "CONTENT"), text(body, "sourceHash", ""), rows.size(), accepted, rejected);
        importJobs.put(id, job);
        Map<String, Object> result = reply(Map.of("importJobId", id, "status", rejected == 0 ? "COMPLETED" : "PARTIAL", "totalCount", rows.size(), "acceptedCount", accepted, "rejectedCount", rejected, "issues", issues));
        idempotentResults.put(replayKey, result);
        audit(actorId, "IMPORT_JOB_CREATED", "cms_import_job", id, "SUCCESS");
        return result;
    }

    public Map<String, Object> getImportJob(String importJobId) { ImportJob job = importJobs.get(importJobId); if (job == null) throw notFound("IMPORT_JOB_NOT_FOUND", "import job does not exist"); return reply(job.view()); }

    public Map<String, Object> getRiskProfile(long userId) { return reply(riskProfiles.computeIfAbsent(userId, RiskProfile::new).view()); }

    public synchronized Map<String, Object> applyRiskAction(long userId, Map<String, Object> body, long actorId, String key) {
        requireKey(key);
        String action = text(body, "actionCode", "").toUpperCase();
        if (!List.of("FREEZE_LOGIN", "FREEZE_PAYMENT", "RATE_LIMIT", "UNFREEZE").contains(action)) throw bad("RISK_ACTION_INVALID", "unsupported risk action");
        int ttl = Math.max(60, Math.min((int) number(body.get("ttlSeconds"), 3600), 2592000));
        RiskProfile profile = riskProfiles.computeIfAbsent(userId, RiskProfile::new);
        profile.apply(action, "UNFREEZE".equals(action) ? 0 : ttl);
        audit(actorId, "RISK_ACTION_APPLIED", "ops_user_risk", String.valueOf(userId), "SUCCESS");
        return reply(profile.view());
    }

    public Map<String, Object> dashboardMetrics(Map<String, Object> commerceSnapshot) {
        Map<String, Object> metrics = new LinkedHashMap<>();
        metrics.put("DAU", 0);
        metrics.put("RETENTION_D7", null);
        metrics.put("COMPLETION_RATE", null);
        metrics.put("GMV_MINOR", commerceSnapshot.getOrDefault("ordersPaid", 0));
        metrics.put("sourceWatermark", Instant.now().toString());
        metrics.put("completeness", "PARTIAL");
        metrics.put("commerce", commerceSnapshot);
        return reply(metrics);
    }

    public Map<String, Object> listReconciliationBatches() { return reply(Map.of("items", reconciliationBatches.values().stream().map(ReconBatch::view).toList())); }

    public synchronized Map<String, Object> importReconciliationBatch(Map<String, Object> body, long actorId, String key) {
        requireKey(key);
        String sourceHash = required(body, "sourceHash");
        if (reconciliationBatches.values().stream().anyMatch(batch -> batch.sourceHash.equals(sourceHash))) return reply(Map.of("status", "REPLAYED", "sourceHash", sourceHash));
        List<?> items = body.get("items") instanceof List<?> values ? values : List.of();
        ReconBatch batch = new ReconBatch("rec_" + UUID.randomUUID(), text(body, "channelCode", "UNKNOWN"), sourceHash);
        for (Object item : items) {
            if (!(item instanceof Map<?, ?> map)) continue;
            long expected = number(map.get("amountMinor"), -1);
            batch.items.add(new ReconItem("recon_" + UUID.randomUUID(), valueText(map.get("channelTradeNo"), ""), valueText(map.get("orderId"), ""), expected, expected < 0 ? "INVALID_AMOUNT" : "PENDING"));
        }
        reconciliationBatches.put(batch.id, batch);
        audit(actorId, "RECONCILIATION_IMPORTED", "com_reconciliation_batch", batch.id, "SUCCESS");
        return reply(batch.view());
    }

    public synchronized Map<String, Object> resolveReconciliationItem(String itemId, Map<String, Object> body, long actorId, String key) {
        requireKey(key);
        for (ReconBatch batch : reconciliationBatches.values()) for (ReconItem item : batch.items) if (item.id.equals(itemId)) {
            item.status = text(body, "decisionCode", "MATCHED");
            item.resolvedBy = actorId;
            audit(actorId, "RECONCILIATION_ITEM_RESOLVED", "com_reconciliation_item", itemId, "SUCCESS");
            return reply(item.view());
        }
        throw notFound("RECONCILIATION_ITEM_NOT_FOUND", "reconciliation item does not exist");
    }

    public Map<String, Object> listFeatureFlags() { return reply(Map.of("items", flags.values().stream().map(Flag::view).toList())); }

    public synchronized Map<String, Object> updateFeatureFlag(String flagKey, Map<String, Object> body, long actorId, String key) {
        requireKey(key);
        Flag flag = flags.computeIfAbsent(flagKey, Flag::new);
        flag.enabled = Boolean.TRUE.equals(body.get("enabled"));
        flag.rolloutPercent = Math.max(0, Math.min((int) number(body.get("rolloutPercent"), 0), 100));
        flag.ruleVersion = text(body, "ruleVersion", "b5-v1");
        flag.platforms = body.get("allowedPlatforms") instanceof List<?> values ? values.stream().map(String::valueOf).toList() : List.of("WEB", "H5", "IOS", "ANDROID", "IPAD", "WECHAT_MINI_PROGRAM");
        flag.updatedBy = actorId;
        audit(actorId, "FEATURE_FLAG_UPDATED", "ops_feature_flag", flagKey, "SUCCESS");
        return reply(flag.view());
    }

    public Map<String, Object> searchAuditLogs(String cursor, int limit) {
        synchronized (auditLog) { int bounded = Math.max(1, Math.min(limit, 100)); return reply(Map.of("items", List.copyOf(auditLog).stream().skip(Math.max(0, auditLog.size() - bounded)).toList(), "retentionPolicy", "audit records are append-only and redacted")); }
    }

    public synchronized Map<String, Object> exportAuditReport(long actorId, String key) {
        requireKey(key);
        audit(actorId, "AUDIT_EXPORT_REQUESTED", "ops_audit_log", "b5", "SUCCESS");
        return reply(Map.of("exportJobId", "audit_" + UUID.randomUUID(), "status", "QUEUED", "redacted", true, "format", "CSV"));
    }

    private void audit(long actorId, String action, String resourceType, String resourceRef, String result) {
        Map<String, Object> entry = new LinkedHashMap<>();
        entry.put("auditId", "audit_" + UUID.randomUUID()); entry.put("actorId", actorId); entry.put("actionCode", action); entry.put("resourceType", resourceType); entry.put("resourceRef", resourceRef); entry.put("resultCode", result); entry.put("redacted", true); entry.put("occurredAt", Instant.now().toString());
        synchronized (auditLog) { auditLog.add(entry); }
    }

    private Content requireContent(String contentId) { Content content = contents.get(contentId); if (content == null) throw notFound("CONTENT_NOT_FOUND", "content does not exist"); return content; }
    private static String required(Map<String, Object> body, String key) { String value = text(body, key, null); if (value == null || value.isBlank()) throw bad("SCHEMA_INVALID", key + " is required"); return value; }
    private static String text(Map<String, Object> body, String key, String fallback) { if (body == null || body.get(key) == null) return fallback; String value = String.valueOf(body.get(key)).trim(); return value.isBlank() ? fallback : value; }
    private static String valueText(Object value, String fallback) { if (value == null) return fallback; String result = String.valueOf(value).trim(); return result.isBlank() ? fallback : result; }
    private static long number(Object value, long fallback) { if (value == null) return fallback; if (value instanceof Number number) return number.longValue(); try { return Long.parseLong(String.valueOf(value)); } catch (NumberFormatException ignored) { return fallback; } }
    private static int reviewStageRank(String stage) { return "FIRST".equals(stage) ? 0 : 1; }
    private static void requireKey(String key) { if (key == null || key.trim().length() < 8) throw bad("IDEMPOTENCY_KEY_REQUIRED", "Idempotency-Key is required"); }
    private static Map<String, Object> reply(Map<String, Object> data) { Map<String, Object> result = new LinkedHashMap<>(); result.put("requestId", "req_b5_admin"); result.put("data", data); result.putAll(data); return result; }
    private static B5Exception bad(String code, String message) { return new B5Exception(code, message, 400, false); }
    private static B5Exception conflict(String code, String message) { return new B5Exception(code, message, 409, false); }
    private static B5Exception notFound(String code, String message) { return new B5Exception(code, message, 404, false); }

    private static final class Content {
        final String id, contentCode, contentType, title;
        final long createdBy;
        final Map<String, Version> versions = new LinkedHashMap<>();
        String status = "DRAFT", publishedVersionId;
        Content(String id, String contentCode, String contentType, String title, long createdBy) { this.id = id; this.contentCode = contentCode; this.contentType = contentType; this.title = title; this.createdBy = createdBy; }
        Version addVersion(Map<String, Object> body, long actorId) { String versionId = "ver_" + UUID.randomUUID(); Version version = new Version(versionId, versions.size() + 1, text(body, "contentHash", "hash-pending"), actorId, body == null || !(body.get("payload") instanceof Map<?, ?>) ? new LinkedHashMap<>() : copy((Map<?, ?>) body.get("payload"))); versions.put(versionId, version); return version; }
        Version current() { return versions.values().stream().reduce((left, right) -> right).orElseThrow(() -> bad("CONTENT_VERSION_MISSING", "content has no draft version")); }
        Version version(String id) { Version version = versions.get(id); if (version == null) throw notFound("CONTENT_VERSION_NOT_FOUND", "content version does not exist"); return version; }
        Map<String, Object> view() { return Map.of("contentId", id, "contentCode", contentCode, "contentType", contentType, "title", title, "status", status, "publishedVersionId", publishedVersionId == null ? "" : publishedVersionId, "versionCount", versions.size()); }
    }

    private static final class Version {
        final String id, contentHash;
        final int number;
        final long editorId;
        final Map<String, Object> payload;
        boolean validated;
        String validationCode = "NOT_VALIDATED";
        Long firstReviewerId, finalReviewerId, publisherId;
        Version(String id, int number, String contentHash, long editorId, Map<String, Object> payload) { this.id = id; this.number = number; this.contentHash = contentHash; this.editorId = editorId; this.payload = payload; }
        Map<String, Object> view(Content content) { Map<String, Object> value = new LinkedHashMap<>(); value.put("contentId", content.id); value.put("versionId", id); value.put("versionNumber", number); value.put("contentHash", contentHash); value.put("status", content.status); value.put("validated", validated); value.put("validationCode", validationCode); value.put("editorId", editorId); value.put("firstReviewerId", firstReviewerId == null ? 0 : firstReviewerId); value.put("finalReviewerId", finalReviewerId == null ? 0 : finalReviewerId); value.put("publisherId", publisherId == null ? 0 : publisherId); return value; }
    }

    private static final class ReviewTask {
        final String id, contentId, versionId, stage, role;
        String status = "PENDING";
        long reviewerId;
        ReviewTask(String id, String contentId, String versionId, String stage, String role) { this.id = id; this.contentId = contentId; this.versionId = versionId; this.stage = stage; this.role = role; }
        Map<String, Object> view() { return Map.of("reviewTaskId", id, "contentId", contentId, "versionId", versionId, "stage", stage, "requiredRole", role, "status", status, "reviewerId", reviewerId); }
    }

    private record ImportJob(String id, String targetType, String sourceHash, int total, int accepted, int rejected) {
        Map<String, Object> view() { return Map.of("importJobId", id, "targetType", targetType, "sourceHash", sourceHash, "totalCount", total, "acceptedCount", accepted, "rejectedCount", rejected, "status", rejected == 0 ? "COMPLETED" : "PARTIAL"); }
    }

    private static final class RiskProfile {
        final long userId;
        String level = "NORMAL", ruleVersion = "b5-risk-v1";
        Instant loginFrozenUntil, paymentFrozenUntil, rateLimitUntil;
        RiskProfile(long userId) { this.userId = userId; }
        void apply(String action, int ttl) { Instant until = ttl == 0 ? null : Instant.now().plusSeconds(ttl); if ("FREEZE_LOGIN".equals(action)) loginFrozenUntil = until; if ("FREEZE_PAYMENT".equals(action)) paymentFrozenUntil = until; if ("RATE_LIMIT".equals(action)) rateLimitUntil = until; if ("UNFREEZE".equals(action)) { loginFrozenUntil = null; paymentFrozenUntil = null; rateLimitUntil = null; } level = "UNFREEZE".equals(action) ? "NORMAL" : "REVIEW"; }
        Map<String, Object> view() { return Map.of("userId", userId, "riskLevel", level, "ruleVersion", ruleVersion, "loginFrozenUntil", loginFrozenUntil == null ? "" : loginFrozenUntil.toString(), "paymentFrozenUntil", paymentFrozenUntil == null ? "" : paymentFrozenUntil.toString(), "rateLimitUntil", rateLimitUntil == null ? "" : rateLimitUntil.toString()); }
    }

    private static final class Flag {
        final String key;
        boolean enabled;
        int rolloutPercent;
        String ruleVersion = "b5-v1";
        long updatedBy;
        List<String> platforms = List.of("WEB", "H5", "IOS", "ANDROID", "IPAD", "WECHAT_MINI_PROGRAM");
        Flag(String key) { this.key = key; }
        Map<String, Object> view() { return Map.of("flagKey", key, "enabled", enabled, "rolloutPercent", rolloutPercent, "ruleVersion", ruleVersion, "allowedPlatforms", platforms, "updatedBy", updatedBy, "defaultOff", !enabled); }
    }

    private static final class ReconBatch {
        final String id, channelCode, sourceHash;
        final List<ReconItem> items = new ArrayList<>();
        ReconBatch(String id, String channelCode, String sourceHash) { this.id = id; this.channelCode = channelCode; this.sourceHash = sourceHash; }
        Map<String, Object> view() { return Map.of("batchId", id, "channelCode", channelCode, "sourceHash", sourceHash, "itemCount", items.size(), "discrepancyCount", items.stream().filter(item -> !"PENDING".equals(item.status)).count(), "items", items.stream().map(ReconItem::view).toList()); }
    }

    private static final class ReconItem {
        final String id, tradeNo, orderId;
        final long amountMinor;
        String status;
        long resolvedBy;
        ReconItem(String id, String tradeNo, String orderId, long amountMinor, String status) { this.id = id; this.tradeNo = tradeNo; this.orderId = orderId; this.amountMinor = amountMinor; this.status = status; }
        Map<String, Object> view() { return Map.of("itemId", id, "channelTradeNo", tradeNo, "orderId", orderId, "amountMinor", amountMinor, "status", status, "resolvedBy", resolvedBy); }
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> copy(Map<?, ?> value) { Map<String, Object> result = new LinkedHashMap<>(); value.forEach((key, item) -> result.put(String.valueOf(key), item)); return result; }
}
