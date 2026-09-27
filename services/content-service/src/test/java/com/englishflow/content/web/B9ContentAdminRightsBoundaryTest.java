package com.englishflow.content.web;

import com.englishflow.content.adapter.memory.InMemoryContentIdempotency;
import com.englishflow.content.adapter.memory.InMemoryContentOutbox;
import com.englishflow.content.adapter.memory.InMemoryContentRepository;
import com.englishflow.content.adapter.memory.InMemoryPublicProjectionStore;
import com.englishflow.content.adapter.memory.InMemoryValidationReportStore;
import com.englishflow.content.adapter.memory.RecordingContentCacheInvalidator;
import com.englishflow.content.application.ContentCommandService;
import com.englishflow.content.application.ContentItemCommandService;
import com.englishflow.content.application.LexemeCommandService;
import com.englishflow.content.application.ScheduledPublishService;
import com.englishflow.content.domain.ContentDefinition;
import com.englishflow.content.domain.ContentId;
import com.englishflow.content.domain.ContentKind;
import com.englishflow.content.domain.ContentOperationException;
import com.englishflow.content.domain.ContentRights;
import com.englishflow.content.domain.ContentVersion;
import com.englishflow.content.domain.ContentVersionId;
import com.englishflow.content.domain.ContentVersionStatus;
import com.englishflow.content.domain.CopyrightStatus;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;

import java.time.Clock;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;

/** Service-boundary tests: draft input never establishes copyright authority. */
class B9ContentAdminRightsBoundaryTest {

    private static final String CODE = "rights-boundary-pack";
    private static final HttpHeaders HEADERS = new HttpHeaders();

    private InMemoryContentRepository repository;
    private InMemoryContentOutbox outbox;
    private InMemoryValidationReportStore reports;
    private B9ContentAdminController controller;

    @BeforeEach
    void setUp() {
        repository = new InMemoryContentRepository();
        outbox = new InMemoryContentOutbox();
        reports = new InMemoryValidationReportStore();
        InMemoryContentIdempotency idempotency = new InMemoryContentIdempotency();
        ContentCommandService commands = new ContentCommandService(
                repository, outbox, idempotency,
                new InMemoryPublicProjectionStore(), new RecordingContentCacheInvalidator(),
                reports, Clock.systemUTC());
        controller = new B9ContentAdminController(commands, mock(LexemeCommandService.class),
                mock(ContentItemCommandService.class), mock(ScheduledPublishService.class),
                repository, new VerifiedContentPrincipalFactory(), idempotency, reports);
    }

    @Test
    void createAndSaveKeepRealSourceAndLicensePendingDespiteClientAuthorityFields() {
        Map<String, Object> draft = draft();
        draft.put("copyrightStatus", "ACTIVE");
        draft.put("allowsLearning", true);
        draft.put("permittedChannels", List.of("LEARNER", "PUBLIC"));
        draft.put("authorizationEvidenceRef", "client-claimed-evidence");
        command("CREATE_DRAFT", CODE, draft, editor(), "create-draft-rights-1");

        assertPendingRights(latest());
        assertEquals("SOURCE-ONE", latest().rights().orElseThrow().sourceCode());
        assertEquals("LICENSE-ONE", latest().rights().orElseThrow().licenseCode());

        Map<String, Object> revision = draft();
        revision.put("sourceCode", "SOURCE-TWO");
        revision.put("licenseCode", "LICENSE-TWO");
        revision.put("copyrightStatus", "ACTIVE");
        revision.put("authorizationEvidenceRef", "another-client-claim");
        command("SAVE_DRAFT", CODE, revision, editor(), "save-draft-rights-1");

        assertEquals(2, content().versions().size());
        assertPendingRights(latest());
        assertEquals("SOURCE-TWO", latest().rights().orElseThrow().sourceCode());
        assertEquals("LICENSE-TWO", latest().rights().orElseThrow().licenseCode());
    }

