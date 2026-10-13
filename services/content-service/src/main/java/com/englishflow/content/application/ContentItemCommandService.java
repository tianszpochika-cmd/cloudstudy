package com.englishflow.content.application;

import com.englishflow.content.domain.ContentActor;
import com.englishflow.content.domain.ContentIdempotencyKey;
import com.englishflow.content.domain.ContentItem;
import com.englishflow.content.domain.ContentOperationException;
import com.englishflow.content.domain.ContentOutboxEvent;
import com.englishflow.content.domain.ContentPayloadHash;
import com.englishflow.content.domain.ContentRequestContext;
import com.englishflow.content.domain.ItemAvailability;
import com.englishflow.content.domain.ReviewDecision;
import com.englishflow.content.domain.ReviewStage;
import com.englishflow.content.port.ContentIdempotencyPort;
import com.englishflow.content.port.ContentItemRepository;
import com.englishflow.content.port.ContentOutboxPort;

import java.time.Clock;
import java.time.Instant;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

/** Row-level item commands owned by content-service. Authors cannot self-review. */
public final class ContentItemCommandService {

    private static final String TENANT = "platform";

    private final ContentItemRepository items;
    private final ContentOutboxPort outbox;
    private final ContentIdempotencyPort idempotency;
    private final Clock clock;

    public ContentItemCommandService(
            ContentItemRepository items,
            ContentOutboxPort outbox,
            ContentIdempotencyPort idempotency,
            Clock clock) {
        this.items = Objects.requireNonNull(items, "items are required");
        this.outbox = Objects.requireNonNull(outbox, "outbox is required");
        this.idempotency = Objects.requireNonNull(idempotency, "idempotency is required");
        this.clock = Objects.requireNonNull(clock, "clock is required");
    }

    public record ItemResult(String itemId, long stateVersion, ItemAvailability availability) {
    }

    public ItemResult upsert(
            String packCode,
            Map<String, Object> input,
            String itemId,
            ContentActor actor,
            ContentIdempotencyKey key,
            ContentRequestContext context) {
        return upsert(packCode, input, itemId, null, actor, key, context);
    }

    /** Optimistic-lock aware upsert; a positive expectedStateVersion must match the row (else 409). */
    public ItemResult upsert(
            String packCode,
            Map<String, Object> input,
            String itemId,
            Long expectedStateVersion,
            ContentActor actor,
            ContentIdempotencyKey key,
            ContentRequestContext context) {
        requireEditor(actor);
        String kind = kindOf(input);
        ContentItem.requirePackForKind(packCode, kind);
        String stem = text(input.get("stem"));
        Map<String, Object> fields = fieldsOf(input);
        Map<String, Object> validated = ContentItem.validatedFields(kind, fields);
        return idempotency.execute(
                scope(actor, "item.upsert"), key, fingerprint(packCode, kind, stem, validated),
                () -> {
                    Instant now = clock.instant();
                    if (itemId != null && !itemId.isBlank()) {
                        ContentItem existing = items.findById(itemId.trim())
                                .orElseThrow(() -> ContentOperationException.notFound("ITEM_NOT_FOUND",
                                        "item does not exist"));
                        assertExpectedPack(existing, packCode);
                        if (expectedStateVersion != null && expectedStateVersion != existing.stateVersion()) {
                            throw ContentOperationException.conflict("ITEM_VERSION_CONFLICT",
                                    "stale stateVersion: expected " + expectedStateVersion
                                            + " but current is " + existing.stateVersion());
                        }
                        boolean openedRevision = existing.availability() != ItemAvailability.DRAFT;
                        existing.applyUpsert(stem, validated, actor.subjectId(), now);
                        items.save(existing);
                        if (openedRevision) {
                            audit(existing, "content.item.revision-opened.v1", actor, null, null, context, now);
                        }
                        return resultOf(existing);
                    }
                    String id = prefix(kind) + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
                    ContentItem created = ContentItem.create(id, TENANT, packCode, kind, stem, validated,
                            textOrNull(input.get("sourceCode")), textOrNull(input.get("licenseCode")),
                            actor.subjectId(), now);
                    items.save(created);
                    return resultOf(created);
                });
    }

