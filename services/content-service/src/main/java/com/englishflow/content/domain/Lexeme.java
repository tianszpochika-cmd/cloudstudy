package com.englishflow.content.domain;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Row-level word master owned by content-service.
 *
 * <p>Fixed fields carry identity, lifecycle and query dimensions. All rich,
 * extensible configuration (lemma, pos, senses, examples, collocations,
 * morphology, mnemonics, tags, phonetic/audio references) travels inside the
 * {@code fields} map and is persisted as {@code fields_json}, so new
 * configuration fields never require DDL. Audio bytes never flow through this
 * aggregate; pronunciations reference media-service assets by id.</p>
 */
public final class Lexeme {

    private static final Pattern SAFE_CODE = Pattern.compile("[A-Za-z0-9][A-Za-z0-9._:-]{0,127}");
    /**
     * BCP-47 language ribbon shared with the {@code B9Locale} contract pattern.
     * {@code en-US} is the legacy default; French rows use {@code fr-FR}, German rows {@code de-DE}.
     */
    private static final Pattern LANGUAGE = Pattern.compile("[a-z]{2,3}(-[A-Z][a-z]{3})?(-[A-Z]{2})?");
    public static final String DEFAULT_LANGUAGE = "en-US";

    private final String lexemeId;
    private final String tenantId;
    private final String packCode;
    private final String headword;
    private final String language;
    private final String cefr;
    private LexemeAvailability availability;
    private long stateVersion;
    private int contentVersion;
    private final String createdBy;
    private String updatedBy;
    private String firstReviewer;
    private String finalReviewer;
    private String publisher;
    private Map<String, Object> fields;
    private Map<String, Object> publishedFields;
    private final Instant createdAt;
    private Instant updatedAt;
    private ReviewTrail trail = ReviewTrail.EMPTY;

    public Lexeme(
            String lexemeId,
            String tenantId,
            String packCode,
            String headword,
            String language,
            String cefr,
            LexemeAvailability availability,
            long stateVersion,
            int contentVersion,
            String createdBy,
            String updatedBy,
            String firstReviewer,
            String finalReviewer,
            String publisher,
            Map<String, Object> fields,
            Instant createdAt,
            Instant updatedAt) {
        this(lexemeId, tenantId, packCode, headword, language, cefr, availability, stateVersion, contentVersion,
                createdBy, updatedBy, firstReviewer, finalReviewer, publisher, fields, null, createdAt, updatedAt);
    }

    public Lexeme(
            String lexemeId,
            String tenantId,
            String packCode,
            String headword,
            String language,
            String cefr,
            LexemeAvailability availability,
            long stateVersion,
            int contentVersion,
            String createdBy,
            String updatedBy,
            String firstReviewer,
            String finalReviewer,
            String publisher,
            Map<String, Object> fields,
            Map<String, Object> publishedFields,
            Instant createdAt,
            Instant updatedAt) {
        this.lexemeId = requireCode(lexemeId, "lexemeId");
        this.tenantId = requireCode(tenantId, "tenantId");
        this.packCode = requireCode(packCode, "packCode");
        this.headword = requireHeadword(headword);
        this.language = requireLanguage(language);
        this.cefr = cefr == null ? null : cefr.trim().toUpperCase();
        this.availability = Objects.requireNonNull(availability, "availability is required");
        this.stateVersion = stateVersion;
        this.contentVersion = contentVersion;
        this.createdBy = requireCode(createdBy, "createdBy");
        this.updatedBy = updatedBy;
        this.firstReviewer = firstReviewer;
        this.finalReviewer = finalReviewer;
        this.publisher = publisher;
        this.fields = fields == null ? Map.of() : Map.copyOf(fields);
        this.publishedFields = publishedFields == null ? null : Map.copyOf(publishedFields);
        this.createdAt = Objects.requireNonNull(createdAt, "createdAt is required");
        this.updatedAt = Objects.requireNonNull(updatedAt, "updatedAt is required");
    }

