package com.englishflow.content.web;

import com.englishflow.content.application.ContentCommandService;
import com.englishflow.content.domain.ContentActor;
import com.englishflow.content.domain.ContentDefinition;
import com.englishflow.content.domain.ContentDefinitionSnapshot;
import com.englishflow.content.domain.ContentId;
import com.englishflow.content.domain.ContentIdempotencyKey;
import com.englishflow.content.domain.ContentKind;
import com.englishflow.content.domain.ContentOperationException;
import com.englishflow.content.domain.ContentRequestContext;
import com.englishflow.content.domain.ContentRights;
import com.englishflow.content.domain.ContentVersion;
import com.englishflow.content.domain.ContentVersionId;
import com.englishflow.content.domain.ContentVersionSnapshot;
import com.englishflow.content.domain.ContentVersionStatus;
import com.englishflow.content.domain.CopyrightStatus;
import com.englishflow.content.domain.ReviewDecision;
import com.englishflow.content.domain.ReviewStage;
import com.englishflow.content.port.ContentRepository;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Base64;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * B9 admin command boundary backed by the content-service aggregate.
 *
 * <p>The request deliberately contains no actor, tenant, role, reviewer or copyright authority
 * facts. Those facts come from the verified resource-server JWT and the aggregate. This adapter
 * is intentionally thin: all state transitions, four-eyes checks, idempotency reservations,
 * projections and content outbox writes remain in {@link ContentCommandService}.</p>
 */
@RestController
@RequestMapping("/internal/v1/content/admin-commands")
@ConditionalOnProperty(prefix = "content.persistence", name = "mode", havingValue = "jdbc")
public final class B9ContentAdminController {

    private static final String TENANT = "platform";
    private final ContentCommandService commands;
    private final ContentRepository repository;
    private final VerifiedContentPrincipalFactory principals;

    public B9ContentAdminController(
            ContentCommandService commands,
            ContentRepository repository,
            VerifiedContentPrincipalFactory principals) {
        this.commands = commands;
        this.repository = repository;
        this.principals = principals;
    }

    @GetMapping
    public ResponseEntity<Map<String, Object>> list(
            Authentication authentication,
            @RequestParam(required = false) String cursor,
            @RequestParam(defaultValue = "50") int limit,
            @RequestHeader HttpHeaders headers) {
        ContentActor actor = adminActor(authentication);
        requireAdminRead(actor);
        int pageSize = Math.max(1, Math.min(limit, 100));
        List<Map<String, Object>> items = repository.findAll().stream()
                .filter(content -> TENANT.equals(content.tenantId()))
                .limit(pageSize)
                .map(content -> state(content, actor))
                .toList();
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("items", items);
        if (cursor != null && !cursor.isBlank()) {
            data.put("nextCursor", cursor.trim());
        }
        return ResponseEntity.ok(envelope(data, headers));
    }

    @GetMapping("/{contentCode}")
    public ResponseEntity<Map<String, Object>> get(
            @PathVariable String contentCode,
            Authentication authentication,
            @RequestHeader HttpHeaders headers) {
        ContentActor actor = adminActor(authentication);
        requireAdminRead(actor);
        ContentDefinition content = repository.findByCode(contentCode)
                .orElseThrow(() -> ContentOperationException.notFound("CONTENT_NOT_FOUND", "content does not exist"));
        return ResponseEntity.ok(envelope(state(content, actor), headers));
    }