    public ItemResult submit(String packCode, String itemId, ContentActor actor,
            ContentIdempotencyKey key, ContentRequestContext context) {
        requireEditor(actor);
        return idempotency.execute(
                scope(actor, "item.submit"), key, fingerprint(packCode, itemId),
                () -> {
                    ContentItem item = owned(packCode, itemId, actor);
                    Instant now = clock.instant();
                    item.submit(actor.subjectId(), now);
                    items.save(item);
                    audit(item, "content.item.submitted.v1", actor, null, null, context, now);
                    return resultOf(item);
                });
    }

    public ItemResult reviewFirst(String packCode, String itemId, ReviewDecision decision,
            ContentActor actor, ContentIdempotencyKey key, ContentRequestContext context) {
        return reviewFirst(packCode, itemId, decision, null, actor, key, context);
    }

    public ItemResult reviewFirst(String packCode, String itemId, ReviewDecision decision, String reviewNote,
            ContentActor actor, ContentIdempotencyKey key, ContentRequestContext context) {
        if (!actor.canReviewFirst()) {
            throw ContentOperationException.forbidden("ITEM_REVIEW_REQUIRED", "first-review permission is required");
        }
        return idempotency.execute(
                scope(actor, "item.review-first"), key, fingerprint(packCode, itemId, decision, reviewNote),
                () -> decide(packCode, itemId, ReviewStage.FIRST_REVIEW, decision, reviewNote, actor, context));
    }

    public ItemResult reviewFinal(String packCode, String itemId, ReviewDecision decision,
            ContentActor actor, ContentIdempotencyKey key, ContentRequestContext context) {
        return reviewFinal(packCode, itemId, decision, null, actor, key, context);
    }

    public ItemResult reviewFinal(String packCode, String itemId, ReviewDecision decision, String reviewNote,
            ContentActor actor, ContentIdempotencyKey key, ContentRequestContext context) {
        if (!actor.canReviewFinal()) {
            throw ContentOperationException.forbidden("ITEM_REVIEW_REQUIRED", "final-review permission is required");
        }
        return idempotency.execute(
                scope(actor, "item.review-final"), key, fingerprint(packCode, itemId, decision, reviewNote),
                () -> decide(packCode, itemId, ReviewStage.FINAL_REVIEW, decision, reviewNote, actor, context));
    }

    public ItemResult publish(String packCode, String itemId, String reasonCode,
            ContentActor actor, ContentIdempotencyKey key, ContentRequestContext context) {
        requirePublisher(actor);
        requireReason(reasonCode);
        return idempotency.execute(
                scope(actor, "item.publish"), key, fingerprint(packCode, itemId, reasonCode),
                () -> {
                    ContentItem item = owned(packCode, itemId, actor);
                    Instant now = clock.instant();
                    item.publish(actor.subjectId(), now);
                    items.save(item);
                    outbox.appendAfterFact(ContentOutboxEvent.create(
                            "content-item", item.itemId(), "content.item.published.v1",
                            actor.subjectId(),
                            item.itemId() + ":published:" + item.stateVersion(),
                            "{\"itemId\":\"" + item.itemId() + "\",\"packCode\":\"" + item.packCode()
                                    + "\",\"kind\":\"" + item.kind() + "\",\"stateVersion\":"
                                    + item.stateVersion() + "}",
                            context, now));
                    return resultOf(item);
                });
    }

    public ItemResult unpublish(String packCode, String itemId, String reasonCode,
            ContentActor actor, ContentIdempotencyKey key, ContentRequestContext context) {
        requirePublisher(actor);
        requireReason(reasonCode);
        return idempotency.execute(
                scope(actor, "item.unpublish"), key, fingerprint(packCode, itemId, reasonCode),
                () -> {
                    ContentItem item = owned(packCode, itemId, actor);
                    Instant now = clock.instant();
                    item.unpublish(actor.subjectId(), now);
                    items.save(item);
                    outbox.appendAfterFact(ContentOutboxEvent.create(
                            "content-item", item.itemId(), "content.item.unpublished.v1",
                            actor.subjectId(),
                            item.itemId() + ":unpublished:" + item.stateVersion(),
                            "{\"itemId\":\"" + item.itemId() + "\",\"packCode\":\"" + item.packCode()
                                    + "\",\"stateVersion\":" + item.stateVersion() + "}",
                            context, now));
                    return resultOf(item);
                });
    }

