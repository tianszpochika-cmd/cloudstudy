package com.englishflow.modules.content.service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

import com.englishflow.modules.content.ContentModuleException;
import org.springframework.stereotype.Service;

/**
 * In-memory content supply chain used by the Core API contract harness.  The
 * persistence migration is the source of truth for production; this service
 * preserves the important invariants before the MySQL adapter is connected.
 */
@Service
public final class ContentSupplyChainService {
    private final ConcurrentMap<String, Entity> entities = new ConcurrentHashMap<>();
    private final ConcurrentMap<String, String> mediaTokens = new ConcurrentHashMap<>();

    public Map<String, Object> create(Map<String, Object> body, String actor) {
        String contentId = text(body, "contentId", "cnt_" + randomId());
        if (entities.containsKey(contentId)) throw conflict("CONTENT_EXISTS", "content already exists");
        Entity entity = new Entity(contentId, text(body, "contentCode", contentId), text(body, "contentType", "LESSON"),
                required(body, "title"), text(body, "targetLevel", "A1"), text(body, "goalCode", "ZERO_BASIS"),
                text(body, "sourceCode", "SYNTHETIC_PHASE1"), text(body, "licenseCode", "SYNTHETIC_PHASE1"), actor);
        entities.put(contentId, entity);
        return entityView(entity);
    }

    public Map<String, Object> createVersion(String contentId, Map<String, Object> body, String actor) {
        Entity entity = entity(contentId);
        synchronized (entity) {
            int number = entity.versions.size() + 1;
            Map<String, Object> payload = object(body == null ? null : body.get("payload"));
            String source = text(body, "sourceCode", entity.sourceCode);
            String license = text(body, "licenseCode", entity.licenseCode);
            Version version = new Version("cv_" + randomId(), number, payload, source, license, actor, hash(payload));
            entity.versions.put(version.versionId, version);
            return versionView(entity, version);
        }
    }

    public Map<String, Object> preview(String contentId, String versionId) {
        Version version = version(contentId, versionId);
        Map<String, Object> result = versionView(entity(contentId), version);
        result.put("preview", true);
        return result;
    }

    public Map<String, Object> diff(String contentId, String versionId) {
        Entity entity = entity(contentId);
        Version target = version(contentId, versionId);
        Version previous = entity.versions.values().stream().filter(item -> item.number < target.number).reduce((left, right) -> right).orElse(null);
        List<Map<String, Object>> changes = new ArrayList<>();
        if (previous == null) changes.add(Map.of("path", "/", "kind", "ADDED"));
        else if (!previous.hash.equals(target.hash)) changes.add(Map.of("path", "/payload", "kind", "CHANGED"));
        return new LinkedHashMap<>(Map.of("contentId", contentId, "versionId", versionId, "baseVersionId", previous == null ? "" : previous.versionId, "changes", changes));
    }

    public Map<String, Object> submit(String contentId, String versionId, String actor) {
        Version version = version(contentId, versionId);
        synchronized (version) {
            requireStatus(version, "DRAFT");
            version.status = "IN_REVIEW";
            version.lastActor = actor;
            return versionView(entity(contentId), version);
        }
    }

    public Map<String, Object> review(String contentId, String versionId, Map<String, Object> body, String actor) {
        Version version = version(contentId, versionId);
        String stage = text(body, "stage", "FIRST_REVIEW").toUpperCase();
        String decision = text(body, "decision", "APPROVED").toUpperCase();
        if (!List.of("FIRST_REVIEW", "FINAL_REVIEW").contains(stage) || !List.of("APPROVED", "REJECTED", "CHANGES_REQUESTED").contains(decision)) throw bad("review stage or decision is invalid");
        if (actor.equals(version.editor)) throw conflict("FOUR_EYES_REQUIRED", "reviewer must differ from editor");
        synchronized (version) {
            if (!"IN_REVIEW".equals(version.status) && !"APPROVED".equals(version.status)) throw conflict("REVIEW_STATE_INVALID", "version is not awaiting review");
            if ("REJECTED".equals(decision) || "CHANGES_REQUESTED".equals(decision)) {
                version.status = "DRAFT";
            } else if ("FIRST_REVIEW".equals(stage)) {
                version.firstReviewer = actor;
                version.status = "APPROVED";
            } else {
                if (version.firstReviewer == null || actor.equals(version.firstReviewer)) throw conflict("DUAL_REVIEW_REQUIRED", "first and final reviewers must be distinct");
                version.finalReviewer = actor;
                version.status = "APPROVED";
            }
            version.lastActor = actor;
            return versionView(entity(contentId), version);
        }
    }