    public static Lexeme create(
            String lexemeId,
            String tenantId,
            String packCode,
            String headword,
            String language,
            String cefr,
            Map<String, Object> fields,
            String createdBy,
            Instant now) {
        return new Lexeme(
                lexemeId, tenantId, packCode, headword, language, cefr,
                LexemeAvailability.DRAFT, 1L, 1,
                createdBy, createdBy, null, null, null,
                fields, now, now);
    }

    public String lexemeId() {
        return lexemeId;
    }

    public String tenantId() {
        return tenantId;
    }

    public String packCode() {
        return packCode;
    }

    public String headword() {
        return headword;
    }

    /** BCP-47 language ribbon; legacy rows without a language read as {@code en-US}. */
    public String language() {
        return language;
    }

    public String cefr() {
        return cefr;
    }

    public LexemeAvailability availability() {
        return availability;
    }

    public long stateVersion() {
        return stateVersion;
    }

    public int contentVersion() {
        return contentVersion;
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

    public Map<String, Object> fields() {
        return fields;
    }

    /** Last published snapshot; null when never published. Drives the version diff. */
    public Map<String, Object> publishedFields() {
        return publishedFields;
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
    public Lexeme restoreTrail(ReviewTrail restored) {
        this.trail = restored == null ? ReviewTrail.EMPTY : restored;
        return this;
    }

    /**
     * Applies an editor upsert. DRAFT rows are edited in place. Editing an
     * APPROVED or PUBLISHED row opens a revision: the row returns to DRAFT and
     * must pass both reviews again, while {@code publishedFields} keeps the
     * live copy until the revision is republished. IN_REVIEW and ARCHIVED rows
     * are frozen.
     */
    public void applyUpsert(Map<String, Object> nextFields, String editor, Instant now) {
        if (availability == LexemeAvailability.APPROVED || availability == LexemeAvailability.PUBLISHED) {
            boolean live = availability == LexemeAvailability.PUBLISHED || trail.revisionOfLive();
            this.availability = LexemeAvailability.DRAFT;
            this.firstReviewer = null;
            this.finalReviewer = null;
            this.trail = trail.revision(live);
        } else if (availability != LexemeAvailability.DRAFT) {
            throw ContentOperationException.conflict("LEXEME_STATE_INVALID",
                    "a lexeme under review or archived cannot be edited");
        }
        this.fields = Map.copyOf(nextFields);
        this.updatedBy = editor;
        this.updatedAt = now;
        this.stateVersion += 1;
    }

    public void submit(String editor, Instant now) {
        requireTransition(availability.canSubmit(), "only a DRAFT lexeme can be submitted");
        this.availability = LexemeAvailability.IN_REVIEW;
        this.trail = trail.submitted(editor);
        this.updatedBy = editor;
        this.updatedAt = now;
        this.stateVersion += 1;
    }

    public void reviewFirst(String reviewer, Instant now) {
        requireTransition(availability.canReview(), "only an IN_REVIEW lexeme can be first-reviewed");
        if (firstReviewer != null) {
            throw ContentOperationException.conflict("LEXEME_REVIEW_DUPLICATE",
                    "the FIRST review is already completed");
        }
        trail.requireNotAuthorAtFirstReview(reviewer, updatedBy, createdBy, "LEXEME");
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
        requireTransition(availability.canReview(), "only an IN_REVIEW lexeme can be final-reviewed");
        if (firstReviewer == null) {
            throw ContentOperationException.conflict("LEXEME_REVIEW_ORDER_INVALID",
                    "FINAL review requires a completed FIRST review");
        }
        if (reviewer.equals(firstReviewer)) {
            throw ContentOperationException.forbidden("LEXEME_SELF_REVIEW_DENIED",
                    "the author of the first review cannot approve the final review");
        }
        trail.requireNotAuthorAfterFirstReview(reviewer, createdBy, true, "LEXEME");
        this.finalReviewer = reviewer;
        this.trail = trail.decided("APPROVED_FINAL", null, reviewer, now);
        this.availability = LexemeAvailability.APPROVED;
        this.updatedBy = reviewer;
        this.updatedAt = now;
        this.stateVersion += 1;
    }

    /**
     * Sends an IN_REVIEW lexeme back to its author with a reason. Either review
     * stage may reject; both reviewer slots are cleared so the resubmitted
     * draft goes through FIRST and FINAL again.
     */
    public void reject(ReviewStage stage, ReviewDecision decision, String reviewer, String note, Instant now) {
        requireTransition(availability.canReview(), "only an IN_REVIEW lexeme can be rejected");
        if (decision == ReviewDecision.APPROVED) {
            throw ContentOperationException.badRequest("LEXEME_REVIEW_DECISION_INVALID", "reject needs a non-APPROVED decision");
        }
        if (stage == ReviewStage.FINAL_REVIEW && firstReviewer == null) {
            throw ContentOperationException.conflict("LEXEME_REVIEW_ORDER_INVALID",
                    "FINAL review requires a completed FIRST review");
        }
        if (firstReviewer == null) {
            trail.requireNotAuthorAtFirstReview(reviewer, updatedBy, createdBy, "LEXEME");
        } else {
            trail.requireNotAuthorAfterFirstReview(reviewer, createdBy, false, "LEXEME");
        }
        String reason = ReviewTrail.requireRejectNote(note, "LEXEME");
        this.availability = LexemeAvailability.DRAFT;
        this.firstReviewer = null;
        this.finalReviewer = null;
        this.trail = trail.decided(decision.name() + "_" + (stage == ReviewStage.FIRST_REVIEW ? "FIRST" : "FINAL"),
                reason, reviewer, now);
        this.updatedBy = reviewer;
        this.updatedAt = now;
        this.stateVersion += 1;
    }

    public void publish(String publisher, Instant now) {
        requireTransition(availability.canPublish(), "only an APPROVED lexeme can be published");
        this.availability = LexemeAvailability.PUBLISHED;
        this.trail = trail.revision(false);
        this.publisher = publisher;
        this.publishedFields = Map.copyOf(fields);
        this.updatedBy = publisher;
        this.updatedAt = now;
        this.stateVersion += 1;
        this.contentVersion += 1;
    }

    /** True when learners still see a published copy (PUBLISHED, or a revision draft of a live row). */
    public boolean isLive() {
        return availability == LexemeAvailability.PUBLISHED || trail.revisionOfLive();
    }

    public void unpublish(String publisher, Instant now) {
        if (availability != LexemeAvailability.PUBLISHED && trail.revisionOfLive()) {
            // Withdraw the live copy while the revision keeps its own state.
            this.trail = trail.revision(false);
            this.updatedBy = publisher;
            this.updatedAt = now;
            this.stateVersion += 1;
            return;
        }
        requireTransition(availability.canUnpublish(), "only a PUBLISHED lexeme can be unpublished");
        this.availability = LexemeAvailability.APPROVED;
        this.updatedBy = publisher;
        this.updatedAt = now;
        this.stateVersion += 1;
    }

    public void archive(String actor, Instant now) {
        requireTransition(availability.canArchive(), "this lexeme state cannot be archived");
        if (trail.revisionOfLive()) {
            throw ContentOperationException.conflict("LEXEME_REVISION_LIVE",
                    "this draft revises a live lexeme; unpublish the live copy before archiving");
        }
        this.availability = LexemeAvailability.ARCHIVED;
        this.updatedBy = actor;
        this.updatedAt = now;
        this.stateVersion += 1;
    }

    private static void requireTransition(boolean allowed, String message) {
        if (!allowed) {
            throw ContentOperationException.conflict("LEXEME_STATE_INVALID", message);
        }
    }

    private static String requireCode(String value, String field) {
        Objects.requireNonNull(value, field + " is required");
        if (!SAFE_CODE.matcher(value).matches()) {
            throw ContentOperationException.badRequest("LEXEME_FIELD_INVALID", field + " has an unsafe format");
        }
        return value;
    }

    private static String requireHeadword(String value) {
        Objects.requireNonNull(value, "headword is required");
        String trimmed = value.trim();
        if (trimmed.isEmpty() || trimmed.length() > 128) {
            throw ContentOperationException.badRequest("LEXEME_FIELD_INVALID", "headword must be 1..128 characters");
        }
        return trimmed;
    }

    /**
     * Normalizes the language ribbon. Blank input inherits the legacy default
     * {@code en-US} so pre-B4 payloads keep working; anything else must match
     * the BCP-47 subset shared with the {@code B9Locale} contract pattern.
     */
    public static String requireLanguage(String value) {
        if (value == null || value.isBlank()) {
            return DEFAULT_LANGUAGE;
        }
        String trimmed = value.trim();
        if (trimmed.length() > 16 || !LANGUAGE.matcher(trimmed).matches()) {
            throw ContentOperationException.badRequest("LEXEME_LANGUAGE_INVALID",
                    "language must be a BCP-47 tag such as en-US, fr-FR or de-DE");
        }
        return trimmed;
    }

    /** Structural validation for the extensible fields map. Unknown keys are allowed (forward extensibility). */
    @SuppressWarnings("unchecked")
    public static Map<String, Object> validatedFields(Map<String, Object> raw) {
        return validatedFields(raw, null);
    }

    /**
     * Structural validation with the B4 morphology ribbon. {@code language} is the
     * already-normalized BCP-47 ribbon (null/blank skips language-conditional rules).
     * French rows additionally require gender+number on nouns and a conjugation
     * class on verbs; every other language keeps its historical shape.
     */
    @SuppressWarnings("unchecked")
    public static Map<String, Object> validatedFields(Map<String, Object> raw, String language) {
        Objects.requireNonNull(raw, "lexeme fields are required");
        Object senses = raw.get("senses");
        if (senses != null) {
            if (!(senses instanceof List<?> list) || list.isEmpty() || list.size() > 12) {
                throw ContentOperationException.badRequest("LEXEME_FIELD_INVALID", "senses must contain 1..12 entries");
            }
            for (Object sense : list) {
                if (!(sense instanceof Map<?, ?> senseMap)) {
                    throw ContentOperationException.badRequest("LEXEME_FIELD_INVALID", "sense entries must be objects");
                }
                // B4 language ribbon: the generic meaningLocal gloss carries non-Chinese
                // senses; meaningCn stays as the legacy compatible slot. One of them is required.
                Object meaningCn = senseMap.get("meaningCn");
                Object meaningLocal = senseMap.get("meaningLocal");
                if (!isGloss(meaningCn) && !isGloss(meaningLocal)) {
                    throw ContentOperationException.badRequest("LEXEME_FIELD_INVALID",
                            "each sense requires meaningCn or meaningLocal of 1..512 characters");
                }
                Object sensePos = senseMap.get("pos");
                if (sensePos != null && !isPos(String.valueOf(sensePos))) {
                    throw ContentOperationException.badRequest("LEXEME_FIELD_INVALID",
                            "sense pos is outside the controlled vocabulary");
                }
            }
        }
        Object pos = raw.get("pos");
        if (pos != null) {
            if (!(pos instanceof List<?> posList) || posList.size() > 5) {
                throw ContentOperationException.badRequest("LEXEME_FIELD_INVALID", "pos must contain at most 5 entries");
            }
            for (Object entry : posList) {
                if (!isPos(String.valueOf(entry))) {
                    throw ContentOperationException.badRequest("LEXEME_FIELD_INVALID",
                            "pos is outside the controlled vocabulary");
                }
            }
        }
        validateMorphologyOption(raw.get("gender"), "gender", GENDERS);
        validateMorphologyOption(raw.get("number"), "number", NUMBERS);
        validateMorphologyOption(raw.get("grammaticalCase"), "grammaticalCase", CASES);
        Object conjugation = raw.get("conjugation");
        if (conjugation != null && !(conjugation instanceof Map<?, ?>)) {
            throw ContentOperationException.badRequest("LEXEME_FIELD_INVALID", "conjugation must be an object");
        }
        if (language != null && (language.equalsIgnoreCase("fr-FR") || language.equalsIgnoreCase("fr"))) {
            requireFrenchMorphology(raw, pos, conjugation);
        }
        Object difficulty = raw.get("difficulty");
        if (difficulty != null) {
            int level = toInt(difficulty, "difficulty");
            if (level < 1 || level > 5) {
                throw ContentOperationException.badRequest("LEXEME_FIELD_INVALID", "difficulty must be 1..5");
            }
        }
        Object examFreq = raw.get("examFreq");
        if (examFreq != null) {
            int freq = toInt(examFreq, "examFreq");
            if (freq < 0 || freq > 100) {
                throw ContentOperationException.badRequest("LEXEME_FIELD_INVALID", "examFreq must be 0..100");
            }
        }
        Object tags = raw.get("tags");
        if (tags != null) {
            if (!(tags instanceof List<?> tagList) || tagList.size() > 20) {
                throw ContentOperationException.badRequest("LEXEME_FIELD_INVALID", "tags must contain at most 20 entries");
            }
            for (Object tag : tagList) {
                if (!(tag instanceof String text) || text.isBlank() || text.length() > 64) {
                    throw ContentOperationException.badRequest("LEXEME_FIELD_INVALID",
                            "tags must be 1..64 characters; language-scoped tags use the B4 taxonomy (fr:/de: prefix)");
                }
            }
        }
        return Map.copyOf(raw);
    }

    /**
     * Controlled part-of-speech vocabulary (B4): the nine historical values plus
     * the converged long forms. Historical abbreviations stay accepted; PREFIX and
     * SUFFIX stay accepted at sense level per the contract.
     */
    private static final Set<String> POS = Set.of(
            "NOUN", "VERB", "ADJ", "ADV", "PRON", "PREP", "CONJ", "INTERJ", "PHRASE",
            "PREFIX", "SUFFIX",
            "ARTICLE", "PRONOUN", "DETERMINER", "PREPOSITION", "CONJUNCTION",
            "INTERJECTION", "NUMERAL", "PARTICLE");
    private static final Set<String> GENDERS = Set.of("MASCULINE", "FEMININE", "NEUTER");
    private static final Set<String> NUMBERS = Set.of("SINGULAR", "PLURAL");
    private static final Set<String> CASES = Set.of(
            "NOMINATIVE", "ACCUSATIVE", "DATIVE", "GENITIVE", "INSTRUMENTAL", "PREPOSITIONAL");

    private static boolean isPos(String value) {
        return value != null && POS.contains(value.trim().toUpperCase());
    }

    private static void validateMorphologyOption(Object value, String field, Set<String> allowed) {
        if (value == null) {
            return;
        }
        if (!(value instanceof String text) || !allowed.contains(text.trim().toUpperCase())) {
            throw ContentOperationException.badRequest("LEXEME_FIELD_INVALID",
                    field + " is outside the controlled morphology vocabulary");
        }
    }

    /** French nouns file gender+number; French verbs file a conjugation class. */
    @SuppressWarnings("unchecked")
    private static void requireFrenchMorphology(Map<String, Object> raw, Object pos, Object conjugation) {
        boolean noun = containsPos(pos, "NOUN");
        boolean verb = containsPos(pos, "VERB");
        if (noun) {
            if (raw.get("gender") == null || raw.get("number") == null) {
                throw ContentOperationException.badRequest("LEXEME_FIELD_INVALID",
                        "French nouns require gender and number");
            }
        }
        if (verb) {
            if (!(conjugation instanceof Map<?, ?> conjugationMap) || conjugationMap.get("verbGroup") == null
                    || String.valueOf(conjugationMap.get("verbGroup")).isBlank()) {
                throw ContentOperationException.badRequest("LEXEME_FIELD_INVALID",
                        "French verbs require conjugation.verbGroup");
            }
        }
    }

    private static boolean containsPos(Object pos, String wanted) {
        if (pos instanceof List<?> posList) {
            for (Object entry : posList) {
                if (wanted.equalsIgnoreCase(String.valueOf(entry))) {
                    return true;
                }
            }
        }
        return false;
    }

    private static boolean isGloss(Object value) {
        return value instanceof String text && !text.isBlank() && text.length() <= 512;
    }

    private static int toInt(Object value, String field) {
        if (value instanceof Number number) {
            return number.intValue();
        }
        throw ContentOperationException.badRequest("LEXEME_FIELD_INVALID", field + " must be a number");
    }
}
