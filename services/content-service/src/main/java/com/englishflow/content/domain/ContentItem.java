package com.englishflow.content.domain;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Row-level content item owned by content-service.
 *
 * <p>Fixed fields carry identity, kind, lifecycle and query dimensions. The
 * extensible item configuration (options, answer rules, explanations, media
 * references, difficulty, tags) travels inside {@code fields} and is persisted
 * as {@code fields_json}.</p>
 */
public final class ContentItem {

    /**
     * Row-level item kinds. DICTATION (listening dictation) and SHADOWING
     * (speaking shadowing) are the B4 multilingual interaction kinds; they run
     * the same draft/review/publish lifecycle as the five historical kinds.
     */
    public static final Set<String> KINDS = Set.of(
            "QUESTION", "EXAMPLE", "GRAMMAR_POINT", "PASSAGE", "EXERCISE", "DICTATION", "SHADOWING",
            "PHONEME", "MINIMAL_PAIR");

    /** Phonetics library kinds; they live only in PHONETICS / PHONETICS-{LANG} packs. */
    public static final Set<String> PHONETIC_KINDS = Set.of("PHONEME", "MINIMAL_PAIR");

    private static final Pattern PHONETICS_PACK = Pattern.compile("PHONETICS(-[A-Z]{2,3})?");
    private static final Pattern PHONEME_GROUP = Pattern.compile("[A-Z][A-Z_]{1,31}");

    public static boolean isPhoneticsPack(String packCode) {
        return packCode != null && PHONETICS_PACK.matcher(packCode.trim()).matches();
    }

    /** Phonetic kinds and phonetics packs must match both ways so the catalog never mixes in quiz rows. */
    public static void requirePackForKind(String packCode, String kind) {
        boolean phoneticKind = PHONETIC_KINDS.contains(kind);
        if (phoneticKind != isPhoneticsPack(packCode)) {
            throw ContentOperationException.badRequest("ITEM_KIND_PACK_MISMATCH", phoneticKind
                    ? "PHONEME / MINIMAL_PAIR items belong to a PHONETICS or PHONETICS-{LANG} pack"
                    : "phonetics packs only accept PHONEME / MINIMAL_PAIR items");
        }
    }

    private static final Pattern SAFE_CODE = Pattern.compile("[A-Za-z0-9][A-Za-z0-9._:-]{0,127}");

    private final String itemId;
    private final String tenantId;
    private final String packCode;
    private final String kind;
    private String stem;
    private ItemAvailability availability;
    private long stateVersion;
    private final String createdBy;
    private String updatedBy;
    private String firstReviewer;
    private String finalReviewer;
    private String publisher;
    private String sourceCode;
    private String licenseCode;
    private Map<String, Object> fields;
    private final Instant createdAt;
    private Instant updatedAt;
    private ReviewTrail trail = ReviewTrail.EMPTY;

    public ContentItem(
            String itemId, String tenantId, String packCode, String kind, String stem,
            ItemAvailability availability, long stateVersion,
            String createdBy, String updatedBy, String firstReviewer, String finalReviewer,
            String publisher, String sourceCode, String licenseCode,
            Map<String, Object> fields, Instant createdAt, Instant updatedAt) {
        this.itemId = requireCode(itemId, "itemId");
        this.tenantId = requireCode(tenantId, "tenantId");
        this.packCode = requireCode(packCode, "packCode");
        if (!KINDS.contains(kind)) {
            throw ContentOperationException.badRequest("ITEM_KIND_INVALID", "item kind is invalid");
        }
        this.kind = kind;
        this.stem = stem == null ? "" : stem;
        this.availability = Objects.requireNonNull(availability, "availability is required");
        this.stateVersion = stateVersion;
        this.createdBy = requireCode(createdBy, "createdBy");
        this.updatedBy = updatedBy;
        this.firstReviewer = firstReviewer;
        this.finalReviewer = finalReviewer;
        this.publisher = publisher;
        this.sourceCode = sourceCode;
        this.licenseCode = licenseCode;
        this.fields = fields == null ? Map.of() : Map.copyOf(fields);
        this.createdAt = Objects.requireNonNull(createdAt, "createdAt is required");
        this.updatedAt = Objects.requireNonNull(updatedAt, "updatedAt is required");
    }

    public static ContentItem create(
            String itemId, String tenantId, String packCode, String kind, String stem,
            Map<String, Object> fields, String sourceCode, String licenseCode,
            String createdBy, Instant now) {
        return new ContentItem(itemId, tenantId, packCode, kind, stem,
                ItemAvailability.DRAFT, 1L, createdBy, createdBy,
                null, null, null, sourceCode, licenseCode, fields, now, now);
    }

    public String itemId() {
        return itemId;
    }

    public String tenantId() {
        return tenantId;
    }

    public String packCode() {
        return packCode;
    }

    public String kind() {
        return kind;
    }

    public String stem() {
        return stem;
    }

    public ItemAvailability availability() {
        return availability;
    }

    public long stateVersion() {
        return stateVersion;
    }

    public String createdBy() {
        return createdBy;
    }

