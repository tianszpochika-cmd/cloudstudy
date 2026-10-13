package com.englishflow.content.web;

import com.englishflow.content.application.ContentCommandService;
import com.englishflow.content.application.ContentItemCommandService;
import com.englishflow.content.application.LexemeCommandService;
import com.englishflow.content.application.ScheduledPublishService;
import com.englishflow.content.domain.ContentActor;
import com.englishflow.content.release.ContentReleaseStudio;
import com.englishflow.content.domain.ContentAutoValidation;
import com.englishflow.content.domain.ContentDefinition;
import com.englishflow.content.domain.ContentId;
import com.englishflow.content.domain.ContentItem;
import com.englishflow.content.domain.ContentIdempotencyKey;
import com.englishflow.content.domain.ContentKind;
import com.englishflow.content.domain.ContentOperationException;
import com.englishflow.content.domain.ContentPayloadHash;
import com.englishflow.content.domain.ContentRequestContext;
import com.englishflow.content.domain.ContentRights;
import com.englishflow.content.domain.ContentVersion;
import com.englishflow.content.domain.ContentVersionId;
import com.englishflow.content.domain.ContentVersionSnapshot;
import com.englishflow.content.domain.ContentVersionStatus;
import com.englishflow.content.domain.CopyrightStatus;
import com.englishflow.content.domain.ItemAvailability;
import com.englishflow.content.domain.Lexeme;
import com.englishflow.content.domain.LexemeAvailability;
import com.englishflow.content.domain.LexemePronunciation;
import com.englishflow.content.domain.MediaRefs;
import com.englishflow.content.domain.ReviewDecision;
import com.englishflow.content.domain.ReviewStage;
import com.englishflow.content.domain.RightsProposal;
import com.englishflow.content.domain.ScheduledPublishTask;
import com.englishflow.content.domain.ValidationReport;
import com.englishflow.content.port.ContentRepository;
import com.englishflow.content.port.ContentIdempotencyPort;
import com.englishflow.content.port.ValidationReportStore;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Base64;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.beans.factory.annotation.Autowired;
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
    private final LexemeCommandService lexemes;
    private final ContentItemCommandService contentItems;
    private final ScheduledPublishService schedules;
    private final ContentRepository repository;
    private final ContentIdempotencyPort idempotency;
    private final VerifiedContentPrincipalFactory principals;
    private final ValidationReportStore reports;
    private ContentReleaseStudio releaseStudio = new ContentReleaseStudio();

    private com.englishflow.content.adapter.jdbc.JdbcContentReviewNotes reviewNotes;

    @Autowired(required = false)
    void setReviewNotes(com.englishflow.content.adapter.jdbc.JdbcContentReviewNotes reviewNotes) {
        this.reviewNotes = reviewNotes;
    }

    @Autowired
    void setReleaseStudio(ContentReleaseStudio releaseStudio) {
        if (releaseStudio != null) {
            this.releaseStudio = releaseStudio;
        }
    }

    @Autowired
    public B9ContentAdminController(
            ContentCommandService commands,
            LexemeCommandService lexemes,
            ContentItemCommandService contentItems,
            ScheduledPublishService schedules,
            ContentRepository repository,
            VerifiedContentPrincipalFactory principals,
            ContentIdempotencyPort idempotency,
            ValidationReportStore reports) {
        this.commands = commands;
        this.lexemes = lexemes;
        this.contentItems = contentItems;
        this.schedules = schedules;
        this.repository = repository;
        this.principals = principals;
        this.idempotency = idempotency;
        this.reports = reports;
    }

    @GetMapping
    public ResponseEntity<Map<String, Object>> list(
            Authentication authentication,
            @RequestParam(required = false) String cursor,
            @RequestParam(required = false) Integer pageSize,
            @RequestParam(required = false) Integer limit,
            @RequestParam(required = false) String kind,
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String cefr,
            @RequestParam(required = false) String availability,
            @RequestParam(required = false) String packCode,
            @RequestParam(required = false) String language,
            @RequestParam(required = false) String itemKind,
            @RequestHeader HttpHeaders headers) {
        ContentActor actor = adminActor(authentication);
        requireAdminRead(actor);
        // Canonical pageSize wins; the pre-contract limit alias stays for transition.
        int requested = pageSize != null ? pageSize : (limit != null ? limit : 50);
        int size = Math.max(1, Math.min(requested, 100));
        ContentRequestContext context = context(headers);
        if ("LEXEME".equalsIgnoreCase(text(kind))) {
            return lexemeList(actor, cursor, size, packCode, q, cefr, availability, language, context);
        }
        if ("ITEM".equalsIgnoreCase(text(kind))) {
            return itemList(actor, cursor, size, packCode, itemKind, q, availability, context);
        }
        return packList(actor, cursor, size, context);
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
        Map<String, Object> detail = new LinkedHashMap<>(withScheduledTasks(state(content, actor), contentCode, actor));
        content.versions().stream().reduce((left, right) -> right)
                .ifPresent(latest -> detail.put("editorDraft", editorDraft(content, latest)));
        if (reviewNotes != null) {
            reviewNotes.latest(contentCode).ifPresent(note -> detail.put("lastRejection", note));
        }
        return ResponseEntity.ok(envelope(detail, headers));
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
        if (command.startsWith("RELEASE_")) {
            Map<String, Object> releaseInput = new LinkedHashMap<>(input);
            releaseInput.put("idempotencyKey", key);
            ContentReleaseStudio.Stored release = releaseStudio.handle(actor, command, contentCode, releaseInput);
            return ResponseEntity.status(release.status()).body(release.body());
        }
        ContentRequestContext context = context(headers);
        if ("CREATE_DRAFT".equals(command) || "SAVE_DRAFT".equals(command)) {
            requireEditor(actor);
            return draftCommand(input, command, contentCode, actor, key, context);
        }
        ContentVersionSnapshot versionSnapshot = null;
        ValidationReport validatedReport = null;
        switch (command) {
            case "VALIDATE_DRAFT" -> {
                requireEditor(actor);
                ContentDefinition content = owned(contentCode, actor);
                ContentVersion version = latestVersion(content);
                validatedReport = commands.validateDraft(
                        new ContentCommandService.VersionCommand(content.contentId(), version.versionId()),
                        actor, key(key + ":validate"), context);
                versionSnapshot = ContentVersionSnapshot.from(content.contentId(), version);
            }
            case "SUBMIT_REVIEW" -> {
                requireEditor(actor);
                ContentDefinition content = owned(contentCode, actor);
                ContentVersion version = targetVersion(content, input);
                ReviewSubmissionReadiness readiness = reviewSubmissionReadiness(version, Instant.now());
                if (!readiness.ready()) {
                    throw ContentOperationException.conflict(readiness.errorCode(),
                            "content version is not ready for review: " + readiness.reason());
                }
                versionSnapshot = commands.submitForReview(
                        new ContentCommandService.VersionCommand(content.contentId(), version.versionId()),
                        actor, key(key + ":submit"), context);
            }
            case "REVIEW_FIRST", "REVIEW_FINAL" -> {
                if ("REVIEW_FIRST".equals(command)) {
                    requireReviewerFirst(actor);
                } else {
                    requireReviewerFinal(actor);
                }
                ContentDefinition content = owned(contentCode, actor);
                ContentVersion version = targetVersion(content, input);
                ReviewStage stage = "REVIEW_FIRST".equals(command) ? ReviewStage.FIRST_REVIEW : ReviewStage.FINAL_REVIEW;
                ReviewDecision decision = reviewDecision(input.get("reviewDecision"));
                String rejectNote = decision == ReviewDecision.APPROVED ? null
                        : com.englishflow.content.domain.ReviewTrail.requireRejectNote(reviewNote(input), "CONTENT");
                versionSnapshot = commands.review(
                        new ContentCommandService.ReviewCommand(
                                content.contentId(), version.versionId(), stage, decision,
                                textOr(input.get("reasonCode"), "B31_REVIEW"), textOr(input.get("reviewNote"), "")),
                        actor, key(key + ":review:" + stage.name()), context);
                if (rejectNote != null && reviewNotes != null) {
                    reviewNotes.record(contentCode, version.versionId().value(), version.versionNumber(),
                            stage.name(), decision.name(), rejectNote, actor.subjectId(), Instant.now());
                }
            }
            case "PUBLISH" -> {
                requirePublisher(actor);
                ContentDefinition content = owned(contentCode, actor);
                ContentVersion version = targetVersion(content, input);
                // Publish re-verifies the submission gate facts (ACTIVE rights,
                // bound PASS report, clean media) before delegating; the domain
                // additionally enforces dual approval and publishable rights.
                ReviewSubmissionReadiness publishable = publicationReadiness(version, Instant.now());
                if (!publishable.ready()) {
                    throw ContentOperationException.conflict(publishable.errorCode(),
                            "content version is not publishable: " + publishable.reason());
                }
                versionSnapshot = commands.publish(
                        new ContentCommandService.VersionCommand(content.contentId(), version.versionId()),
                        actor, key(key + ":publish"), context);
            }
            case "UNPUBLISH" -> {
                requirePublisher(actor);
                ContentDefinition content = owned(contentCode, actor);
                // After a rollback the current published version can be older
                // than the latest draft/version. Default to the published
                // pointer; explicit targetVersionNumber still gets validated.
                ContentVersion version = targetVersion(content, input, true);
                versionSnapshot = commands.unpublish(
                        new ContentCommandService.VersionCommand(content.contentId(), version.versionId()),
                        actor, key(key + ":unpublish"), context);
            }
            case "ROLLBACK" -> {
                requirePublisher(actor);
                ContentDefinition content = owned(contentCode, actor);
                ContentVersion version = targetVersion(content, input);
                versionSnapshot = commands.rollback(
                        new ContentCommandService.RollbackCommand(content.contentId(), version.versionId()),
                        actor, key(key + ":rollback"), context);
            }
            case "LEXEME_UPSERT" -> {
                requireEditor(actor);
                checkLexemeVersion(contentCode, text(input.get("lexemeId")), input, actor);
                LexemeCommandService.LexemeResult outcome = lexemes.upsert(
                        contentCode, record(input.get("lexeme")), text(input.get("lexemeId")),
                        expectedVersion(input), actor, key(key + ":lexeme:upsert"), context);
                Map<String, Object> lexemeResult = new LinkedHashMap<>();
                lexemeResult.put("commandId", commandId(key));
                lexemeResult.put("command", command);
                lexemeResult.put("contentCode", contentCode);
                lexemeResult.put("lexemeId", outcome.lexemeId());
                lexemeResult.put("lexemeStateVersion", outcome.stateVersion());
                lexemeResult.put("stateVersion", outcome.stateVersion());
                lexemeResult.put("lexemeStatus", outcome.availability().name());
                lexemeResult.put("status", "ACCEPTED");
                lexemeResult.put("acceptedAt", Instant.now());
                return ResponseEntity.status(HttpStatus.ACCEPTED).body(Map.of("data", lexemeResult));
            }
            case "LEXEME_SUBMIT_REVIEW" -> {
                requireEditor(actor);
                String lexemeId = required(input, "lexemeId");
                checkLexemeVersion(contentCode, lexemeId, input, actor);
                LexemeCommandService.LexemeResult outcome = lexemes.submit(
                        contentCode, lexemeId, actor, key(key + ":lexeme:submit"), context);
                return lexemeAccepted(key, command, contentCode, outcome);
            }
            case "LEXEME_REVIEW_FIRST", "LEXEME_REVIEW_FINAL" -> {
                String lexemeId = required(input, "lexemeId");
                checkLexemeVersion(contentCode, lexemeId, input, actor);
                ReviewDecision decision = reviewDecision(input.get("reviewDecision"));
                LexemeCommandService.LexemeResult outcome = "LEXEME_REVIEW_FIRST".equals(command)
                        ? lexemes.reviewFirst(contentCode, lexemeId, decision, reviewNote(input), actor,
                                key(key + ":lexeme:review:first"), context)
                        : lexemes.reviewFinal(contentCode, lexemeId, decision, reviewNote(input), actor,
                                key(key + ":lexeme:review:final"), context);
                return lexemeAccepted(key, command, contentCode, outcome);
            }
            case "LEXEME_PUBLISH", "LEXEME_UNPUBLISH", "LEXEME_ARCHIVE" -> {
                String lexemeId = required(input, "lexemeId");
                String reasonCode = required(input, "reasonCode");
                checkLexemeVersion(contentCode, lexemeId, input, actor);
                LexemeCommandService.LexemeResult outcome = switch (command) {
                    case "LEXEME_PUBLISH" -> lexemes.publish(contentCode, lexemeId, reasonCode, actor,
                            key(key + ":lexeme:publish"), context);
                    case "LEXEME_UNPUBLISH" -> lexemes.unpublish(contentCode, lexemeId, reasonCode, actor,
                            key(key + ":lexeme:unpublish"), context);
                    default -> lexemes.archive(contentCode, lexemeId, reasonCode, actor,
                            key(key + ":lexeme:archive"), context);
                };
                return lexemeAccepted(key, command, contentCode, outcome);
            }
            case "LEXEME_PRONUNCIATION_UPSERT" -> {
                requireEditor(actor);
                String lexemeId = required(input, "lexemeId");
                LexemePronunciation pronunciation = lexemes.upsertPronunciation(
                        contentCode, lexemeId, record(input.get("pronunciation")),
                        actor, key(key + ":lexeme:pron:upsert"), context);
                return pronunciationAccepted(key, command, contentCode, lexemeId, pronunciation);
            }
            case "LEXEME_PRONUNCIATION_QC" -> {
                requireEditor(actor);
                String lexemeId = required(input, "lexemeId");
                LexemePronunciation pronunciation = lexemes.reviewPronunciation(
                        contentCode, lexemeId, record(input.get("pronunciation")),
                        textOr(input.get("reasonCode"), "LEXEME_PRON_QC"),
                        actor, key(key + ":lexeme:pron:qc"), context);
                return pronunciationAccepted(key, command, contentCode, lexemeId, pronunciation);
            }
            case "ITEM_UPSERT" -> {
                requireEditor(actor);
                checkItemVersion(contentCode, text(input.get("itemId")), input, actor);
                ContentItemCommandService.ItemResult outcome = contentItems.upsert(
                        contentCode, record(input.get("item")), text(input.get("itemId")),
                        expectedVersion(input), actor, key(key + ":item:upsert"), context);
                Map<String, Object> itemResult = new LinkedHashMap<>();
                itemResult.put("commandId", commandId(key));
                itemResult.put("command", command);
                itemResult.put("contentCode", contentCode);
                itemResult.put("itemId", outcome.itemId());
                itemResult.put("itemStateVersion", outcome.stateVersion());
                itemResult.put("stateVersion", outcome.stateVersion());
                itemResult.put("itemStatus", outcome.availability().name());
                itemResult.put("status", "ACCEPTED");
                itemResult.put("acceptedAt", Instant.now());
                return ResponseEntity.status(HttpStatus.ACCEPTED).body(Map.of("data", itemResult));
            }
            case "ITEM_SUBMIT_REVIEW" -> {
                requireEditor(actor);
                String itemId = required(input, "itemId");
                checkItemVersion(contentCode, itemId, input, actor);
                ContentItemCommandService.ItemResult outcome = contentItems.submit(
                        contentCode, itemId, actor, key(key + ":item:submit"), context);
                return itemAccepted(key, command, contentCode, outcome);
            }
            case "ITEM_REVIEW_FIRST", "ITEM_REVIEW_FINAL" -> {
                String itemId = required(input, "itemId");
                checkItemVersion(contentCode, itemId, input, actor);
                ReviewDecision decision = reviewDecision(input.get("reviewDecision"));
                ContentItemCommandService.ItemResult outcome = "ITEM_REVIEW_FIRST".equals(command)
                        ? contentItems.reviewFirst(contentCode, itemId, decision, reviewNote(input), actor,
                                key(key + ":item:review:first"), context)
                        : contentItems.reviewFinal(contentCode, itemId, decision, reviewNote(input), actor,
                                key(key + ":item:review:final"), context);
                return itemAccepted(key, command, contentCode, outcome);
            }
            case "ITEM_PUBLISH", "ITEM_UNPUBLISH", "ITEM_ARCHIVE" -> {
                String itemId = required(input, "itemId");
                String reasonCode = required(input, "reasonCode");
                checkItemVersion(contentCode, itemId, input, actor);
                ContentItemCommandService.ItemResult outcome = switch (command) {
                    case "ITEM_PUBLISH" -> contentItems.publish(contentCode, itemId, reasonCode, actor,
                            key(key + ":item:publish"), context);
                    case "ITEM_UNPUBLISH" -> contentItems.unpublish(contentCode, itemId, reasonCode, actor,
                            key(key + ":item:unpublish"), context);
                    default -> contentItems.archive(contentCode, itemId, reasonCode, actor,
                            key(key + ":item:archive"), context);
                };
                return itemAccepted(key, command, contentCode, outcome);
            }
            case "SCHEDULE_PUBLISH" -> {
                Map<String, Object> schedule = record(input.get("schedule"));
                Instant runAt = scheduledAt(schedule);
                String targetType = textOr(input.get("targetType"), "PACK");
                String targetRef = "PACK".equalsIgnoreCase(targetType)
                        ? contentCode : textOr(input.get("targetRef"), contentCode);
                Object expected = input.get("expectedStateVersion");
                Long pin = expected instanceof Number number && number.longValue() > 0
                        ? number.longValue() : null;
                ScheduledPublishTask task = schedules.schedule(
                        contentCode, targetType, targetRef, pin, runAt,
                        textOr(input.get("reasonCode"), "SCHEDULED_PUBLISH"),
                        textOrNull(input.get("cohort")),
                        actor, key(key + ":schedule:publish"), context);
                return scheduleAccepted(key, command, contentCode, task);
            }
            case "CANCEL_SCHEDULED_PUBLISH" -> {
                String taskId = text(input.get("scheduledPublishTaskId"));
                if (taskId.isBlank()) {
                    throw ContentOperationException.badRequest("SCHEDULE_FIELD_INVALID",
                            "scheduledPublishTaskId is required");
                }
                ScheduledPublishTask task = schedules.cancel(
                        taskId, actor, key(key + ":schedule:cancel"), context);
                return scheduleAccepted(key, command, contentCode, task);
            }
            default -> throw ContentOperationException.badRequest("CONTENT_COMMAND_INVALID", "unsupported content command");
        }
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("commandId", commandId(key));
        result.put("command", command);
        result.put("contentCode", contentCode);
        if (versionSnapshot != null) {
            result.put("contentVersionId", versionSnapshot.versionId().value());
            result.put("stateVersion", stateVersion(owned(contentCode, actor)));
        } else {
            result.put("stateVersion", stateVersion(owned(contentCode, actor)));
        }
        if (validatedReport != null) {
            result.put("validationReport", reportView(validatedReport));
        }
        result.put("status", "ACCEPTED");
        result.put("acceptedAt", Instant.now());
        return ResponseEntity.status(HttpStatus.ACCEPTED).body(Map.of("data", result));
    }

    private static Map<String, Object> reportView(ValidationReport report) {
        Map<String, Object> view = new LinkedHashMap<>();
        view.put("reportId", report.reportId());
        view.put("reportVersion", report.reportVersion());
        view.put("contentVersionId", report.contentVersionId());
        view.put("contentHash", report.payloadHash());
        view.put("ruleVersion", report.ruleVersion());
        view.put("passed", report.passed());
        view.put("findingCount", report.findings().size());
        view.put("blockers", report.blockerCount());
        view.put("mediaRefs", List.copyOf(report.mediaRefs()));
        view.put("checkedBy", report.checkedBy());
        view.put("checkedAt", report.checkedAt().toString());
        return view;
    }

    private ResponseEntity<Map<String, Object>> draftCommand(
            Map<String, Object> input, String command, String contentCode,
            ContentActor actor, String requestKey, ContentRequestContext context) {
        String scope = actor.tenantId() + ":" + actor.subjectId() + ":content.b9.draft";
        Map<String, Object> result = idempotency.executeMap(
                scope, key(requestKey), ContentPayloadHash.sha256(input), () -> {
                    Map<String, Object> draft = record(input.get("content"));
                    ContentRights draftRights = rights(draft);
                    ContentId contentId;
                    if ("CREATE_DRAFT".equals(command)) {
                        requireExpectedRevision(input, 0L);
                        if (repository.findByCode(contentCode).isPresent()) {
                            throw ContentOperationException.conflict("CONTENT_EXISTS", "content code already exists");
                        }
                        contentId = ContentId.of(contentCode);
                        commands.createContent(new ContentCommandService.CreateContent(
                                contentId, contentCode, kind(draft.get("contentType")),
                                required(draft, "title"), textOr(draft.get("contentLocale"), "en-US"),
                                textOr(draft.get("targetLevel"), "A1"), "PHASE1"),
                                actor, key(requestKey + ":definition"), context);
                    } else {
                        ContentDefinition current = ownedForUpdate(contentCode, actor);
                        requireExpectedRevision(input, current.stateVersion());
                        current.versions().stream().reduce((left, right) -> right)
                                .filter(latest -> latest.status() == com.englishflow.content.domain.ContentVersionStatus.IN_REVIEW)
                                .ifPresent(latest -> {
                                    throw ContentOperationException.conflict("CONTENT_IN_REVIEW",
                                            "the latest version is under review; wait for the decision or ask a reviewer to reject it");
                                });
                        Object target = input.get("targetVersionNumber");
                        if (target != null) {
                            int latestNumber = current.versions().stream()
                                    .mapToInt(ContentVersion::versionNumber).max().orElse(0);
                            if (!(target instanceof Number number) || number.intValue() != latestNumber) {
                                throw ContentOperationException.conflict(
                                        "VERSION_CONFLICT", "target draft is no longer the latest version");
                            }
                        }
                        contentId = current.contentId();
                    }
                    ContentVersionSnapshot created = commands.createVersion(
                            new ContentCommandService.CreateVersion(
                                    contentId, repository.nextVersionId(), payload(draft), draftRights,
                                    proposal(draft).validated(),
                                    textOr(draft.get("releaseNote"), "draft revision")),
                            actor, key(requestKey + ":version"), context);
                    long revision = repository.find(contentId)
                            .orElseThrow(() -> ContentOperationException.unavailable(
                                    "CONTENT_PERSISTENCE_UNAVAILABLE", "saved content could not be read"))
                            .stateVersion();
                    Map<String, Object> receipt = new LinkedHashMap<>();
                    receipt.put("commandId", commandId(requestKey));
                    receipt.put("command", command);
                    receipt.put("contentCode", contentCode);
                    receipt.put("contentVersionId", created.versionId().value());
                    receipt.put("stateVersion", revision);
                    receipt.put("status", "ACCEPTED");
                    receipt.put("acceptedAt", Instant.now());
                    return receipt;
                });
        return ResponseEntity.status(HttpStatus.ACCEPTED).body(Map.of("data", result));
    }

    private ContentDefinition ownedForUpdate(String code, ContentActor actor) {
        ContentDefinition content = repository.findByCodeForUpdate(code)
                .orElseThrow(() -> ContentOperationException.notFound(
                        "CONTENT_NOT_FOUND", "content does not exist"));
        if (!TENANT.equals(content.tenantId()) || !TENANT.equals(actor.tenantId())) {
            throw ContentOperationException.forbidden("CONTENT_TENANT_DENIED", "content tenant scope denied");
        }
        return content;
    }

    private static void requireExpectedRevision(Map<String, Object> input, long current) {
        Object expected = input.get("expectedStateVersion");
        if (!(expected instanceof Number number) || number.longValue() < 0) {
            throw ContentOperationException.badRequest(
                    "EXPECTED_STATE_VERSION_REQUIRED", "expectedStateVersion is required");
        }
        if (number.longValue() != current) {
            throw ContentOperationException.conflict("VERSION_CONFLICT",
                    "stale stateVersion: expected " + number.longValue() + " but current is " + current);
        }
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
            @RequestHeader(name = "Idempotency-Key", required = false) String idempotencyKey,
            @RequestHeader HttpHeaders headers) {
        ContentActor actor = adminActor(authentication);
        requireAdminRead(actor);
        String requestKey = requireIdempotencyKey(idempotencyKey);
        Map<String, Object> input = body == null ? Map.of() : body;
        String scope = actor.tenantId() + ":" + actor.subjectId() + ":content.b9.validate";
        Map<String, Object> data = idempotency.executeMap(
                scope, key(requestKey), ContentPayloadHash.sha256(input), () -> {
                    String contentCode = text(input.get("contentCode"));
                    Map<String, Object> draft = record(input.get("content"));
                    ContentRights rights;
                    if (!contentCode.isBlank() && repository.findByCode(contentCode).isPresent()) {
                        ContentDefinition existing = owned(contentCode, actor);
                        ContentVersion latest = existing.versions().stream().reduce((left, right) -> right).orElse(null);
                        rights = latest == null || latest.rights().isEmpty() ? validationRights(draft) : latest.rights().get();
                        if (draft.isEmpty() && latest != null) {
                            draft = latest.payload().raw();
                        }
                    } else {
                        rights = validationRights(draft);
                    }
                    Instant checkedAt = Instant.now();
                    com.englishflow.content.domain.ContentAutoValidation.Report report =
                            com.englishflow.content.domain.ContentAutoValidation.validate(draft, rights, checkedAt);
                    Map<String, Object> receipt = new LinkedHashMap<>();
                    receipt.put("passed", report.passed());
                    receipt.put("ruleVersion", report.ruleVersion());
                    receipt.put("findings", report.findings().stream().map(f -> Map.of(
                            "code", f.code(), "severity", f.severity(), "detail", f.detail())).toList());
                    receipt.put("summary", report.summary());
                    receipt.put("checkedAt", checkedAt);
                    return receipt;
                });
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
        List<?> rawEntries = rawItems instanceof List<?> list ? list : List.of();
        // Non-object entries are counted as failed instead of silently shrinking the total.
        int dropped = (int) rawEntries.stream().filter(entry -> !(entry instanceof Map)).count();
        List<Map<String, Object>> items = rawEntries.stream().filter(Map.class::isInstance).map(Map.class::cast)
                .map(B9ContentAdminController::record).toList();
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
            String subKey = "batch-" + ContentPayloadHash.sha256(Map.of(
                    "batchKey", batchKey, "index", index, "contentCode", contentCode));
            try {
                if (item.containsKey("lexeme")) {
                    Map<String, Object> lexemeFields = record(item.get("lexeme"));
                    String headword = text(lexemeFields.get("headword"));
                    checkLexemeVersion(contentCode, text(item.get("lexemeId")), item, actor);
                    LexemeCommandService.LexemeResult outcome;
                    if (!headword.isBlank() && !text(item.get("lexemeId")).isBlank()) {
                        outcome = lexemes.upsert(contentCode, lexemeFields, text(item.get("lexemeId")),
                                actor, key(subKey + ":lexeme"), context);
                    } else if (!headword.isBlank() && lexemeExists(contentCode, headword, actor)) {
                        entry.put("status", "SKIPPED");
                        entry.put("reason", "LEXEME_EXISTS");
                        results.add(entry);
                        continue;
                    } else {
                        outcome = lexemes.upsert(contentCode, lexemeFields, text(item.get("lexemeId")),
                                actor, key(subKey + ":lexeme"), context);
                    }
                    entry.put("status", "ACCEPTED");
                    entry.put("lexemeId", outcome.lexemeId());
                    entry.put("stateVersion", outcome.stateVersion());
                } else if (item.containsKey("item")) {
                    Map<String, Object> itemFields = record(item.get("item"));
                    checkItemVersion(contentCode, text(item.get("itemId")), item, actor);
                    ContentItemCommandService.ItemResult outcome = contentItems.upsert(
                            contentCode, itemFields, text(item.get("itemId")),
                            actor, key(subKey + ":content-item"), context);
                    entry.put("status", "ACCEPTED");
                    entry.put("itemId", outcome.itemId());
                    entry.put("stateVersion", outcome.stateVersion());
                } else {
                    String scope = actor.tenantId() + ":" + actor.subjectId() + ":content.b9.batch.draft";
                    entry.putAll(idempotency.executeMap(scope, key(subKey),
                            ContentPayloadHash.sha256(item), () -> {
                                if (repository.findByCode(contentCode).isPresent()) {
                                    ContentDefinition existing = owned(contentCode, actor);
                                    return Map.of("status", "SKIPPED", "reason", "CONTENT_EXISTS",
                                            "stateVersion", stateVersion(existing));
                                }
                                Map<String, Object> merged = new LinkedHashMap<>(draft);
                                merged.putIfAbsent("title", contentCode);
                                ContentRights draftRights = rights(merged);
                                ContentId contentId = ContentId.of(contentCode);
                                commands.createContent(new ContentCommandService.CreateContent(
                                        contentId, contentCode, kind(merged.get("contentType")),
                                        required(merged, "title"),
                                        textOr(merged.get("contentLocale"), "en-US"),
                                        textOr(merged.get("targetLevel"), "A1"), "PHASE1"),
                                        actor, key(subKey + ":definition"), context);
                                ContentVersionSnapshot created = commands.createVersion(
                                        new ContentCommandService.CreateVersion(
                                                contentId, repository.nextVersionId(), payload(merged), draftRights,
                                                textOr(merged.get("releaseNote"), "batch import")),
                                        actor, key(subKey + ":version"), context);
                                return Map.of("status", "ACCEPTED",
                                        "contentVersionId", created.versionId().value(),
                                        "stateVersion", repository.find(contentId).orElseThrow().stateVersion());
                            }));
                }
            } catch (ContentOperationException error) {
                entry.put("status", "FAILED");
                entry.put("errorCode", error.code());
            } catch (RuntimeException error) {
                // One poisoned entry must not abort the batch; the row is recorded
                // and the remaining entries still run.
                entry.put("status", "FAILED");
                entry.put("errorCode", "CONTENT_BATCH_ENTRY_FAILED");
            }
            results.add(entry);
        }
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("batchKey", batchKey);
        data.put("commandId", commandId(batchKey));
        data.put("total", results.size() + dropped);
        data.put("accepted", results.stream().filter(r -> "ACCEPTED".equals(r.get("status"))).count());
        data.put("skipped", results.stream().filter(r -> "SKIPPED".equals(r.get("status"))).count());
        data.put("failed", results.stream().filter(r -> "FAILED".equals(r.get("status"))).count() + dropped);
        data.put("items", results);
        data.put("acceptedAt", Instant.now());
        return ResponseEntity.status(HttpStatus.ACCEPTED).body(Map.of("data", data));
    }

    /**
     * Row-level word-master list. Items reuse the {@code B9AdminContentState}
     * shape ({@code contentCode=lex:{lexemeId}, contentType=VOCABULARY,
     * title=headword, latestStatus=availability}) and additionally carry the
     * full {@code lexeme} record; cursor is the last seen lexeme id.
     */
    private ResponseEntity<Map<String, Object>> lexemeList(
            ContentActor actor,
            String cursor,
            int size,
            String packCode,
            String query,
            String cefr,
            String availability,
            String language,
            ContentRequestContext context) {
        String pack = packCode == null || packCode.isBlank() ? "VOCAB-PHASE1" : packCode.trim();
        LexemeAvailability status = availability == null || availability.isBlank()
                ? null : LexemeAvailability.parse(availability);
        String after = cursor == null || cursor.isBlank() ? null : cursor.trim();
        // One-row probe so hasMore/nextCursor agree instead of guessing at exact multiples.
        List<Lexeme> rows = lexemes.search(pack, query, cefr, status, language, size + 1, after, actor);
        boolean hasMore = rows.size() > size;
        List<Map<String, Object>> items =
                rows.stream().limit(size).map(row -> lexemeState(row, actor)).toList();
        String nextCursor = hasMore ? rows.get(size - 1).lexemeId() : null;
        return ResponseEntity.ok(cursorPage(items, hasMore, nextCursor, size, context));
    }

    private ResponseEntity<Map<String, Object>> lexemeAccepted(
            String key, String command, String packCode, LexemeCommandService.LexemeResult outcome) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("commandId", commandId(key));
        result.put("command", command);
        result.put("contentCode", packCode);
        result.put("lexemeId", outcome.lexemeId());
        result.put("lexemeStateVersion", outcome.stateVersion());
        result.put("stateVersion", outcome.stateVersion());
        result.put("lexemeStatus", outcome.availability().name());
        result.put("status", "ACCEPTED");
        result.put("acceptedAt", Instant.now());
        return ResponseEntity.status(HttpStatus.ACCEPTED).body(Map.of("data", result));
    }

    private ResponseEntity<Map<String, Object>> pronunciationAccepted(
            String key, String command, String packCode, String lexemeId, LexemePronunciation pronunciation) {        Map<String, Object> result = new LinkedHashMap<>();
        result.put("commandId", commandId(key));
        result.put("command", command);
        result.put("contentCode", packCode);
        result.put("lexemeId", lexemeId);
        result.put("pronunciationId", pronunciation.pronunciationId());
        result.put("pronunciationQc", pronunciation.qcStatus());
        result.put("status", "ACCEPTED");
        result.put("acceptedAt", Instant.now());
        return ResponseEntity.status(HttpStatus.ACCEPTED).body(Map.of("data", result));
    }

    private void checkLexemeVersion(String packCode, String lexemeId, Map<String, Object> input, ContentActor actor) {
        Object expected = input.get("expectedStateVersion");
        if (!(expected instanceof Number number) || number.longValue() <= 0) {
            return;
        }
        if (lexemeId == null || lexemeId.isBlank()) {
            return;
        }
        Lexeme current;
        try {
            current = lexemes.current(packCode, lexemeId, actor);
        } catch (ContentOperationException missing) {
            if ("LEXEME_NOT_FOUND".equals(missing.code())) {
                return;
            }
            throw missing;
        }
        if (current.stateVersion() != number.longValue()) {
            throw ContentOperationException.conflict("LEXEME_VERSION_CONFLICT",
                    "stale stateVersion: expected " + number.longValue() + " but current is " + current.stateVersion());
        }
    }

    private Map<String, Object> lexemeState(Lexeme lexeme, ContentActor actor) {
        List<LexemePronunciation> pronunciations = lexemes.pronunciations(
                lexeme.packCode(), lexeme.lexemeId(), actor);
        Map<String, Object> projection = new LinkedHashMap<>();
        projection.put("availability",
                lexeme.isLive() ? "PUBLISHED" : "UNPUBLISHED");
        projection.put("projectionVersion", Math.max(1, lexeme.contentVersion()));
        projection.put("contentEpoch", 1L);
        Map<String, Object> fields = lexeme.fields();
        Map<String, Object> record = new LinkedHashMap<>();
        record.put("lexemeId", lexeme.lexemeId());
        record.put("headword", lexeme.headword());
        record.put("language", lexeme.language());
        record.put("packCode", lexeme.packCode());
        record.put("cefr", lexeme.cefr());
        record.put("availability", lexeme.availability().name());
        record.put("stateVersion", lexeme.stateVersion());
        record.put("contentVersion", lexeme.contentVersion());
        record.put("fields", fields);
        record.put("publishedFields", lexeme.publishedFields());
        record.put("pronunciations", pronunciations.stream().map(B9ContentAdminController::pronunciationView).toList());
        record.put("createdBy", lexeme.createdBy());
        record.put("updatedBy", lexeme.updatedBy());
        record.put("firstReviewer", lexeme.firstReviewer());
        record.put("finalReviewer", lexeme.finalReviewer());
        record.put("reviewTrail", reviewTrail(lexeme.trail()));
        record.put("createdAt", lexeme.createdAt());
        record.put("updatedAt", lexeme.updatedAt());
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("contentCode", "lex:" + lexeme.lexemeId());
        result.put("contentType", "VOCABULARY");
        result.put("title", lexeme.headword());
        result.put("authorSubject", lexeme.createdBy());
        result.put("stateVersion", lexeme.stateVersion());
        result.put("latestStatus", lexeme.availability().name());
        result.put("versions", List.of());
        result.put("publicProjection", projection);
        result.put("rightsStatus",
                fields.containsKey("sourceCode") && fields.containsKey("licenseCode") ? "VALID" : "PENDING");
        result.put("lexeme", record);
        return result;
    }

    private static Map<String, Object> pronunciationView(LexemePronunciation pronunciation) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("pronunciationId", pronunciation.pronunciationId());
        result.put("accent", pronunciation.accent());
        result.put("ipa", pronunciation.ipa());
        result.put("audioAssetId", pronunciation.audioAssetId());
        result.put("sourceType", pronunciation.sourceType());
        result.put("voiceName", pronunciation.voiceName());
        result.put("durationMs", pronunciation.durationMs());
        result.put("sampleRate", pronunciation.sampleRate());
        result.put("bitrateKbps", pronunciation.bitrateKbps());
        result.put("qcStatus", pronunciation.qcStatus());
        result.put("qcBy", pronunciation.qcBy());
        result.put("qcAt", pronunciation.qcAt());
        result.put("createdAt", pronunciation.createdAt());
        return result;
    }

    /** Owner-side scheduled-task read for the exact admin Gateway projection. */
    @GetMapping("/publish-tasks/{taskId}")
    public ResponseEntity<Map<String, Object>> getScheduledTask(
            @PathVariable String taskId,
            Authentication authentication,
            @RequestHeader HttpHeaders headers) {
        ContentActor actor = adminActor(authentication);
        requireAdminRead(actor);
        ScheduledPublishTask task = schedules.get(taskId, actor);
        return ResponseEntity.ok(envelope(scheduleView(task), headers));
    }

    private ResponseEntity<Map<String, Object>> itemList(
            ContentActor actor,
            String cursor,
            int size,
            String packCode,
            String itemKind,
            String query,
            String availability,
            ContentRequestContext context) {
        String pack = packCode == null || packCode.isBlank() ? "VOCAB-PHASE1" : packCode.trim();
        ItemAvailability status = availability == null || availability.isBlank()
                ? null : ItemAvailability.parse(availability);
        String after = cursor == null || cursor.isBlank() ? null : cursor.trim();
        List<ContentItem> rows = contentItems.search(pack, itemKind, query, status, size + 1, after, actor);
        boolean hasMore = rows.size() > size;
        List<Map<String, Object>> items =
                rows.stream().limit(size).map(B9ContentAdminController::itemState).toList();
        String nextCursor = hasMore ? rows.get(size - 1).itemId() : null;
        return ResponseEntity.ok(cursorPage(items, hasMore, nextCursor, size, context));
    }

    private ResponseEntity<Map<String, Object>> packList(
            ContentActor actor,
            String cursor,
            int size,
            ContentRequestContext context) {
        String after = cursor == null ? "" : cursor.trim();
        // Pack rows are few and already in memory; keyset over contentCode so the
        // cursor actually advances instead of echoing back the same page.
        List<ContentDefinition> packs = repository.findAll().stream()
                .filter(content -> TENANT.equals(content.tenantId()))
                .sorted(java.util.Comparator.comparing(ContentDefinition::contentCode))
                .filter(content -> after.isEmpty() || content.contentCode().compareTo(after) > 0)
                .limit((long) size + 1)
                .toList();
        boolean hasMore = packs.size() > size;
        List<Map<String, Object>> items = packs.stream().limit(size)
                .map(content -> withScheduledTasks(state(content, actor), content.contentCode(), actor))
                .toList();
        String nextCursor = hasMore ? packs.get(size - 1).contentCode() : null;
        return ResponseEntity.ok(cursorPage(items, hasMore, nextCursor, size, context));
    }

    private static Map<String, Object> cursorPage(
            List<Map<String, Object>> items,
            boolean hasMore,
            String nextCursor,
            int size,
            ContentRequestContext context) {
        Map<String, Object> meta = new LinkedHashMap<>();
        meta.put("requestId", context.requestId());
        meta.put("traceId", context.traceId());
        meta.put("apiVersion", "v1");
        meta.put("schemaVersion", "1.0.0");
        meta.put("serverTime", Instant.now().toString());
        meta.put("hasMore", hasMore);
        meta.put("pageSize", size);
        meta.put("nextCursor", nextCursor);
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("data", items);
        body.put("meta", meta);
        return body;
    }

    private ResponseEntity<Map<String, Object>> itemAccepted(
            String key, String command, String packCode, ContentItemCommandService.ItemResult outcome) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("commandId", commandId(key));
        result.put("command", command);
        result.put("contentCode", packCode);
        result.put("itemId", outcome.itemId());
        result.put("itemStateVersion", outcome.stateVersion());
        result.put("stateVersion", outcome.stateVersion());
        result.put("itemStatus", outcome.availability().name());
        result.put("status", "ACCEPTED");
        result.put("acceptedAt", Instant.now());
        return ResponseEntity.status(HttpStatus.ACCEPTED).body(Map.of("data", result));
    }

    private ResponseEntity<Map<String, Object>> scheduleAccepted(
            String key, String command, String packCode, ScheduledPublishTask task) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("commandId", commandId(key));
        result.put("command", command);
        result.put("contentCode", packCode);
        result.put("scheduledPublishTaskId", task.taskId());
        result.put("scheduleStatus", task.status());
        result.put("runAt", task.runAt());
        result.put("status", "ACCEPTED");
        result.put("acceptedAt", Instant.now());
        return ResponseEntity.status(HttpStatus.ACCEPTED).body(Map.of("data", result));
    }

    private void checkItemVersion(String packCode, String itemId, Map<String, Object> input, ContentActor actor) {
        Object expected = input.get("expectedStateVersion");
        if (!(expected instanceof Number number) || number.longValue() <= 0) {
            return;
        }
        if (itemId == null || itemId.isBlank()) {
            return;
        }
        ContentItem current;
        try {
            current = contentItems.current(packCode, itemId, actor);
        } catch (ContentOperationException missing) {
            if ("ITEM_NOT_FOUND".equals(missing.code())) {
                return;
            }
            throw missing;
        }
        if (current.stateVersion() != number.longValue()) {
            throw ContentOperationException.conflict("ITEM_VERSION_CONFLICT",
                    "stale stateVersion: expected " + number.longValue() + " but current is " + current.stateVersion());
        }
    }

    private static Instant scheduledAt(Map<String, Object> schedule) {
        Object runAt = schedule.get("scheduledAt");
        if (runAt instanceof String text && !text.isBlank()) {
            try {
                return Instant.parse(text.trim());
            } catch (java.time.format.DateTimeParseException invalid) {
                throw ContentOperationException.badRequest("SCHEDULE_TIME_INVALID",
                        "scheduledAt must be RFC3339");
            }
        }
        throw ContentOperationException.badRequest("SCHEDULE_TIME_INVALID", "schedule.scheduledAt is required");
    }

    private static Map<String, Object> itemState(ContentItem item) {
        Map<String, Object> projection = new LinkedHashMap<>();
        projection.put("availability",
                item.isLive() ? "PUBLISHED" : "UNPUBLISHED");
        projection.put("projectionVersion", 1L);
        projection.put("contentEpoch", 1L);
        Map<String, Object> record = new LinkedHashMap<>();
        record.put("itemId", item.itemId());
        record.put("kind", item.kind());
        record.put("stem", item.stem());
        record.put("firstReviewer", item.firstReviewer());
        record.put("finalReviewer", item.finalReviewer());
        record.put("reviewTrail", reviewTrail(item.trail()));
        record.put("packCode", item.packCode());
        record.put("availability", item.availability().name());
        record.put("stateVersion", item.stateVersion());
        record.put("fields", item.fields());
        record.put("sourceCode", item.sourceCode());
        record.put("licenseCode", item.licenseCode());
        record.put("createdBy", item.createdBy());
        record.put("updatedBy", item.updatedBy());
        record.put("createdAt", item.createdAt());
        record.put("updatedAt", item.updatedAt());
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("contentCode", "item:" + item.itemId());
        result.put("contentType", itemContentType(item.kind()));
        result.put("title", item.stem().isBlank() ? item.itemId() : item.stem());
        result.put("authorSubject", item.createdBy());
        result.put("stateVersion", item.stateVersion());
        result.put("latestStatus", item.availability().name());
        result.put("versions", List.of());
        result.put("publicProjection", projection);
        result.put("rightsStatus",
                item.sourceCode() != null && item.licenseCode() != null ? "VALID" : "PENDING");
        result.put("item", record);
        return result;
    }

    private static String itemContentType(String kind) {
        return switch (kind) {
            case "QUESTION", "EXERCISE", "DICTATION", "SHADOWING" -> "QUESTION";
            case "EXAMPLE" -> "SENTENCE";
            case "GRAMMAR_POINT" -> "GRAMMAR";
            default -> "COURSE_UNIT";
        };
    }

    private static Map<String, Object> scheduleView(ScheduledPublishTask task) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("taskId", task.taskId());
        result.put("packCode", task.packCode());
        result.put("targetType", task.targetType());
        result.put("targetRef", task.targetRef());
        result.put("expectedStateVersion", task.expectedStateVersion());
        result.put("runAt", task.runAt());
        result.put("status", task.status());
        result.put("reasonCode", task.reasonCode());
        result.put("cohort", task.cohort());
        result.put("failureCode", task.failureCode());
        result.put("createdBy", task.createdBy());
        result.put("createdAt", task.createdAt());
        result.put("updatedAt", task.updatedAt());
        return result;
    }

    private Map<String, Object> withScheduledTasks(Map<String, Object> state, String packCode, ContentActor actor) {
        // Store failures propagate to the shared 503 mapping; an empty task list
        // must mean "no tasks", never "the schedule store is down".
        List<Map<String, Object>> tasks = schedules.listByPack(packCode, 20, actor).stream()
                .map(B9ContentAdminController::scheduleView).toList();
        state.put("scheduledTasks", tasks);
        return state;
    }

    private boolean lexemeExists(String packCode, String headword, ContentActor actor) {
        return !lexemes.search(packCode, headword, null, null, null, 1, null, actor).stream()
                .filter(candidate -> candidate.headword().equalsIgnoreCase(headword))
                .toList()
                .isEmpty();
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

    private static void requireReviewerFirst(ContentActor actor) {
        if (!actor.canReviewFirst()) {
            throw ContentOperationException.forbidden("CONTENT_REVIEW_L1_REQUIRED", "first review permission is required");
        }
    }

    private static void requireReviewerFinal(ContentActor actor) {
        if (!actor.canReviewFinal()) {
            throw ContentOperationException.forbidden("CONTENT_REVIEW_L2_REQUIRED", "final review permission is required");
        }
    }

    private static void requirePublisher(ContentActor actor) {
        if (!actor.canPublish()) {
            throw ContentOperationException.forbidden("CONTENT_PUBLISHER_REQUIRED", "content publisher permission is required");
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
        return targetVersion(content, input, false);
    }

    private static ContentVersion targetVersion(ContentDefinition content, Map<String, Object> input,
                                                boolean preferCurrentPublished) {
        // The API stateVersion is the whole content aggregate revision, not one version's status.
        Object expected = input.get("expectedStateVersion");
        if (expected instanceof Number number && number.longValue() > 0) {
            long current = content.stateVersion();
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
        if (preferCurrentPublished) {
            return content.currentPublishedVersion().orElseThrow(() ->
                    ContentOperationException.conflict("CONTENT_NOT_PUBLISHED", "content has no published version"));
        }
        return content.versions().stream().reduce((left, right) -> right)
                .orElseThrow(() -> ContentOperationException.notFound("CONTENT_VERSION_NOT_FOUND", "content has no version"));
    }

    private static ContentVersion latestVersion(ContentDefinition content) {
        return content.versions().stream().reduce((left, right) -> right)
                .orElseThrow(() -> ContentOperationException.notFound("CONTENT_VERSION_NOT_FOUND", "content has no version"));
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
        // The version rights fact stays PENDING with no granted channels here:
        // editor input never establishes copyright authority (locked boundary).
        // The submission dossier (channels/evidence/learning grant) travels as
        // a separate version-bound proposal that only L2 final approval can
        // verify into ACTIVE rights.
        return new ContentRights(
                required(draft, "sourceCode"),
                required(draft, "licenseCode"),
                CopyrightStatus.PENDING,
                false,
                Set.of(),
                null,
                null,
                null);
    }

    private static RightsProposal proposal(Map<String, Object> draft) {
        return RightsProposal.proposed(channels(draft.get("permittedChannels")),
                textOrNull(draft.get("authorizationEvidenceRef")),
                Boolean.TRUE.equals(draft.get("allowsLearning")));
    }

    private static java.util.Set<String> channels(Object raw) {
        if (!(raw instanceof java.util.List<?> list) || list.isEmpty()) {
            return java.util.Set.of();
        }
        java.util.LinkedHashSet<String> result = new java.util.LinkedHashSet<>();
        for (Object item : list) {
            if (item instanceof String text && !text.isBlank() && result.size() < 16) {
                result.add(text.trim().toUpperCase(java.util.Locale.ROOT));
            }
        }
        return java.util.Set.copyOf(result);
    }

    private static ContentRights validationRights(Map<String, Object> draft) {
        // The report endpoint must describe an incomplete draft, not reject it
        // before the validator can return actionable findings.
        return text(draft.get("sourceCode")).isBlank() || text(draft.get("licenseCode")).isBlank()
                ? null : rights(draft);
    }

    /** Contract expectedStateVersion as an optimistic-lock token; absent/non-numeric keeps legacy semantics. */
    private static Long expectedVersion(Map<String, Object> input) {
        Object expected = input.get("expectedStateVersion");
        return expected instanceof Number number && number.longValue() >= 0 ? number.longValue() : null;
    }

    private static String reviewNote(Map<String, Object> input) {
        Object note = input.get("reviewNote");
        return note == null ? null : String.valueOf(note);
    }

    static Map<String, Object> reviewTrail(com.englishflow.content.domain.ReviewTrail trail) {
        Map<String, Object> view = new LinkedHashMap<>();
        view.put("submittedBy", trail.submittedBy());
        view.put("lastDecision", trail.lastDecision());
        view.put("lastNote", trail.lastNote());
        view.put("lastReviewer", trail.lastReviewer());
        view.put("lastReviewedAt", trail.lastReviewedAt() == null ? null : trail.lastReviewedAt().toString());
        view.put("revisionOfLive", trail.revisionOfLive());
        return view;
    }

    private static ReviewDecision reviewDecision(Object raw) {
        String value = text(raw).toUpperCase();
        if (value.isBlank()) {
            throw ContentOperationException.badRequest("REVIEW_DECISION_REQUIRED", "reviewDecision is required");
        }
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

    private Map<String, Object> state(ContentDefinition content, ContentActor actor) {
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
        ReviewSubmissionReadiness readiness = reviewSubmissionReadiness(latest, Instant.now());
        result.put("reviewSubmissionReady", readiness.ready());
        result.put("reviewSubmissionReason", readiness.reason());
        if (latest != null) {
            reports.findLatest(latest.versionId().value(), latest.contentHash())
                    .ifPresent(report -> result.put("validationReport", reportView(report)));
        }
        result.put("reviewStages", reviewStages(latest));
        return result;
    }

    private record ReviewSubmissionReadiness(boolean ready, String reason, String errorCode) {
    }

    /**
     * Submit/publish gate over owner facts only.
     *
     * <p>A version is submittable with a PENDING rights fact provided the
     * editor dossier is complete (evidence, learning grant, LEARNER+PUBLIC
     * channels); L2 final approval verifies that dossier into ACTIVE rights.
     * Beyond attestation the gate requires a live validation PASS, a stored
     * PASS report bound to the exact (version, hash), and a clean media set
     * (text-only versions pass vacuously; media-bearing versions without
     * stored media-eligibility facts fail closed). Publish additionally
     * requires ACTIVE rights (checked by {@link #publicationReadiness}).
     */
    private ReviewSubmissionReadiness reviewSubmissionReadiness(ContentVersion version, Instant now) {
        if (version == null || version.status() != ContentVersionStatus.DRAFT) {
            return new ReviewSubmissionReadiness(false, "DRAFT_REQUIRED", "CONTENT_STATE_INVALID");
        }
        if (!isAttested(version, now)) {
            return new ReviewSubmissionReadiness(false, "RIGHTS_NOT_READY", "CONTENT_RIGHTS_NOT_READY");
        }
        return gateFacts(version, now);
    }

    private ReviewSubmissionReadiness publicationReadiness(ContentVersion version, Instant now) {
        if (version == null) {
            return new ReviewSubmissionReadiness(false, "DRAFT_REQUIRED", "CONTENT_STATE_INVALID");
        }
        ContentRights rights = version.rights().orElse(null);
        if (rights == null || !rights.isActive(now)
                || !rights.allows(com.englishflow.content.domain.ContentChannel.LEARNER, now)
                || !rights.allows(com.englishflow.content.domain.ContentChannel.PUBLIC, now)) {
            return new ReviewSubmissionReadiness(false, "RIGHTS_NOT_READY", "CONTENT_RIGHTS_NOT_READY");
        }
        return gateFacts(version, now);
    }

    private ReviewSubmissionReadiness gateFacts(ContentVersion version, Instant now) {
        ContentAutoValidation.Report report = ContentAutoValidation.validate(
                version.payload().raw(), version.effectiveRights(), now);
        if (!report.passed()) {
            return new ReviewSubmissionReadiness(false, "VALIDATION_NOT_PASSED", "CONTENT_VALIDATION_NOT_PASSED");
        }
        java.util.Optional<ValidationReport> bound = reports.findLatest(
                version.versionId().value(), version.contentHash());
        if (bound.isEmpty() || !bound.get().passed()) {
            // No PASS report bound to this immutable version/hash is stored.
            // A live calculation or client-provided status cannot stand in for
            // that owner fact: run VALIDATE_DRAFT first.
            return new ReviewSubmissionReadiness(false, "VALIDATION_REPORT_UNAVAILABLE",
                    "CONTENT_REVIEW_EVIDENCE_UNAVAILABLE");
        }
        if (!bound.get().mediaRefs().isEmpty()) {
            return new ReviewSubmissionReadiness(false, "MEDIA_ELIGIBILITY_UNAVAILABLE",
                    "CONTENT_REVIEW_EVIDENCE_UNAVAILABLE");
        }
        return new ReviewSubmissionReadiness(true, "READY", null);
    }

    private static boolean isAttested(ContentVersion version, Instant now) {
        if (version.rights().isEmpty()) {
            return false;
        }
        ContentRights rights = version.rights().get();
        if (rights.status() == CopyrightStatus.ACTIVE) {
            return rights.isAttestedForReview(now);
        }
        return version.proposal().isComplete()
                && rights.sourceCode() != null && !rights.sourceCode().isBlank()
                && rights.licenseCode() != null && !rights.licenseCode().isBlank();
    }

    /**
     * Content-ops R2 workbench backfill (contract proposal, see CONTENT-OPS-20261013.md):
     * the latest version's editable facts so opening a draft or starting a
     * revision shows the stored content instead of an empty form. Admin read
     * only; the evidence reference is the editor's own dossier pointer.
     */
    private static Map<String, Object> editorDraft(ContentDefinition content, ContentVersion version) {
        Map<String, Object> draft = new LinkedHashMap<>();
        draft.put("contentVersionId", version.versionId().value());
        draft.put("versionNumber", version.versionNumber());
        draft.put("status", version.status().name());
        draft.put("editor", version.editor());
        draft.put("contentType", content.kind().name());
        draft.put("title", content.title());
        draft.put("contentHash", version.contentHash());
        draft.put("releaseNote", version.releaseNote());
        draft.put("sourceCode", version.rights().map(ContentRights::sourceCode).orElse(""));
        draft.put("licenseCode", version.rights().map(ContentRights::licenseCode).orElse(""));
        RightsProposal proposal = version.proposal();
        draft.put("permittedChannels", proposal == null ? List.of() : proposal.channelList());
        draft.put("authorizationEvidenceRef", proposal == null ? null : proposal.proposedEvidenceRef());
        draft.put("allowsLearning", proposal != null && proposal.proposedAllowsLearning());
        draft.put("payload", version.payload().raw());
        draft.put("publishedVersionNumber", content.currentPublishedVersion()
                .map(ContentVersion::versionNumber).orElse(null));
        return draft;
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
        return content.stateVersion();
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

    private static String textOrNull(Object value) {
        String text = text(value);
        return text.isBlank() ? null : text;
    }
}