    @PostMapping
    public ResponseEntity<Map<String, Object>> command(
            @RequestBody(required = false) Map<String, Object> body,
            Authentication authentication,
            @RequestHeader(name = "Idempotency-Key", required = false) String idempotencyKey,
            @RequestHeader HttpHeaders headers) {
        ContentActor actor = adminActor(authentication);
        String key = requireIdempotencyKey(idempotencyKey);
        Map<String, Object> input = body == null ? Map.of() : body;
        String command = text(input.get("command")).toUpperCase();
        String contentCode = text(input.get("contentCode"));
        if (command.isBlank() || contentCode.isBlank()) {
            throw ContentOperationException.badRequest("CONTENT_COMMAND_INVALID", "command and contentCode are required");
        }
        ContentRequestContext context = context(headers);
        ContentVersionSnapshot versionSnapshot = null;
        ContentDefinitionSnapshot definitionSnapshot = null;
        switch (command) {
            case "CREATE_DRAFT" -> {
                requireEditor(actor);
                if (repository.findByCode(contentCode).isPresent()) {
                    throw ContentOperationException.conflict("CONTENT_EXISTS", "content code already exists");
                }
                Map<String, Object> draft = record(input.get("content"));
                ContentId contentId = ContentId.of(contentCode);
                definitionSnapshot = commands.createContent(
                        new ContentCommandService.CreateContent(
                                contentId,
                                contentCode,
                                kind(draft.get("contentType")),
                                required(draft, "title"),
                                textOr(draft.get("contentLocale"), "en-US"),
                                textOr(draft.get("targetLevel"), "A1"),
                                "PHASE1"),
                        actor, key(key + ":definition"), context);
                versionSnapshot = commands.createVersion(
                        new ContentCommandService.CreateVersion(
                                contentId,
                                repository.nextVersionId(),
                                payload(draft),
                                rights(draft),
                                textOr(draft.get("releaseNote"), "local B31 draft")),
                        actor, key(key + ":version"), context);
            }
            case "SAVE_DRAFT" -> {
                requireEditor(actor);
                ContentDefinition content = owned(contentCode, actor);
                Map<String, Object> draft = record(input.get("content"));
                versionSnapshot = commands.createVersion(
                        new ContentCommandService.CreateVersion(
                                content.contentId(), repository.nextVersionId(), payload(draft), rights(draft),
                                textOr(draft.get("releaseNote"), "local B31 draft revision")),
                        actor, key(key + ":version"), context);
            }
            case "VALIDATE_DRAFT" -> {
                requireEditor(actor);
                ContentDefinition content = owned(contentCode, actor);
                versionSnapshot = latest(content);
                if (versionSnapshot.status() != ContentVersionStatus.DRAFT) {
                    throw ContentOperationException.conflict("CONTENT_STATE_INVALID", "only a draft can be validated");
                }
            }
            case "SUBMIT_REVIEW" -> {
                requireEditor(actor);
                ContentDefinition content = owned(contentCode, actor);
                ContentVersion version = targetVersion(content, input);
                versionSnapshot = commands.submitForReview(
                        new ContentCommandService.VersionCommand(content.contentId(), version.versionId()),
                        actor, key(key + ":submit"), context);
            }
            case "REVIEW_FIRST", "REVIEW_FINAL" -> {
                ContentDefinition content = owned(contentCode, actor);
                ContentVersion version = targetVersion(content, input);
                ReviewStage stage = "REVIEW_FIRST".equals(command) ? ReviewStage.FIRST_REVIEW : ReviewStage.FINAL_REVIEW;
                ReviewDecision decision = reviewDecision(input.get("reviewDecision"));
                versionSnapshot = commands.review(
                        new ContentCommandService.ReviewCommand(
                                content.contentId(), version.versionId(), stage, decision,
                                textOr(input.get("reasonCode"), "B31_REVIEW"), textOr(input.get("reviewNote"), "")),
                        actor, key(key + ":review:" + stage.name()), context);
            }
            case "PUBLISH" -> {
                ContentDefinition content = owned(contentCode, actor);
                ContentVersion version = targetVersion(content, input);
                versionSnapshot = commands.publish(
                        new ContentCommandService.VersionCommand(content.contentId(), version.versionId()),
                        actor, key(key + ":publish"), context);
            }
            case "UNPUBLISH" -> {
                ContentDefinition content = owned(contentCode, actor);
                ContentVersion version = targetVersion(content, input);
                versionSnapshot = commands.unpublish(
                        new ContentCommandService.VersionCommand(content.contentId(), version.versionId()),
                        actor, key(key + ":unpublish"), context);
            }
            case "ROLLBACK" -> {
                ContentDefinition content = owned(contentCode, actor);
                ContentVersion version = targetVersion(content, input);
                versionSnapshot = commands.rollback(
                        new ContentCommandService.RollbackCommand(content.contentId(), version.versionId()),
                        actor, key(key + ":rollback"), context);
            }
            default -> throw ContentOperationException.badRequest("CONTENT_COMMAND_INVALID", "unsupported content command");
        }
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("commandId", commandId(key));
        result.put("command", command);
        result.put("contentCode", contentCode);
        if (versionSnapshot != null) {
            result.put("contentVersionId", versionSnapshot.versionId().value());
            result.put("stateVersion", versionSnapshot.stateVersion());
        } else if (definitionSnapshot != null) {
            result.put("stateVersion", definitionSnapshot.versionCount());
        } else {
            result.put("stateVersion", stateVersion(owned(contentCode, actor)));
        }
        result.put("status", "ACCEPTED");
        result.put("acceptedAt", Instant.now());
        return ResponseEntity.status(HttpStatus.ACCEPTED).body(Map.of("data", result));
    }