    public String updatedBy() {
        return updatedBy;
    }

    public String firstReviewer() {
        return firstReviewer;
    }

    public String finalReviewer() {
        return finalReviewer;
    }

    public String publisher() {
        return publisher;
    }

    public String sourceCode() {
        return sourceCode;
    }

    public String licenseCode() {
        return licenseCode;
    }

    public Map<String, Object> fields() {
        return fields;
    }

    public Instant createdAt() {
        return createdAt;
    }

    public Instant updatedAt() {
        return updatedAt;
    }

    public ReviewTrail trail() {
        return trail;
    }

    /** Rehydrates persisted review bookkeeping; adapters call this right after construction. */
    public ContentItem restoreTrail(ReviewTrail restored) {
        this.trail = restored == null ? ReviewTrail.EMPTY : restored;
        return this;
    }

    /** True when learners still see a published copy (PUBLISHED, or a revision draft of a live row). */
    public boolean isLive() {
        return availability == ItemAvailability.PUBLISHED || trail.revisionOfLive();
    }

    /**
     * DRAFT rows are edited in place; editing an APPROVED/PUBLISHED row opens a
     * revision (back to DRAFT, both reviews again). IN_REVIEW/ARCHIVED are frozen.
     */
    public void applyUpsert(String stem, Map<String, Object> nextFields, String editor, Instant now) {
        if (availability == ItemAvailability.APPROVED || availability == ItemAvailability.PUBLISHED) {
            boolean live = availability == ItemAvailability.PUBLISHED || trail.revisionOfLive();
            this.availability = ItemAvailability.DRAFT;
            this.firstReviewer = null;
            this.finalReviewer = null;
            this.trail = trail.revision(live);
        } else if (availability != ItemAvailability.DRAFT) {
            throw ContentOperationException.conflict("ITEM_STATE_INVALID",
                    "an item under review or archived cannot be edited");
        }
        this.stem = stem == null ? "" : stem;
        this.fields = Map.copyOf(nextFields);
        this.updatedBy = editor;
        this.updatedAt = now;
        this.stateVersion += 1;
    }

    public void submit(String editor, Instant now) {
        requireTransition(availability.canSubmit(), "only a DRAFT item can be submitted");
        this.availability = ItemAvailability.IN_REVIEW;
        this.trail = trail.submitted(editor);
        this.updatedBy = editor;
        this.updatedAt = now;
        this.stateVersion += 1;
    }

    public void reviewFirst(String reviewer, Instant now) {
        requireTransition(availability.canReview(), "only an IN_REVIEW item can be first-reviewed");
        if (firstReviewer != null) {
            throw ContentOperationException.conflict("ITEM_REVIEW_DUPLICATE", "the FIRST review is already completed");
        }
        trail.requireNotAuthorAtFirstReview(reviewer, updatedBy, createdBy, "ITEM");
        if (trail.submittedBy() == null) {
            // Legacy row: pin the inferred submitter before updatedBy is overwritten (P2-1).
            this.trail = trail.submitted(updatedBy);
        }
        this.firstReviewer = reviewer;
        this.trail = trail.decided("APPROVED_FIRST", null, reviewer, now);
        this.updatedBy = reviewer;
        this.updatedAt = now;
        this.stateVersion += 1;
    }

    public void reviewFinal(String reviewer, Instant now) {
        requireTransition(availability.canReview(), "only an IN_REVIEW item can be final-reviewed");
        if (firstReviewer == null) {
            throw ContentOperationException.conflict("ITEM_REVIEW_ORDER_INVALID",
                    "FINAL review requires a completed FIRST review");
        }
        if (reviewer.equals(firstReviewer)) {
            throw ContentOperationException.forbidden("ITEM_SELF_REVIEW_DENIED",
                    "the author of the first review cannot approve the final review");
        }
        trail.requireNotAuthorAfterFirstReview(reviewer, createdBy, true, "ITEM");
        this.finalReviewer = reviewer;
        this.trail = trail.decided("APPROVED_FINAL", null, reviewer, now);
        this.availability = ItemAvailability.APPROVED;
        this.updatedBy = reviewer;
        this.updatedAt = now;
        this.stateVersion += 1;
    }

    /** Sends an IN_REVIEW item back to its author with a reason; both reviews restart. */
    public void reject(ReviewStage stage, ReviewDecision decision, String reviewer, String note, Instant now) {
        requireTransition(availability.canReview(), "only an IN_REVIEW item can be rejected");
        if (decision == ReviewDecision.APPROVED) {
            throw ContentOperationException.badRequest("ITEM_REVIEW_DECISION_INVALID", "reject needs a non-APPROVED decision");
        }
        if (stage == ReviewStage.FINAL_REVIEW && firstReviewer == null) {
            throw ContentOperationException.conflict("ITEM_REVIEW_ORDER_INVALID",
                    "FINAL review requires a completed FIRST review");
        }
        if (firstReviewer == null) {
            trail.requireNotAuthorAtFirstReview(reviewer, updatedBy, createdBy, "ITEM");
        } else {
            trail.requireNotAuthorAfterFirstReview(reviewer, createdBy, false, "ITEM");
        }
        String reason = ReviewTrail.requireRejectNote(note, "ITEM");
        this.availability = ItemAvailability.DRAFT;
        this.firstReviewer = null;
        this.finalReviewer = null;
        this.trail = trail.decided(decision.name() + "_" + (stage == ReviewStage.FIRST_REVIEW ? "FIRST" : "FINAL"),
                reason, reviewer, now);
        this.updatedBy = reviewer;
        this.updatedAt = now;
        this.stateVersion += 1;
    }