    @Test
    void missingRightsFieldsRejectCreateBeforeAnyDefinitionIsWritten() {
        for (String field : List.of("sourceCode", "licenseCode")) {
            Map<String, Object> incomplete = draft();
            incomplete.remove(field);
            String code = CODE + "-" + field;
            ContentOperationException error = assertThrows(ContentOperationException.class,
                    () -> command("CREATE_DRAFT", code, incomplete, editor(), "missing-" + field));
            assertEquals(400, error.status());
            assertEquals("CONTENT_FIELD_REQUIRED", error.code());
            assertTrue(repository.findByCode(code).isEmpty(), "invalid draft must leave no content definition");
        }
    }

    @Test
    void unauthorizedReviewAndReleaseCommandsRejectBeforeLookingUpContent() {
        for (String operation : List.of("REVIEW_FIRST", "REVIEW_FINAL", "PUBLISH", "UNPUBLISH", "ROLLBACK")) {
            String missingCode = "missing-" + operation.toLowerCase();
            Map<String, Object> body = new LinkedHashMap<>();
            body.put("command", operation);
            body.put("contentCode", missingCode);
            body.put("expectedStateVersion", 0);
            body.put("reviewDecision", "APPROVED");
            ContentOperationException denied = assertThrows(ContentOperationException.class,
                    () -> controller.command(body, actor("learner-1", "learner.profile.read"),
                            "unauthorized-" + operation, HEADERS), operation);
            assertEquals(403, denied.status(), operation);
            assertTrue(repository.findByCode(missingCode).isEmpty());
        }
    }

    @Test
    void saveWithoutLicenseDoesNotAppendARevision() {
        command("CREATE_DRAFT", CODE, draft(), editor(), "create-draft-before-save");
        Map<String, Object> incomplete = draft();
        incomplete.put("licenseCode", " ");

        ContentOperationException error = assertThrows(ContentOperationException.class,
                () -> command("SAVE_DRAFT", CODE, incomplete, editor(), "save-without-license"));
        assertEquals("CONTENT_FIELD_REQUIRED", error.code());
        assertEquals(1, content().versions().size());
    }

    @Test
    void pendingRightsBlockReviewSubmissionAndKeepTheDraftUnchanged() {
        command("CREATE_DRAFT", CODE, draft(), editor(), "create-draft-review");
        long revision = content().stateVersion();
        Map<String, Object> state = data(controller.get(CODE, editor(), HEADERS).getBody());
        assertEquals(false, state.get("reviewSubmissionReady"));
        assertEquals("RIGHTS_NOT_READY", state.get("reviewSubmissionReason"));

        ContentOperationException blocked = assertThrows(ContentOperationException.class,
                () -> command("SUBMIT_REVIEW", CODE, null, editor(), "submit-draft-review"));
        assertEquals(409, blocked.status());
        assertEquals("CONTENT_RIGHTS_NOT_READY", blocked.code());
        assertEquals(ContentVersionStatus.DRAFT, latest().status());
        assertEquals(revision, content().stateVersion());
        assertEquals(0L, outbox.countByType("content.version.submitted.v1"));
        assertTrue(content().currentPublishedVersionId().isEmpty());
    }

    @Test
    void activeRightsAloneCannotReplaceVersionBoundPassAndMediaFacts() {
        ContentDefinition content = ContentDefinition.create(
                ContentId.of(CODE), "platform", CODE, ContentKind.COURSE_UNIT,
                "Rights boundary lesson", "en-US", "A1", "PHASE1", "editor-1", Instant.now());
        content.addDraft(ContentVersionId.of(1L), draft(), new ContentRights(
                        "SOURCE-ONE", "LICENSE-ONE", CopyrightStatus.ACTIVE, true,
                        Set.of("LEARNER", "PUBLIC"), null, null, "owner-evidence-1"),
                "editor-1", "draft", Instant.now());
        repository.create(content);

        Map<String, Object> state = data(controller.get(CODE, editor(), HEADERS).getBody());
        assertEquals("VALID", state.get("rightsStatus"));
        assertEquals(false, state.get("reviewSubmissionReady"));
        assertEquals("VALIDATION_REPORT_UNAVAILABLE", state.get("reviewSubmissionReason"));
        ContentOperationException blocked = assertThrows(ContentOperationException.class,
                () -> command("SUBMIT_REVIEW", CODE, null, editor(), "active-rights-alone"));
        assertEquals("CONTENT_REVIEW_EVIDENCE_UNAVAILABLE", blocked.code());
        assertEquals(ContentVersionStatus.DRAFT, latest().status());
        assertEquals(0L, outbox.countByType("content.version.submitted.v1"));
    }