    /**
     * M3-006 projection rebuild (M2-004 reassignment): rebuilds public/learner
     * projections from the owner DB. Cache/Redis copies are consequences, never sources.
     */
    @PostMapping("/projections/rebuild")
    public ResponseEntity<Map<String, Object>> rebuildProjections(
            Authentication authentication,
            @RequestHeader(name = "Idempotency-Key", required = false) String idempotencyKey,
            @RequestHeader HttpHeaders headers) {
        ContentActor actor = adminActor(authentication);
        requireEditor(actor);
        requireIdempotencyKey(idempotencyKey);
        ContentCommandService.RebuildReport report = commands.rebuildPublishedProjections(actor);
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("commandId", commandId(idempotencyKey.trim()));
        data.put("rebuilt", report.rebuilt());
        data.put("skipped", report.skipped());
        data.put("rebuiltAt", report.rebuiltAt());
        data.put("status", "ACCEPTED");
        return ResponseEntity.status(HttpStatus.ACCEPTED).body(Map.of("data", data));
    }

    /**
     * M3-003 automatic validation report: copyright/source/stage/answer-leak/structure.
     * Read-only: never mutates content, never emits projections; the report carries the
     * rule version so audits can replay which checks ran.
     */
    @PostMapping("/validate/auto")
    public ResponseEntity<Map<String, Object>> validateAuto(
            @RequestBody(required = false) Map<String, Object> body,
            Authentication authentication,
            @RequestHeader HttpHeaders headers) {
        ContentActor actor = adminActor(authentication);
        requireAdminRead(actor);
        Map<String, Object> input = body == null ? Map.of() : body;
        String contentCode = text(input.get("contentCode"));
        Map<String, Object> draft = record(input.get("content"));
        ContentRights rights;
        if (!contentCode.isBlank() && repository.findByCode(contentCode).isPresent()) {
            ContentDefinition existing = owned(contentCode, actor);
            ContentVersion latest = existing.versions().stream().reduce((left, right) -> right).orElse(null);
            rights = latest == null || latest.rights().isEmpty() ? rights(draft) : latest.rights().get();
            if (draft.isEmpty() && latest != null) {
                draft = latest.payload().raw();
            }
        } else {
            rights = rights(draft);
        }
        com.englishflow.content.domain.ContentAutoValidation.Report report =
                com.englishflow.content.domain.ContentAutoValidation.validate(draft, rights, Instant.now());
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("passed", report.passed());
        data.put("ruleVersion", report.ruleVersion());
        data.put("findings", report.findings().stream().map(f -> Map.of(
                "code", f.code(), "severity", f.severity(), "detail", f.detail())).toList());
        data.put("summary", report.summary());
        data.put("checkedAt", Instant.now());
        return ResponseEntity.ok(Map.of("data", data));
    }