    public void publish(String publisher, Instant now) {
        requireTransition(availability.canPublish(), "only an APPROVED item can be published");
        this.availability = ItemAvailability.PUBLISHED;
        this.trail = trail.revision(false);
        this.publisher = publisher;
        this.updatedBy = publisher;
        this.updatedAt = now;
        this.stateVersion += 1;
    }

    public void unpublish(String publisher, Instant now) {
        if (availability != ItemAvailability.PUBLISHED && trail.revisionOfLive()) {
            this.trail = trail.revision(false);
            this.updatedBy = publisher;
            this.updatedAt = now;
            this.stateVersion += 1;
            return;
        }
        requireTransition(availability.canUnpublish(), "only a PUBLISHED item can be unpublished");
        this.availability = ItemAvailability.APPROVED;
        this.updatedBy = publisher;
        this.updatedAt = now;
        this.stateVersion += 1;
    }

    public void archive(String actor, Instant now) {
        requireTransition(availability.canArchive(), "this item state cannot be archived");
        if (trail.revisionOfLive()) {
            throw ContentOperationException.conflict("ITEM_REVISION_LIVE",
                    "this draft revises a live item; unpublish the live copy before archiving");
        }
        this.availability = ItemAvailability.ARCHIVED;
        this.updatedBy = actor;
        this.updatedAt = now;
        this.stateVersion += 1;
    }

    private static void requireTransition(boolean allowed, String message) {
        if (!allowed) {
            throw ContentOperationException.conflict("ITEM_STATE_INVALID", message);
        }
    }

    private static String requireCode(String value, String field) {
        Objects.requireNonNull(value, field + " is required");
        if (!SAFE_CODE.matcher(value).matches()) {
            throw ContentOperationException.badRequest("ITEM_FIELD_INVALID", field + " has an unsafe format");
        }
        return value;
    }

    /** Structural validation for the extensible fields map. Unknown keys are allowed. */
    public static Map<String, Object> validatedFields(String kind, Map<String, Object> raw) {
        Objects.requireNonNull(raw, "item fields are required");
        if ("QUESTION".equals(kind) || "EXERCISE".equals(kind)) {
            Object options = raw.get("options");
            if (options != null && (!(options instanceof List<?> list) || list.size() > 8)) {
                throw ContentOperationException.badRequest("ITEM_FIELD_INVALID", "options must contain at most 8 entries");
            }
            Object answer = raw.get("answerIndex");
            if (answer != null && (!(answer instanceof Number number) || number.intValue() < 0)) {
                throw ContentOperationException.badRequest("ITEM_FIELD_INVALID", "answerIndex must be a non-negative number");
            }
        }
        if ("PHONEME".equals(kind)) {
            String symbol = phoneticText(raw, "symbol", 16);
            if (symbol.isEmpty()) {
                throw ContentOperationException.badRequest("ITEM_FIELD_INVALID", "symbol is required");
            }
            String group = phoneticText(raw, "group", 32);
            if (!PHONEME_GROUP.matcher(group).matches()) {
                throw ContentOperationException.badRequest("ITEM_FIELD_INVALID",
                        "group is required, upper-case like MONOPHTHONG / CONSONANT");
            }
            phoneticText(raw, "exampleWord", 64);
            phoneticText(raw, "description", 500);
        }
        if ("MINIMAL_PAIR".equals(kind)) {
            if (phoneticText(raw, "leftWord", 64).isEmpty() || phoneticText(raw, "rightWord", 64).isEmpty()) {
                throw ContentOperationException.badRequest("ITEM_FIELD_INVALID", "leftWord and rightWord are required");
            }
            for (String key : List.of("leftPhonemeId", "rightPhonemeId")) {
                Object value = raw.get(key);
                if (value != null && !(value instanceof Number) && !(value instanceof String)) {
                    throw ContentOperationException.badRequest("ITEM_FIELD_INVALID", key + " must be a number or id");
                }
            }
        }
        Object tags = raw.get("tags");
        if (tags != null && (!(tags instanceof List<?> tagList) || tagList.size() > 20)) {
            throw ContentOperationException.badRequest("ITEM_FIELD_INVALID", "tags must contain at most 20 entries");
        }
        return Map.copyOf(raw);
    }

    private static String phoneticText(Map<String, Object> raw, String key, int max) {
        Object value = raw.get(key);
        if (value == null) {
            return "";
        }
        if (!(value instanceof String text) || text.trim().length() > max) {
            throw ContentOperationException.badRequest("ITEM_FIELD_INVALID", key + " must be text up to " + max + " chars");
        }
        return text.trim();
    }
}