    public Map<String, Object> publish(String contentId, String versionId, String actor) {
        Entity entity = entity(contentId);
        Version version = version(contentId, versionId);
        if (!rightsAllowed(version.licenseCode)) throw conflict("CONTENT_RIGHTS_NOT_READY", "learning publication requires active learning rights");
        if (version.firstReviewer == null || version.finalReviewer == null || version.firstReviewer.equals(version.finalReviewer) || actor.equals(version.editor)) throw conflict("PUBLISH_REVIEW_REQUIRED", "publisher requires distinct editor and dual reviewers");
        synchronized (entity) {
            version.status = "PUBLISHED";
            version.publisher = actor;
            version.publishedAt = Instant.now();
            entity.publishedVersionId = version.versionId;
            return versionView(entity, version);
        }
    }

    public Map<String, Object> archive(String contentId, String versionId, String actor) {
        Version version = version(contentId, versionId);
        if (!List.of("PUBLISHED", "APPROVED").contains(version.status)) throw conflict("ARCHIVE_STATE_INVALID", "version cannot be archived");
        version.status = "ARCHIVED";
        version.lastActor = actor;
        if (version.versionId.equals(entity(contentId).publishedVersionId)) entity(contentId).publishedVersionId = null;
        return versionView(entity(contentId), version);
    }

    public Map<String, Object> restore(String contentId, String versionId, String actor) {
        Version version = version(contentId, versionId);
        requireStatus(version, "ARCHIVED");
        version.status = "APPROVED";
        version.lastActor = actor;
        return versionView(entity(contentId), version);
    }

    public Map<String, Object> importBatch(Map<String, Object> body, String actor) {
        List<?> rows = body != null && body.get("rows") instanceof List<?> values ? values : List.of();
        int accepted = 0, rejected = 0, duplicates = 0;
        List<Map<String, Object>> issues = new ArrayList<>();
        java.util.Set<String> seen = new java.util.HashSet<>();
        for (int i = 0; i < rows.size(); i++) {
            Object row = rows.get(i);
            if (!(row instanceof Map<?, ?> map) || !map.containsKey("normalizedKey")) {
                rejected++;
                issues.add(Map.of("rowNumber", i + 1, "code", "NORMALIZED_KEY_REQUIRED"));
            } else if (!seen.add(String.valueOf(map.get("normalizedKey")))) {
                duplicates++;
                issues.add(Map.of("rowNumber", i + 1, "code", "DUPLICATE"));
            } else accepted++;
        }
        return Map.of("batchId", "imp_" + randomId(), "status", rejected == 0 ? "READY" : "REJECTED", "acceptedCount", accepted, "rejectedCount", rejected, "duplicateCount", duplicates, "issues", issues, "actor", actor);
    }

    public Map<String, Object> createUploadIntent(Map<String, Object> body, String actor) {
        String mediaId = "media_" + randomId();
        String token = randomId() + randomId();
        mediaTokens.put(mediaId, sha256(token));
        return Map.of("mediaAssetId", mediaId, "uploadUrl", "/api/v1/content/media/" + mediaId + "/complete", "uploadToken", token, "expiresIn", 900, "actor", actor);
    }

    public Map<String, Object> completeMedia(String mediaId, Map<String, Object> body) {
        if (!mediaTokens.containsKey(mediaId)) throw new ContentModuleException("MEDIA_NOT_FOUND", "media asset does not exist", 404, false);
        return Map.of("mediaAssetId", mediaId, "status", "READY", "contentType", text(body, "contentType", "audio/mpeg"), "sizeBytes", body == null ? 0 : body.getOrDefault("sizeBytes", 0));
    }

    public Map<String, Object> signedAccess(String mediaId, Map<String, Object> body, String actor) {
        if (!mediaTokens.containsKey(mediaId)) throw new ContentModuleException("MEDIA_NOT_FOUND", "media asset does not exist", 404, false);
        return Map.of("mediaAssetId", mediaId, "signedUrl", "/media/signed/" + mediaId + "?token=" + randomId(), "expiresIn", 300, "scope", text(body, "scope", "STREAM"), "actor", actor);
    }

    public Map<String, Object> offlineManifest(String manifestCode) {
        List<Map<String, Object>> entries = entities.values().stream().filter(entity -> entity.publishedVersionId != null).map(entity -> {
            Version version = entity.versions.get(entity.publishedVersionId);
            return Map.<String, Object>of("contentId", entity.contentId, "versionId", version.versionId, "resourceKind", "CONTENT_JSON", "resourceKey", "content/" + entity.contentId, "sha256", version.hash, "allowOffline", true);
        }).toList();
        return Map.of("manifestCode", manifestCode, "manifestVersion", 1, "status", "ACTIVE", "entries", entries, "generatedAt", Instant.now());
    }