    /**
     * Idempotent batch import: one Idempotency-Key covers the whole batch; each item
     * derives a stable sub-key so replaying the same batch never creates duplicates.
     * Existing content codes are reported SKIPPED (not FAILED), so retry is safe.
     */
    @PostMapping("/import/batch")
    public ResponseEntity<Map<String, Object>> importBatch(
            @RequestBody(required = false) Map<String, Object> body,
            Authentication authentication,
            @RequestHeader(name = "Idempotency-Key", required = false) String idempotencyKey,
            @RequestHeader HttpHeaders headers) {
        ContentActor actor = adminActor(authentication);
        requireEditor(actor);
        String batchKey = requireIdempotencyKey(idempotencyKey);
        Map<String, Object> input = body == null ? Map.of() : body;
        Object rawItems = input.get("items");
        List<Map<String, Object>> items = rawItems instanceof List<?> list
                ? list.stream().filter(Map.class::isInstance).map(Map.class::cast)
                        .map(B9ContentAdminController::record).toList()
                : List.of();
        if (items.isEmpty()) {
            throw ContentOperationException.badRequest("CONTENT_BATCH_EMPTY", "items must contain at least one entry");
        }
        if (items.size() > 100) {
            throw ContentOperationException.badRequest("CONTENT_BATCH_TOO_LARGE", "at most 100 items per batch");
        }
        ContentRequestContext context = context(headers);
        List<Map<String, Object>> results = new ArrayList<>();
        for (int index = 0; index < items.size(); index++) {
            Map<String, Object> item = items.get(index);
            String contentCode = text(item.get("contentCode"));
            Map<String, Object> draft = record(item.get("content"));
            Map<String, Object> entry = new LinkedHashMap<>();
            entry.put("index", index);
            entry.put("contentCode", contentCode);
            if (contentCode.isBlank()) {
                entry.put("status", "FAILED");
                entry.put("errorCode", "CONTENT_FIELD_REQUIRED");
                results.add(entry);
                continue;
            }
            String subKey = batchKey + ":item:" + index + ":" + contentCode;
            try {
                if (repository.findByCode(contentCode).isPresent()) {
                    ContentDefinition existing = owned(contentCode, actor);
                    entry.put("status", "SKIPPED");
                    entry.put("reason", "CONTENT_EXISTS");
                    entry.put("stateVersion", stateVersion(existing));
                } else {
                    Map<String, Object> merged = new LinkedHashMap<>(draft);
                    merged.putIfAbsent("title", contentCode);
                    ContentId contentId = ContentId.of(contentCode);
                    commands.createContent(
                            new ContentCommandService.CreateContent(
                                    contentId, contentCode, kind(merged.get("contentType")),
                                    required(merged, "title"),
                                    textOr(merged.get("contentLocale"), "en-US"),
                                    textOr(merged.get("targetLevel"), "A1"), "PHASE1"),
                            actor, key(subKey + ":definition"), context);
                    ContentVersionSnapshot created = commands.createVersion(
                            new ContentCommandService.CreateVersion(
                                    contentId, repository.nextVersionId(), payload(merged), rights(merged),
                                    textOr(merged.get("releaseNote"), "batch import")),
                            actor, key(subKey + ":version"), context);
                    entry.put("status", "ACCEPTED");
                    entry.put("contentVersionId", created.versionId().value());
                    entry.put("stateVersion", created.stateVersion());
                }
            } catch (ContentOperationException error) {
                entry.put("status", "FAILED");
                entry.put("errorCode", error.code());
            }
            results.add(entry);
        }
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("batchKey", batchKey);
        data.put("commandId", commandId(batchKey));
        data.put("total", results.size());
        data.put("accepted", results.stream().filter(r -> "ACCEPTED".equals(r.get("status"))).count());
        data.put("skipped", results.stream().filter(r -> "SKIPPED".equals(r.get("status"))).count());
        data.put("failed", results.stream().filter(r -> "FAILED".equals(r.get("status"))).count());
        data.put("items", results);
        data.put("acceptedAt", Instant.now());
        return ResponseEntity.status(HttpStatus.ACCEPTED).body(Map.of("data", data));
    }

    private ContentActor adminActor(Authentication authentication) {
        return principals.from(authentication);
    }

    private static void requireAdminRead(ContentActor actor) {
        if (!actor.canEdit() && !actor.canReviewFirst() && !actor.canReviewFinal() && !actor.canPublish()) {
            throw ContentOperationException.forbidden("CONTENT_ADMIN_REQUIRED", "content admin permission is required");
        }
    }

    private static void requireEditor(ContentActor actor) {
        if (!actor.canEdit()) {
            throw ContentOperationException.forbidden("CONTENT_EDITOR_REQUIRED", "content editor permission is required");
        }
    }

    private ContentDefinition owned(String code, ContentActor actor, boolean ignored) {
        ContentDefinition content = repository.findByCode(code)
                .orElseThrow(() -> ContentOperationException.notFound("CONTENT_NOT_FOUND", "content does not exist"));
        if (!TENANT.equals(content.tenantId()) || !TENANT.equals(actor.tenantId())) {
            throw ContentOperationException.forbidden("CONTENT_TENANT_DENIED", "content tenant scope denied");
        }
        return content;
    }

    private ContentDefinition owned(String code, ContentActor actor) {
        return owned(code, actor, true);
    }