    public ItemResult archive(String packCode, String itemId, String reasonCode,
            ContentActor actor, ContentIdempotencyKey key, ContentRequestContext context) {
        requireEditor(actor);
        requireReason(reasonCode);
        return idempotency.execute(
                scope(actor, "item.archive"), key, fingerprint(packCode, itemId, reasonCode),
                () -> {
                    ContentItem item = owned(packCode, itemId, actor);
                    item.archive(actor.subjectId(), clock.instant());
                    items.save(item);
                    return resultOf(item);
                });
    }

    public ContentItem current(String packCode, String itemId, ContentActor actor) {
        requireRead(actor);
        return owned(packCode, itemId, actor);
    }

    /** Batch-import dry run: validates like upsert and finds an identical live row (same kind, stem and fields). */
    public record ItemPrecheck(String kind, String stem, String contentKey, String duplicateItemId) {
    }

    public ItemPrecheck precheck(String packCode, Map<String, Object> input, ContentActor actor) {
        requireEditor(actor);
        if (packCode == null || packCode.isBlank()) {
            throw ContentOperationException.badRequest("ITEM_FIELD_INVALID", "contentCode (pack) is required");
        }
        String kind = kindOf(input);
        ContentItem.requirePackForKind(packCode.trim(), kind);
        String stem = text(input.get("stem"));
        Map<String, Object> validated = ContentItem.validatedFields(kind, fieldsOf(input));
        String contentKey = ContentPayloadHash.sha256(Map.of("kind", kind, "stem", stem.trim(), "fields", validated));
        String duplicate = items.search(packCode.trim(), kind, stem.isBlank() ? null : stem.trim(), null, 100, null)
                .stream()
                .filter(row -> row.availability() != ItemAvailability.ARCHIVED)
                .filter(row -> row.stem().trim().equals(stem.trim()))
                .filter(row -> ContentPayloadHash.sha256(Map.of("kind", row.kind(), "stem", row.stem().trim(),
                        "fields", row.fields())).equals(contentKey))
                .map(ContentItem::itemId)
                .findFirst()
                .orElse(null);
        return new ItemPrecheck(kind, stem, contentKey, duplicate);
    }

    public java.util.List<ContentItem> search(String packCode, String kind, String query,
            ItemAvailability availability, int limit, String afterItemId, ContentActor actor) {
        requireRead(actor);
        return items.search(packCode, kind, query, availability, limit, afterItemId);
    }

    private ContentItem owned(String packCode, String itemId, ContentActor actor) {
        if (!TENANT.equals(actor.tenantId())) {
            throw ContentOperationException.forbidden("ITEM_TENANT_DENIED", "item tenant scope denied");
        }
        if (itemId == null || itemId.isBlank()) {
            throw ContentOperationException.badRequest("ITEM_FIELD_INVALID", "itemId is required");
        }
        ContentItem item = items.findById(itemId.trim())
                .orElseThrow(() -> ContentOperationException.notFound("ITEM_NOT_FOUND", "item does not exist"));
        assertExpectedPack(item, packCode);
        return item;
    }

    private static void assertExpectedPack(ContentItem item, String packCode) {
        if (packCode != null && !packCode.isBlank() && !item.packCode().equals(packCode.trim())) {
            throw ContentOperationException.forbidden("ITEM_TENANT_DENIED", "item pack scope denied");
        }
    }

    private static ItemResult resultOf(ContentItem item) {
        return new ItemResult(item.itemId(), item.stateVersion(), item.availability());
    }

    private static void requireEditor(ContentActor actor) {
        if (!actor.canEdit()) {
            throw ContentOperationException.forbidden("ITEM_EDITOR_REQUIRED", "item editor permission is required");
        }
    }

    private static void requirePublisher(ContentActor actor) {
        if (!actor.canPublish()) {
            throw ContentOperationException.forbidden("ITEM_PUBLISHER_REQUIRED", "item publisher permission is required");
        }
    }

    private static void requireRead(ContentActor actor) {
        if (!actor.canEdit() && !actor.canReviewFirst() && !actor.canReviewFinal() && !actor.canPublish()) {
            throw ContentOperationException.forbidden("ITEM_ADMIN_REQUIRED", "item admin permission is required");
        }
    }

