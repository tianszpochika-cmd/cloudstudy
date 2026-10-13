package com.englishflow.content.application;

import com.englishflow.content.domain.ContentActor;
import com.englishflow.content.domain.ContentDefinition;
import com.englishflow.content.domain.ContentId;
import com.englishflow.content.domain.ContentIdempotencyKey;
import com.englishflow.content.domain.ContentKind;
import com.englishflow.content.domain.ContentOperationException;
import com.englishflow.content.domain.ContentOutboxEvent;
import com.englishflow.content.domain.ContentPayloadHash;
import com.englishflow.content.domain.ContentRequestContext;
import com.englishflow.content.domain.Lexeme;
import com.englishflow.content.domain.LexemeAvailability;
import com.englishflow.content.domain.LexemePronunciation;
import com.englishflow.content.domain.ReviewDecision;
import com.englishflow.content.domain.ReviewStage;
import com.englishflow.content.port.ContentIdempotencyPort;
import com.englishflow.content.port.ContentOutboxPort;
import com.englishflow.content.port.ContentRepository;
import com.englishflow.content.port.LexemeRepository;

import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

/**
 * Row-level word-master commands owned by content-service.
 *
 * <p>Lexemes live under a vocabulary pack (contentCode, kind VOCABULARY); the
 * pack is auto-provisioned on first use so words always have a publish scope.
 * Authors cannot self-review: FIRST and FINAL reviewers must differ. Publish
 * and unpublish emit Outbox facts for learner projections; audio bytes never
 * flow through this service.</p>
 */
public final class LexemeCommandService {

    private static final String TENANT = "platform";

    private final ContentRepository contents;
    private final LexemeRepository lexemes;
    private final ContentOutboxPort outbox;
    private final ContentIdempotencyPort idempotency;
    private final Clock clock;

    public LexemeCommandService(
            ContentRepository contents,
            LexemeRepository lexemes,
            ContentOutboxPort outbox,
            ContentIdempotencyPort idempotency,
            Clock clock) {
        this.contents = Objects.requireNonNull(contents, "contents are required");
        this.lexemes = Objects.requireNonNull(lexemes, "lexemes are required");
        this.outbox = Objects.requireNonNull(outbox, "outbox is required");
        this.idempotency = Objects.requireNonNull(idempotency, "idempotency is required");
        this.clock = Objects.requireNonNull(clock, "clock is required");
    }

    public record LexemeResult(String lexemeId, long stateVersion, LexemeAvailability availability) {
    }

    public LexemeResult upsert(
            String packCode,
            Map<String, Object> fields,
            String lexemeId,
            ContentActor actor,
            ContentIdempotencyKey key,
            ContentRequestContext context) {
        return upsert(packCode, fields, lexemeId, null, actor, key, context);
    }