    private static ContentVersion targetVersion(ContentDefinition content, Map<String, Object> input) {
        // Standard optimistic locking: callers pass the stateVersion they read; a stale
        // writer gets 409 VERSION_CONFLICT instead of silently overwriting. The version
        // column is ContentVersion.stateVersion (persisted as content_version.state_version).
        Object expected = input.get("expectedStateVersion");
        if (expected instanceof Number number && number.longValue() > 0) {
            long current = content.versions().stream().mapToLong(ContentVersion::stateVersion).max().orElse(0L);
            if (current != number.longValue()) {
                throw ContentOperationException.conflict("VERSION_CONFLICT",
                        "stale stateVersion: expected " + number.longValue() + " but current is " + current);
            }
        }
        Object raw = input.get("targetVersionNumber");
        if (raw instanceof Number number && number.intValue() > 0) {
            return content.versions().stream()
                    .filter(version -> version.versionNumber() == number.intValue())
                    .findFirst()
                    .orElseThrow(() -> ContentOperationException.notFound("CONTENT_VERSION_NOT_FOUND", "target version does not exist"));
        }
        return content.versions().stream().reduce((left, right) -> right)
                .orElseThrow(() -> ContentOperationException.notFound("CONTENT_VERSION_NOT_FOUND", "content has no version"));
    }

    private static ContentVersionSnapshot latest(ContentDefinition content) {
        ContentVersion version = content.versions().stream().reduce((left, right) -> right)
                .orElseThrow(() -> ContentOperationException.notFound("CONTENT_VERSION_NOT_FOUND", "content has no version"));
        return ContentVersionSnapshot.from(content.contentId(), version);
    }

    private static ContentKind kind(Object raw) {
        String value = text(raw).toUpperCase();
        if ("UNIT".equals(value)) value = "COURSE_UNIT";
        try {
            return ContentKind.valueOf(value.isBlank() ? "COURSE_UNIT" : value);
        } catch (IllegalArgumentException error) {
            throw ContentOperationException.badRequest("CONTENT_KIND_INVALID", "contentType is invalid");
        }
    }