    public Map<String, Object> learnerContent(String contentId) {
        Entity entity = entity(contentId);
        if (entity.publishedVersionId == null) throw new ContentModuleException("CONTENT_NOT_PUBLISHED", "content is not published", 404, false);
        return versionView(entity, entity.versions.get(entity.publishedVersionId));
    }

    private Entity entity(String contentId) { Entity entity = entities.get(contentId); if (entity == null) throw new ContentModuleException("CONTENT_NOT_FOUND", "content does not exist", 404, false); return entity; }
    private Version version(String contentId, String versionId) { Entity entity = entity(contentId); Version version = entity.versions.get(versionId); if (version == null) throw new ContentModuleException("VERSION_NOT_FOUND", "content version does not exist", 404, false); return version; }
    private static void requireStatus(Version version, String expected) { if (!expected.equals(version.status)) throw conflict("INVALID_STATE", "expected " + expected + " but was " + version.status); }
    private static ContentModuleException bad(String message) { return new ContentModuleException("VALIDATION_ERROR", message, 400, false); }
    private static ContentModuleException conflict(String code, String message) { return new ContentModuleException(code, message, 409, false); }
    private static String required(Map<String, Object> body, String key) { String value = text(body, key, null); if (value == null || value.isBlank()) throw bad(key + " is required"); return value; }
    private static String text(Map<String, Object> body, String key, String fallback) { if (body == null || body.get(key) == null) return fallback; String value = String.valueOf(body.get(key)).trim(); return value.isBlank() ? fallback : value; }
    private static Map<String, Object> object(Object value) { if (value instanceof Map<?, ?> map) { Map<String, Object> copy = new LinkedHashMap<>(); map.forEach((key, item) -> copy.put(String.valueOf(key), item)); return copy; } return new LinkedHashMap<>(); }
    private static boolean rightsAllowed(String licenseCode) { return licenseCode != null && (licenseCode.startsWith("SYNTHETIC") || licenseCode.startsWith("INTERNAL") || licenseCode.startsWith("CC")); }
    private static String randomId() { return UUID.randomUUID().toString().replace("-", ""); }
    private static String hash(Object value) { return sha256(String.valueOf(value)); }
    private static String sha256(String value) { try { return Base64.getUrlEncoder().withoutPadding().encodeToString(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8))); } catch (NoSuchAlgorithmException e) { throw new IllegalStateException(e); } }

    private static Map<String, Object> entityView(Entity entity) { return new LinkedHashMap<>(Map.of("contentId", entity.contentId, "contentCode", entity.contentCode, "contentType", entity.contentType, "title", entity.title, "targetLevel", entity.targetLevel, "goalCode", entity.goalCode, "sourceCode", entity.sourceCode, "licenseCode", entity.licenseCode, "publishedVersionId", entity.publishedVersionId == null ? "" : entity.publishedVersionId, "versionCount", entity.versions.size())); }
    private static Map<String, Object> versionView(Entity entity, Version version) { Map<String, Object> result = new LinkedHashMap<>(); result.put("contentId", entity.contentId); result.put("versionId", version.versionId); result.put("versionNumber", version.number); result.put("status", version.status); result.put("payload", version.payload); result.put("contentHash", version.hash); result.put("sourceCode", version.sourceCode); result.put("licenseCode", version.licenseCode); result.put("editorActor", version.editor); result.put("firstReviewerActor", version.firstReviewer); result.put("finalReviewerActor", version.finalReviewer); result.put("publisherActor", version.publisher); result.put("publishedAt", version.publishedAt); return result; }

    private static final class Entity {
        final String contentId, contentCode, contentType, title, targetLevel, goalCode, sourceCode, licenseCode, createdBy;
        final Map<String, Version> versions = new LinkedHashMap<>();
        String publishedVersionId;
        Entity(String contentId, String contentCode, String contentType, String title, String targetLevel, String goalCode, String sourceCode, String licenseCode, String createdBy) { this.contentId = contentId; this.contentCode = contentCode; this.contentType = contentType; this.title = title; this.targetLevel = targetLevel; this.goalCode = goalCode; this.sourceCode = sourceCode; this.licenseCode = licenseCode; this.createdBy = createdBy; }
    }
    private static final class Version {
        final String versionId, sourceCode, licenseCode, editor, hash;
        final int number;
        final Map<String, Object> payload;
        String status = "DRAFT", firstReviewer, finalReviewer, publisher, lastActor;
        Instant publishedAt;
        Version(String versionId, int number, Map<String, Object> payload, String sourceCode, String licenseCode, String editor, String hash) { this.versionId = versionId; this.number = number; this.payload = payload; this.sourceCode = sourceCode; this.licenseCode = licenseCode; this.editor = editor; this.hash = hash; }
    }
}