    /**
     * Optimistic-lock aware upsert. {@code expectedStateVersion} = 0 means
     * "create": hitting an existing headword is a 409 instead of a silent
     * overwrite. A positive value must equal the row's current stateVersion,
     * otherwise 409 LEXEME_VERSION_CONFLICT (someone else saved first).
     * {@code null} keeps the legacy merge semantics for internal callers.
     */
    public LexemeResult upsert(
            String packCode,
            Map<String, Object> fields,
            String lexemeId,
            Long expectedStateVersion,
            ContentActor actor,
            ContentIdempotencyKey key,
            ContentRequestContext context) {
        requireEditor(actor);
        Objects.requireNonNull(packCode, "packCode is required");
        // B4 language ribbon: blank/omitted input inherits en-US so pre-B4 payloads keep working.
        String language = Lexeme.requireLanguage(text(fields == null ? null : fields.get("language")));
        Map<String, Object> validated = Lexeme.validatedFields(fields == null ? Map.of() : fields, language);
        String headword = headwordOf(validated);
        return idempotency.execute(
                scope(actor, "lexeme.upsert"), key, fingerprint(packCode, headword, language, validated),
                () -> {
                    ensurePack(packCode, language, actor);
                    Instant now = clock.instant();
                    Lexeme existing = lexemes.findByPackHeadword(packCode, headword).orElse(null);
                    if (existing == null && lexemeId != null && !lexemeId.isBlank()) {
                        existing = lexemes.findById(lexemeId.trim()).orElse(null);
                    }
                    if (existing == null) {
                        String id = (lexemeId == null || lexemeId.isBlank()) ? newLexemeId() : lexemeId.trim();
                        if (lexemes.findById(id).isPresent()) {
                            throw ContentOperationException.conflict("LEXEME_DUPLICATE",
                                    "a lexeme with this id already exists");
                        }
                        Lexeme created = Lexeme.create(id, TENANT, packCode, headword, language,
                                cefrOf(validated), validated, actor.subjectId(), now);
                        lexemes.save(created);
                        return new LexemeResult(created.lexemeId(), created.stateVersion(), created.availability());
                    }
                    assertExpectedPack(existing, packCode);
                    if (expectedStateVersion != null) {
                        if (expectedStateVersion == 0L) {
                            throw ContentOperationException.conflict("LEXEME_DUPLICATE",
                                    "a lexeme with this headword already exists in the pack; open it and edit instead");
                        }
                        if (expectedStateVersion != existing.stateVersion()) {
                            throw ContentOperationException.conflict("LEXEME_VERSION_CONFLICT",
                                    "stale stateVersion: expected " + expectedStateVersion
                                            + " but current is " + existing.stateVersion());
                        }
                    }
                    boolean openedRevision = existing.availability() != LexemeAvailability.DRAFT;
                    // Language is create-time identity (like headword): re-upserts keep the
                    // original ribbon instead of silently migrating the row across languages.
                    existing.applyUpsert(validated, actor.subjectId(), now);
                    lexemes.save(existing);
                    if (openedRevision) {
                        audit(existing, "content.lexeme.revision-opened.v1", actor, null, null, context, now);
                    }
                    return new LexemeResult(existing.lexemeId(), existing.stateVersion(), existing.availability());
                });
    }

    public LexemeResult submit(String packCode, String lexemeId, ContentActor actor,
            ContentIdempotencyKey key, ContentRequestContext context) {
        requireEditor(actor);
        return idempotency.execute(
                scope(actor, "lexeme.submit"), key, fingerprint(packCode, lexemeId),
                () -> {
                    Lexeme lexeme = owned(packCode, lexemeId, actor);
                    Instant now = clock.instant();
                    lexeme.submit(actor.subjectId(), now);
                    lexemes.save(lexeme);
                    audit(lexeme, "content.lexeme.submitted.v1", actor, null, null, context, now);
                    return resultOf(lexeme);
                });
    }

    public LexemeResult reviewFirst(String packCode, String lexemeId, ReviewDecision decision,
            ContentActor actor, ContentIdempotencyKey key, ContentRequestContext context) {
        return reviewFirst(packCode, lexemeId, decision, null, actor, key, context);
    }

    public LexemeResult reviewFirst(String packCode, String lexemeId, ReviewDecision decision, String reviewNote,
            ContentActor actor, ContentIdempotencyKey key, ContentRequestContext context) {
        if (!actor.canReviewFirst()) {
            throw ContentOperationException.forbidden("LEXEME_REVIEW_REQUIRED",
                    "first-review permission is required");
        }
        return idempotency.execute(
                scope(actor, "lexeme.review-first"), key, fingerprint(packCode, lexemeId, decision, reviewNote),
                () -> decide(packCode, lexemeId, ReviewStage.FIRST_REVIEW, decision, reviewNote, actor, context));
    }

    public LexemeResult reviewFinal(String packCode, String lexemeId, ReviewDecision decision,
            ContentActor actor, ContentIdempotencyKey key, ContentRequestContext context) {
        return reviewFinal(packCode, lexemeId, decision, null, actor, key, context);
    }