    private static Map<String, Object> payload(Map<String, Object> draft) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("summary", textOr(draft.get("summary"), ""));
        result.put("contentLocale", textOr(draft.get("contentLocale"), "en-US"));
        result.put("targetLevel", textOr(draft.get("targetLevel"), "A1"));
        Object items = draft.get("items");
        result.put("items", items instanceof List<?> list && !list.isEmpty() ? list : List.of(Map.of("displayText", text(draft.get("title")))));
        return result;
    }

    private static ContentRights rights(Map<String, Object> draft) {
        Instant now = Instant.now();
        return new ContentRights(
                textOr(draft.get("sourceCode"), "LOCAL_B31_SOURCE"),
                textOr(draft.get("licenseCode"), "LOCAL_DEV_LICENSE"),
                CopyrightStatus.ACTIVE,
                true,
                Set.of("LEARNER", "PUBLIC"),
                now.minus(1, ChronoUnit.MINUTES),
                null,
                "local-b31-rights-evidence");
    }

    private static ReviewDecision reviewDecision(Object raw) {
        String value = textOr(raw, "APPROVED").toUpperCase();
        try {
            return ReviewDecision.valueOf(value);
        } catch (IllegalArgumentException error) {
            throw ContentOperationException.badRequest("REVIEW_DECISION_INVALID", "reviewDecision is invalid");
        }
    }

    private static String requireIdempotencyKey(String value) {
        if (value == null || value.isBlank()) {
            throw ContentOperationException.badRequest("IDEMPOTENCY_KEY_REQUIRED", "Idempotency-Key is required");
        }
        return value.trim();
    }

    private static ContentIdempotencyKey key(String value) {
        String safe = value.length() > 128 ? value.substring(0, 128) : value;
        return new ContentIdempotencyKey(safe.length() < 16 ? safe + "-b31-idempotency" : safe);
    }

    private static String commandId(String key) {
        return "cmd_" + UUID.nameUUIDFromBytes(key.getBytes(StandardCharsets.UTF_8));
    }

    private static ContentRequestContext context(HttpHeaders headers) {
        String requestId = text(headers.getFirst("X-Request-Id"));
        String traceId = text(headers.getFirst("X-Trace-Id"));
        if (!requestId.matches("[A-Za-z][A-Za-z0-9._-]{7,127}")) requestId = "local-" + UUID.randomUUID();
        if (!traceId.matches("[a-f0-9]{32}")) traceId = hex(UUID.randomUUID().toString().replace("-", ""));
        return new ContentRequestContext(requestId, traceId);
    }

    private static String hex(String value) {
        return value.length() >= 32 ? value.substring(0, 32) : String.format("%-32s", value).replace(' ', '0');
    }

    private static Map<String, Object> state(ContentDefinition content, ContentActor actor) {
        List<Map<String, Object>> versions = content.versions().stream().map(B9ContentAdminController::versionView).toList();
        ContentVersion latest = content.versions().stream().reduce((left, right) -> right).orElse(null);
        String latestStatus = latest == null ? "DRAFT" : latest.status().name();
        Map<String, Object> projection = new LinkedHashMap<>();
        projection.put("availability", content.currentPublishedVersionId().isPresent() ? "PUBLISHED" : "UNPUBLISHED");
        projection.put("projectionVersion", Math.max(1L, content.projectionVersion()));
        projection.put("contentEpoch", Math.max(1L, content.contentEpoch()));
        latestOptional(latest).flatMap(ContentVersion::publishedAt).ifPresent(value -> projection.put("lastPublishedAt", value));
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("contentCode", content.contentCode());
        result.put("contentType", content.kind().name());
        result.put("title", content.title());
        result.put("authorSubject", content.createdBy());
        result.put("stateVersion", stateVersion(content));
        result.put("latestStatus", latestStatus);
        result.put("versions", versions);
        result.put("publicProjection", projection);
        result.put("rightsStatus", latest == null || latest.rights().isEmpty()
                ? "PENDING" : rightsStatus(latest.rights().get().status()));
        result.put("reviewStages", reviewStages(latest));
        return result;
    }

    private static Map<String, Object> versionView(ContentVersion version) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("contentVersionId", version.versionId().value());
        result.put("versionNumber", version.versionNumber());
        result.put("status", version.status().name());
        result.put("stateVersion", version.stateVersion());
        result.put("contentHash", version.contentHash());
        result.put("sourceCode", version.rights().map(ContentRights::sourceCode).orElse(""));
        result.put("licenseCode", version.rights().map(ContentRights::licenseCode).orElse(""));
        version.publishedAt().ifPresent(value -> result.put("publishedAt", value));
        return result;
    }

    private static List<String> reviewStages(ContentVersion version) {
        if (version == null) return List.of();
        return switch (version.status()) {
            case IN_REVIEW -> List.of("FIRST_PENDING");
            case APPROVED -> version.firstReviewer().isPresent() && version.finalReviewer().isEmpty()
                    ? List.of("FINAL_PENDING") : List.of("FINAL_APPROVED");
            case PUBLISHED -> List.of("FINAL_APPROVED");
            default -> List.of();
        };
    }

    private static String rightsStatus(CopyrightStatus status) {
        return status == CopyrightStatus.ACTIVE ? "VALID" : status.name();
    }

    private static long stateVersion(ContentDefinition content) {
        return content.versions().stream().mapToLong(ContentVersion::stateVersion).max().orElse(0L);
    }

    private static java.util.Optional<ContentVersion> latestOptional(ContentVersion value) {
        return java.util.Optional.ofNullable(value);
    }

    private static Map<String, Object> envelope(Object data, HttpHeaders headers) {
        return Map.of("data", data, "meta", Map.of(
                "source", "CONTENT_SERVICE",
                "stale", false,
                "requestId", text(headers.getFirst("X-Request-Id")),
                "traceId", text(headers.getFirst("X-Trace-Id"))));
    }

    private static Map<String, Object> record(Object value) {
        if (!(value instanceof Map<?, ?> raw)) return Map.of();
        Map<String, Object> result = new LinkedHashMap<>();
        raw.forEach((key, item) -> result.put(String.valueOf(key), item));
        return result;
    }

    private static String required(Map<String, Object> values, String name) {
        String value = text(values.get(name));
        if (value.isBlank()) throw ContentOperationException.badRequest("CONTENT_FIELD_REQUIRED", name + " is required");
        return value;
    }

    private static String text(Object value) {
        return value instanceof String string ? string.trim() : "";
    }

    private static String textOr(Object value, String fallback) {
        String text = text(value);
        return text.isBlank() ? fallback : text;
    }
}
