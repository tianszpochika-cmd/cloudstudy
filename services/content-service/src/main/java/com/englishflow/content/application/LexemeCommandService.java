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
        requireEditor(actor);
        Objects.requireNonNull(packCode, "packCode is required");
        Map<String, Object> validated = Lexeme.validatedFields(fields == null ? Map.of() : fields);
        String headword = headwordOf(validated);
        return idempotency.execute(
                scope(actor, "lexeme.upsert"), key, fingerprint(packCode, headword, validated),
                () -> {
                    ensurePack(packCode, actor);
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
                        Lexeme created = Lexeme.create(id, TENANT, packCode, headword,
                                cefrOf(validated), validated, actor.subjectId(), now);
                        lexemes.save(created);
                        return new LexemeResult(created.lexemeId(), created.stateVersion(), created.availability());
                    }
                    assertExpectedPack(existing, packCode);
                    existing.applyUpsert(validated, actor.subjectId(), now);
                    lexemes.save(existing);
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
                    lexeme.submit(actor.subjectId(), clock.instant());
                    lexemes.save(lexeme);
                    return resultOf(lexeme);
                });
    }

    public LexemeResult reviewFirst(String packCode, String lexemeId, ReviewDecision decision,
            ContentActor actor, ContentIdempotencyKey key, ContentRequestContext context) {
        if (!actor.canReviewFirst()) {
            throw ContentOperationException.forbidden("LEXEME_REVIEW_REQUIRED",
                    "first-review permission is required");
        }
        return idempotency.execute(
                scope(actor, "lexeme.review-first"), key, fingerprint(packCode, lexemeId, decision),
                () -> {
                    Lexeme lexeme = owned(packCode, lexemeId, actor);
                    if (decision != ReviewDecision.APPROVED) {
                        throw ContentOperationException.badRequest("LEXEME_REVIEW_DECISION_INVALID",
                                "FIRST review only accepts APPROVED; rework stays in DRAFT via upsert");
                    }
                    lexeme.reviewFirst(actor.subjectId(), clock.instant());
                    lexemes.save(lexeme);
                    return resultOf(lexeme);
                });
    }

    public LexemeResult reviewFinal(String packCode, String lexemeId, ReviewDecision decision,
            ContentActor actor, ContentIdempotencyKey key, ContentRequestContext context) {
        if (!actor.canReviewFinal()) {
            throw ContentOperationException.forbidden("LEXEME_REVIEW_REQUIRED",
                    "final-review permission is required");
        }
        return idempotency.execute(
                scope(actor, "lexeme.review-final"), key, fingerprint(packCode, lexemeId, decision),
                () -> {
                    Lexeme lexeme = owned(packCode, lexemeId, actor);
                    if (decision != ReviewDecision.APPROVED) {
                        throw ContentOperationException.badRequest("LEXEME_REVIEW_DECISION_INVALID",
                                "FINAL review only accepts APPROVED; rework stays in DRAFT via upsert");
                    }
                    lexeme.reviewFinal(actor.subjectId(), clock.instant());
                    lexemes.save(lexeme);
                    return resultOf(lexeme);
                });
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

    public List<Lexeme> search(String packCode, String query, String cefr, LexemeAvailability availability,
            int limit, String afterLexemeId, ContentActor actor) {
        requireRead(actor);
        return lexemes.search(packCode, query, cefr, availability, limit, afterLexemeId);
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

    private void ensurePack(String packCode, ContentActor actor) {
        if (packCode == null || packCode.isBlank()) {
            throw ContentOperationException.badRequest("LEXEME_FIELD_INVALID", "contentCode (vocabulary pack) is required");
        }
        String code = packCode.trim();
        if (contents.findByCode(code).isPresent()) {
            return;
        }
        ContentDefinition pack = ContentDefinition.create(
                ContentId.of(code), TENANT, code, ContentKind.VOCABULARY,
                code, "en-US", "A1", "PHASE1", actor.subjectId(), clock.instant());
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