    public LexemeResult reviewFinal(String packCode, String lexemeId, ReviewDecision decision, String reviewNote,
            ContentActor actor, ContentIdempotencyKey key, ContentRequestContext context) {
        if (!actor.canReviewFinal()) {
            throw ContentOperationException.forbidden("LEXEME_REVIEW_REQUIRED",
                    "final-review permission is required");
        }
        return idempotency.execute(
                scope(actor, "lexeme.review-final"), key, fingerprint(packCode, lexemeId, decision, reviewNote),
                () -> decide(packCode, lexemeId, ReviewStage.FINAL_REVIEW, decision, reviewNote, actor, context));
    }

    private LexemeResult decide(String packCode, String lexemeId, ReviewStage stage, ReviewDecision decision,
            String reviewNote, ContentActor actor, ContentRequestContext context) {
        if (decision == null) {
            throw ContentOperationException.badRequest("LEXEME_REVIEW_DECISION_INVALID", "reviewDecision is required");
        }
        Lexeme lexeme = owned(packCode, lexemeId, actor);
        Instant now = clock.instant();
        if (decision == ReviewDecision.APPROVED) {
            if (stage == ReviewStage.FIRST_REVIEW) {
                lexeme.reviewFirst(actor.subjectId(), now);
            } else {
                lexeme.reviewFinal(actor.subjectId(), now);
            }
            lexemes.save(lexeme);
            audit(lexeme, "content.lexeme.review-approved.v1", actor, stage.name(), null, context, now);
        } else {
            lexeme.reject(stage, decision, actor.subjectId(), reviewNote, now);
            lexemes.save(lexeme);
            audit(lexeme, "content.lexeme.review-rejected.v1", actor, stage.name() + ":" + decision.name(),
                    lexeme.trail().lastNote(), context, now);
        }
        return resultOf(lexeme);
    }

    /** Review audit fact: appended to the content Outbox (the service's durable event log). */
    private void audit(Lexeme lexeme, String eventType, ContentActor actor, String decision, String note,
            ContentRequestContext context, Instant now) {
        outbox.appendAfterFact(ContentOutboxEvent.create(
                "lexeme", lexeme.lexemeId(), eventType, actor.subjectId(),
                lexeme.lexemeId() + ":" + eventType + ":" + lexeme.stateVersion(),
                "{\"lexemeId\":" + ReviewAuditJson.quote(lexeme.lexemeId())
                        + ",\"packCode\":" + ReviewAuditJson.quote(lexeme.packCode())
                        + ",\"availability\":" + ReviewAuditJson.quote(lexeme.availability().name())
                        + ",\"stateVersion\":" + lexeme.stateVersion()
                        + ",\"actor\":" + ReviewAuditJson.quote(actor.subjectId())
                        + ",\"decision\":" + ReviewAuditJson.quote(decision)
                        + ",\"note\":" + ReviewAuditJson.quote(note)
                        + ",\"revisionOfLive\":" + lexeme.trail().revisionOfLive() + "}",
                context, now));
    }

    public LexemeResult publish(String packCode, String lexemeId, String reasonCode,
            ContentActor actor, ContentIdempotencyKey key, ContentRequestContext context) {
        requirePublisher(actor);
        requireReason(reasonCode);
        return idempotency.execute(
                scope(actor, "lexeme.publish"), key, fingerprint(packCode, lexemeId, reasonCode),
                () -> {
                    Lexeme lexeme = owned(packCode, lexemeId, actor);
                    Instant now = clock.instant();
                    lexeme.publish(actor.subjectId(), now);
                    lexemes.save(lexeme);
                    outbox.appendAfterFact(ContentOutboxEvent.create(
                            "lexeme", lexeme.lexemeId(), "content.lexeme.published.v1",
                            actor.subjectId(),
                            lexeme.lexemeId() + ":published:" + lexeme.stateVersion(),
                            "{\"lexemeId\":\"" + lexeme.lexemeId() + "\",\"packCode\":\"" + lexeme.packCode()
                                    + "\",\"headword\":\"" + escape(lexeme.headword()) + "\",\"stateVersion\":"
                                    + lexeme.stateVersion() + "}",
                            context, now));
                    return resultOf(lexeme);
                });
    }