    @Test
    void existingInReviewStillRequiresExplicitDecisionsAndPublicationRights() {
        ContentDefinition content = ContentDefinition.create(
                ContentId.of(CODE), "platform", CODE, ContentKind.COURSE_UNIT,
                "Rights boundary lesson", "en-US", "A1", "PHASE1", "editor-1", Instant.now());
        ContentVersion legacyReview = content.addDraft(ContentVersionId.of(1001L), draft(),
                new ContentRights("SOURCE-ONE", "LICENSE-ONE", CopyrightStatus.PENDING,
                        false, Set.of(), null, null, null),
                "editor-1", "legacy review", Instant.now());
        legacyReview.submitForReview("editor-1");
        repository.create(content);

        assertMissingDecision("REVIEW_FIRST", firstReviewer(), "first-without-decision");
        assertEquals(ContentVersionStatus.IN_REVIEW, latest().status());
        command("REVIEW_FIRST", CODE, null, firstReviewer(), "first-approved", "APPROVED");

        assertMissingDecision("REVIEW_FINAL", finalReviewer(), "final-without-decision");
        assertEquals(ContentVersionStatus.APPROVED, latest().status());
        assertTrue(latest().finalReviewer().isEmpty());
        command("REVIEW_FINAL", CODE, null, finalReviewer(), "final-approved", "APPROVED");

        ContentOperationException blocked = assertThrows(ContentOperationException.class,
                () -> command("PUBLISH", CODE, null, publisher(), "publish-with-pending-rights"));
        assertEquals("CONTENT_RIGHTS_NOT_READY", blocked.code());
        assertTrue(content().currentPublishedVersionId().isEmpty());
    }

    @Test
    void emptyAutoValidationReturnsFindingsAndDoesNotInventRights() {
        Map<String, Object> empty = data(controller.validateAuto(Map.of(), editor(), "validate-empty-1", HEADERS).getBody());
        assertEquals(false, empty.get("passed"));
        assertFinding(empty, "RIGHTS_MISSING");
        assertFinding(empty, "STRUCTURE_INCOMPLETE");

        Map<String, Object> pending = data(controller.validateAuto(
                Map.of("content", draft()), editor(), "validate-draft-1", HEADERS).getBody());
        assertEquals(false, pending.get("passed"));
        assertFinding(pending, "RIGHTS_EVIDENCE_MISSING");
        assertFinding(pending, "RIGHTS_LEARNING_DENIED");
    }

    @Test
    void autoValidationReplaysTheOriginalReportAndRejectsChangedDraftUnderTheSameKey() {
        Map<String, Object> firstBody = Map.of("content", draft());
        Map<String, Object> first = data(controller.validateAuto(
                firstBody, editor(), "validate-replay-1", HEADERS).getBody());
        Map<String, Object> replay = data(controller.validateAuto(
                firstBody, editor(), "validate-replay-1", HEADERS).getBody());
        assertEquals(first, replay);

        Map<String, Object> changed = new LinkedHashMap<>(draft());
        changed.put("title", "different draft");
        ContentOperationException conflict = assertThrows(ContentOperationException.class,
                () -> controller.validateAuto(Map.of("content", changed), editor(),
                        "validate-replay-1", HEADERS));
        assertEquals(409, conflict.status());
        assertEquals("IDEMPOTENCY_KEY_REUSE", conflict.code());

        ContentOperationException missing = assertThrows(ContentOperationException.class,
                () -> controller.validateAuto(firstBody, editor(), null, HEADERS));
        assertEquals(400, missing.status());
        assertEquals("IDEMPOTENCY_KEY_REQUIRED", missing.code());
    }