    private static void requireReason(String reasonCode) {
        if (reasonCode == null || reasonCode.isBlank()) {
            throw ContentOperationException.badRequest("ITEM_FIELD_INVALID", "reasonCode is required for audit");
        }
    }

    private ItemResult decide(String packCode, String itemId, ReviewStage stage, ReviewDecision decision,
            String reviewNote, ContentActor actor, ContentRequestContext context) {
        if (decision == null) {
            throw ContentOperationException.badRequest("ITEM_REVIEW_DECISION_INVALID", "reviewDecision is required");
        }
        ContentItem item = owned(packCode, itemId, actor);
        Instant now = clock.instant();
        if (decision == ReviewDecision.APPROVED) {
            if (stage == ReviewStage.FIRST_REVIEW) {
                item.reviewFirst(actor.subjectId(), now);
            } else {
                item.reviewFinal(actor.subjectId(), now);
            }
            items.save(item);
            audit(item, "content.item.review-approved.v1", actor, stage.name(), null, context, now);
        } else {
            item.reject(stage, decision, actor.subjectId(), reviewNote, now);
            items.save(item);
            audit(item, "content.item.review-rejected.v1", actor, stage.name() + ":" + decision.name(),
                    item.trail().lastNote(), context, now);
        }
        return resultOf(item);
    }

    private void audit(ContentItem item, String eventType, ContentActor actor, String decision, String note,
            ContentRequestContext context, Instant now) {
        outbox.appendAfterFact(ContentOutboxEvent.create(
                "content-item", item.itemId(), eventType, actor.subjectId(),
                item.itemId() + ":" + eventType + ":" + item.stateVersion(),
                "{\"itemId\":" + ReviewAuditJson.quote(item.itemId())
                        + ",\"packCode\":" + ReviewAuditJson.quote(item.packCode())
                        + ",\"availability\":" + ReviewAuditJson.quote(item.availability().name())
                        + ",\"stateVersion\":" + item.stateVersion()
                        + ",\"actor\":" + ReviewAuditJson.quote(actor.subjectId())
                        + ",\"decision\":" + ReviewAuditJson.quote(decision)
                        + ",\"note\":" + ReviewAuditJson.quote(note)
                        + ",\"revisionOfLive\":" + item.trail().revisionOfLive() + "}",
                context, now));
    }

    private static String kindOf(Map<String, Object> input) {
        Objects.requireNonNull(input, "item is required");
        Object kind = input.get("kind");
        if (!(kind instanceof String text) || !ContentItem.KINDS.contains(text.trim().toUpperCase())) {
            throw ContentOperationException.badRequest("ITEM_KIND_INVALID", "item kind is invalid");
        }
        return text.trim().toUpperCase();
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> fieldsOf(Map<String, Object> input) {
        Object fields = input.get("fields");
        if (fields == null) {
            return Map.of();
        }
        if (!(fields instanceof Map<?, ?> map)) {
            throw ContentOperationException.badRequest("ITEM_FIELD_INVALID", "fields must be an object");
        }
        Map<String, Object> result = new java.util.LinkedHashMap<>();
        for (Map.Entry<?, ?> entry : map.entrySet()) {
            result.put(String.valueOf(entry.getKey()), entry.getValue());
        }
        return result;
    }

    private static String prefix(String kind) {
        return switch (kind) {
            case "QUESTION" -> "qi_";
            case "EXAMPLE" -> "ex_";
            case "GRAMMAR_POINT" -> "gr_";
            case "PASSAGE" -> "ps_";
            case "DICTATION" -> "dc_";
            case "SHADOWING" -> "sh_";
            default -> "ew_";
        };
    }

    private static String scope(ContentActor actor, String operation) {
        return actor.tenantId() + ":" + actor.subjectId() + ":" + operation;
    }

    private static String fingerprint(Object... parts) {
        StringBuilder joined = new StringBuilder();
        for (Object part : parts) {
            joined.append(part == null ? "null" : part.toString()).append('|');
        }
        return ContentPayloadHash.sha256(Map.of("command", joined.toString()));
    }

    private static String text(Object value) {
        return value instanceof String string ? string.trim() : "";
    }

    private static String textOrNull(Object value) {
        String text = text(value);
        return text.isEmpty() ? null : text;
    }
}