    public LexemeResult unpublish(String packCode, String lexemeId, String reasonCode,
            ContentActor actor, ContentIdempotencyKey key, ContentRequestContext context) {
        requirePublisher(actor);
        requireReason(reasonCode);
        return idempotency.execute(
                scope(actor, "lexeme.unpublish"), key, fingerprint(packCode, lexemeId, reasonCode),
                () -> {
                    Lexeme lexeme = owned(packCode, lexemeId, actor);
                    Instant now = clock.instant();
                    lexeme.unpublish(actor.subjectId(), now);
                    lexemes.save(lexeme);
                    outbox.appendAfterFact(ContentOutboxEvent.create(
                            "lexeme", lexeme.lexemeId(), "content.lexeme.unpublished.v1",
                            actor.subjectId(),
                            lexeme.lexemeId() + ":unpublished:" + lexeme.stateVersion(),
                            "{\"lexemeId\":\"" + lexeme.lexemeId() + "\",\"packCode\":\"" + lexeme.packCode()
                                    + "\",\"stateVersion\":" + lexeme.stateVersion() + "}",
                            context, now));
                    return resultOf(lexeme);
                });
    }

    public LexemeResult archive(String packCode, String lexemeId, String reasonCode,
            ContentActor actor, ContentIdempotencyKey key, ContentRequestContext context) {
        requireEditor(actor);
        requireReason(reasonCode);
        return idempotency.execute(
                scope(actor, "lexeme.archive"), key, fingerprint(packCode, lexemeId, reasonCode),
                () -> {
                    Lexeme lexeme = owned(packCode, lexemeId, actor);
                    lexeme.archive(actor.subjectId(), clock.instant());
                    lexemes.save(lexeme);
                    return resultOf(lexeme);
                });
    }

    public LexemePronunciation upsertPronunciation(
            String packCode,
            String lexemeId,
            Map<String, Object> input,
            ContentActor actor,
            ContentIdempotencyKey key,
            ContentRequestContext context) {
        requireEditor(actor);
        Objects.requireNonNull(input, "pronunciation is required");
        return idempotency.execute(
                scope(actor, "lexeme.pronunciation.upsert"), key, fingerprint(packCode, lexemeId, input),
                () -> {
                    Lexeme lexeme = owned(packCode, lexemeId, actor);
                    if (lexeme.availability() == LexemeAvailability.ARCHIVED) {
                        throw ContentOperationException.conflict("LEXEME_STATE_INVALID",
                                "an ARCHIVED lexeme cannot accept pronunciations");
                    }
                    String pronunciationId = text(input.get("pronunciationId"));
                    if (pronunciationId.isBlank()) {
                        pronunciationId = "lp_" + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
                    }
                    Instant now = clock.instant();
                    LexemePronunciation pronunciation = new LexemePronunciation(
                            pronunciationId, lexeme.lexemeId(), TENANT,
                            text(input.get("accent")).toUpperCase(),
                            text(input.get("ipa")),
                            text(input.get("audioAssetId")),
                            text(input.get("sourceType")).toUpperCase(),
                            textOrNull(input.get("voiceName")),
                            intOrNull(input.get("durationMs")),
                            intOrNull(input.get("sampleRate")),
                            intOrNull(input.get("bitrateKbps")),
                            "PENDING", null, null, now);
                    lexemes.savePronunciation(pronunciation);
                    return pronunciation;
                });
    }