    @Test
    void batchImportWithoutLicenseFailsWithoutCreatingAPartialDefinition() {
        Map<String, Object> incomplete = draft();
        incomplete.remove("licenseCode");
        Map<String, Object> row = Map.of("contentCode", CODE, "content", incomplete);
        Map<String, Object> result = data(controller.importBatch(
                Map.of("items", List.of(row)), editor(), "batch-missing-rights-1", HEADERS).getBody());
        assertEquals(1L, result.get("failed"));
        assertEquals("CONTENT_FIELD_REQUIRED", ((Map<?, ?>) ((List<?>) result.get("items")).getFirst()).get("errorCode"));
        assertTrue(repository.findByCode(CODE).isEmpty());
    }

    private void assertMissingDecision(String operation, JwtAuthenticationToken actor, String key) {
        ContentOperationException missing = assertThrows(ContentOperationException.class,
                () -> command(operation, CODE, null, actor, key));
        assertEquals(400, missing.status());
        assertEquals("REVIEW_DECISION_REQUIRED", missing.code());
    }

    private static void assertPendingRights(ContentVersion version) {
        ContentRights rights = version.rights().orElseThrow();
        assertEquals(CopyrightStatus.PENDING, rights.status());
        assertFalse(rights.allowsLearning());
        assertEquals(Set.of(), rights.permittedChannels());
        assertNull(rights.authorizationEvidenceRef());
        assertNull(rights.startsAt());
        assertNull(rights.expiresAt());
    }

    private static void assertFinding(Map<String, Object> report, String code) {
        assertTrue(((List<?>) report.get("findings")).stream()
                .map(Map.class::cast).anyMatch(finding -> code.equals(finding.get("code"))), code);
    }

    private ContentDefinition content() {
        return repository.findByCode(CODE).orElseThrow();
    }

    private ContentVersion latest() {
        return content().versions().getLast();
    }

    private void command(String operation, String code, Map<String, Object> draft,
                         JwtAuthenticationToken actor, String key) {
        command(operation, code, draft, actor, key, null);
    }

    private void command(String operation, String code, Map<String, Object> draft,
                         JwtAuthenticationToken actor, String key, String decision) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("command", operation);
        body.put("contentCode", code);
        body.put("expectedStateVersion", repository.findByCode(code)
                .map(ContentDefinition::stateVersion).orElse(0L));
        if (draft != null) body.put("content", draft);
        if (decision != null) body.put("reviewDecision", decision);
        assertEquals(202, controller.command(body, actor, key, HEADERS).getStatusCode().value());
    }

    private static Map<String, Object> draft() {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("contentType", "COURSE_UNIT");
        result.put("title", "Rights boundary lesson");
        result.put("contentLocale", "en-US");
        result.put("targetLevel", "A1");
        result.put("sourceCode", "SOURCE-ONE");
        result.put("licenseCode", "LICENSE-ONE");
        result.put("items", List.of(Map.of("displayText", "Read this sentence.")));
        return result;
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> data(Map<String, Object> envelope) {
        return (Map<String, Object>) envelope.get("data");
    }

    private static JwtAuthenticationToken editor() {
        return actor("editor-1", "content:write");
    }

    private static JwtAuthenticationToken firstReviewer() {
        return actor("reviewer-1", "content:review:first");
    }

    private static JwtAuthenticationToken finalReviewer() {
        return actor("reviewer-2", "content:review:final");
    }

    private static JwtAuthenticationToken publisher() {
        return actor("publisher-1", "content:publish");
    }

    private static JwtAuthenticationToken actor(String subject, String permission) {
        Instant now = Instant.now();
        Jwt jwt = Jwt.withTokenValue("test-only")
                .header("alg", "RS256")
                .subject(subject)
                .issuedAt(now)
                .expiresAt(now.plusSeconds(300))
                .claim("tenant_id", "platform")
                .claim("permissions", List.of(permission))
                .build();
        return new JwtAuthenticationToken(jwt, Set.of(), subject);
    }
}