    public LexemePronunciation reviewPronunciation(
            String packCode,
            String lexemeId,
            Map<String, Object> input,
            String reasonCode,
            ContentActor actor,
            ContentIdempotencyKey key,
            ContentRequestContext context) {
        requireEditor(actor);
        Objects.requireNonNull(input, "pronunciation is required");
        return idempotency.execute(
                scope(actor, "lexeme.pronunciation.qc"), key, fingerprint(packCode, lexemeId, input, reasonCode),
                () -> {
                    Lexeme lexeme = owned(packCode, lexemeId, actor);
                    String pronunciationId = text(input.get("pronunciationId"));
                    if (pronunciationId.isBlank()) {
                        throw ContentOperationException.badRequest("LEXEME_PRONUNCIATION_INVALID",
                                "pronunciationId is required for QC");
                    }
                    LexemePronunciation current = lexemes.listPronunciations(lexeme.lexemeId()).stream()
                            .filter(candidate -> candidate.pronunciationId().equals(pronunciationId))
                            .findFirst()
                            .orElseThrow(() -> ContentOperationException.notFound("LEXEME_PRONUNCIATION_NOT_FOUND",
                                    "pronunciation does not exist"));
                    String verdict = text(input.get("qcStatus")).toUpperCase();
                    if (!List.of("READY", "CLEAN", "FAILED").contains(verdict)) {
                        throw ContentOperationException.badRequest("LEXEME_PRONUNCIATION_INVALID",
                                "qcStatus must be READY, CLEAN or FAILED");
                    }
                    Instant now = clock.instant();
                    LexemePronunciation updated = new LexemePronunciation(
                            current.pronunciationId(), current.lexemeId(), current.tenantId(),
                            current.accent(), current.ipa(), current.audioAssetId(), current.sourceType(),
                            current.voiceName(), current.durationMs(), current.sampleRate(),
                            current.bitrateKbps(), verdict, actor.subjectId(), now, current.createdAt());
                    lexemes.savePronunciation(updated);
                    return updated;
                });
    }

    /** Batch-import dry run: validates exactly like upsert and reports an existing row, writing nothing. */
    public record LexemePrecheck(String headword, String language, String existingLexemeId,
            LexemeAvailability existingAvailability) {
    }

    public LexemePrecheck precheck(String packCode, Map<String, Object> fields, ContentActor actor) {
        requireEditor(actor);
        if (packCode == null || packCode.isBlank()) {
            throw ContentOperationException.badRequest("LEXEME_FIELD_INVALID", "contentCode (vocabulary pack) is required");
        }
        String language = Lexeme.requireLanguage(text(fields == null ? null : fields.get("language")));
        Map<String, Object> validated = Lexeme.validatedFields(fields == null ? Map.of() : fields, language);
        String headword = headwordOf(validated);
        cefrOf(validated);
        Lexeme existing = lexemes.findByPackHeadword(packCode.trim(), headword).orElse(null);
        return new LexemePrecheck(headword, language,
                existing == null ? null : existing.lexemeId(),
                existing == null ? null : existing.availability());
    }

    public List<Lexeme> search(String packCode, String query, String cefr, LexemeAvailability availability,
            String language, int limit, String afterLexemeId, ContentActor actor) {
        requireRead(actor);
        return lexemes.search(packCode, query, cefr, availability, language, limit, afterLexemeId);
    }

    public List<LexemePronunciation> pronunciations(String packCode, String lexemeId, ContentActor actor) {
        requireRead(actor);
        Lexeme lexeme = owned(packCode, lexemeId, actor);
        return lexemes.listPronunciations(lexeme.lexemeId());
    }

    public Lexeme current(String packCode, String lexemeId, ContentActor actor) {
        requireRead(actor);
        return owned(packCode, lexemeId, actor);
    }

    private Lexeme owned(String packCode, String lexemeId, ContentActor actor) {
        if (!TENANT.equals(actor.tenantId())) {
            throw ContentOperationException.forbidden("LEXEME_TENANT_DENIED", "lexeme tenant scope denied");
        }
        if (lexemeId == null || lexemeId.isBlank()) {
            throw ContentOperationException.badRequest("LEXEME_FIELD_INVALID", "lexemeId is required");
        }
        Lexeme lexeme = lexemes.findById(lexemeId.trim())
                .orElseThrow(() -> ContentOperationException.notFound("LEXEME_NOT_FOUND", "lexeme does not exist"));
        assertExpectedPack(lexeme, packCode);
        return lexeme;
    }

    private static void assertExpectedPack(Lexeme lexeme, String packCode) {
        if (packCode != null && !packCode.isBlank() && !lexeme.packCode().equals(packCode.trim())) {
            throw ContentOperationException.forbidden("LEXEME_TENANT_DENIED", "lexeme pack scope denied");
        }
    }

    private void ensurePack(String packCode, String language, ContentActor actor) {
        if (packCode == null || packCode.isBlank()) {
            throw ContentOperationException.badRequest("LEXEME_FIELD_INVALID", "contentCode (vocabulary pack) is required");
        }
        String code = packCode.trim();
        if (contents.findByCode(code).isPresent()) {
            return;
        }
        // Vocabulary packs follow VOCAB-{LANG}-PHASE1; the pack locale follows the
        // first lexeme language so French/German packs project under their own locale.
        ContentDefinition pack = ContentDefinition.create(
                ContentId.of(code), TENANT, code, ContentKind.VOCABULARY,
                code, language, "A1", "PHASE1", actor.subjectId(), clock.instant());
        contents.create(pack);
    }

    private static LexemeResult resultOf(Lexeme lexeme) {
        return new LexemeResult(lexeme.lexemeId(), lexeme.stateVersion(), lexeme.availability());
    }

    private static void requireEditor(ContentActor actor) {
        if (!actor.canEdit()) {
            throw ContentOperationException.forbidden("LEXEME_EDITOR_REQUIRED", "lexeme editor permission is required");
        }
    }

    private static void requirePublisher(ContentActor actor) {
        if (!actor.canPublish()) {
            throw ContentOperationException.forbidden("LEXEME_PUBLISHER_REQUIRED", "lexeme publisher permission is required");
        }
    }

    private static void requireRead(ContentActor actor) {
        if (!actor.canEdit() && !actor.canReviewFirst() && !actor.canReviewFinal() && !actor.canPublish()) {
            throw ContentOperationException.forbidden("LEXEME_ADMIN_REQUIRED", "lexeme admin permission is required");
        }
    }

    private static void requireReason(String reasonCode) {
        if (reasonCode == null || reasonCode.isBlank()) {
            throw ContentOperationException.badRequest("LEXEME_FIELD_INVALID", "reasonCode is required for audit");
        }
    }

    private static String headwordOf(Map<String, Object> fields) {
        Object headword = fields.get("headword");
        if (!(headword instanceof String text) || text.isBlank() || text.trim().length() > 128) {
            throw ContentOperationException.badRequest("LEXEME_FIELD_INVALID", "headword must be 1..128 characters");
        }
        return text.trim();
    }

    private static String cefrOf(Map<String, Object> fields) {
        Object cefr = fields.get("cefr");
        if (cefr == null) {
            return null;
        }
        String value = String.valueOf(cefr).trim().toUpperCase();
        if (!List.of("A1", "A2", "B1", "B2", "C1", "C2").contains(value)) {
            throw ContentOperationException.badRequest("LEXEME_FIELD_INVALID", "cefr must be A1..C2");
        }
        return value;
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

    private static String newLexemeId() {
        return "lx_" + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
    }

    private static String text(Object value) {
        return value instanceof String text ? text.trim() : "";
    }

    private static String textOrNull(Object value) {
        String text = text(value);
        return text.isEmpty() ? null : text;
    }

    private static Integer intOrNull(Object value) {
        if (value instanceof Number number) {
            return number.intValue();
        }
        return null;
    }

    private static String escape(String value) {
        return value.replace("\\", "\\\\").replace("\"", "\\\"");
    }
}
