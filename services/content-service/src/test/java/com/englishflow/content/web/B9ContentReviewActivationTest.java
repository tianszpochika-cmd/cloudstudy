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
import com.englishflow.content.domain.ContentOperationException;
import com.englishflow.content.domain.ContentVersion;
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
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;

/**
 * Submission gate: attested dossier + bound PASS report + clean media submit;
 * L2 final APPROVED auto-activates PENDING rights; publish requires ACTIVE.
 */
class B9ContentReviewActivationTest {

    private static final String CODE = "review-activation-pack";
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
    void attestedDraftValidatesSubmitsDualReviewsAutoActivatesAndPublishes() {
        command("CREATE_DRAFT", CODE, attestedDraft(), editor(), "chain-create-1");
        assertPending(latest());

        Map<String, Object> validated = commandResult(
                "VALIDATE_DRAFT", CODE, null, editor(), "chain-validate-1");
        assertEquals(true, ((Map<?, ?>) validated.get("validationReport")).get("passed"));
        assertTrue(((String) ((Map<?, ?>) validated.get("validationReport")).get("reportId"))
                .startsWith("vr_"));

        Map<String, Object> state = data(controller.get(CODE, editor(), HEADERS).getBody());
        assertEquals(true, state.get("reviewSubmissionReady"));
        assertEquals("READY", state.get("reviewSubmissionReason"));

        command("SUBMIT_REVIEW", CODE, null, editor(), "chain-submit-1");
        assertEquals(ContentVersionStatus.IN_REVIEW, latest().status());

        command("REVIEW_FIRST", CODE, null, firstReviewer(), "chain-first-1", "APPROVED");
        assertEquals(ContentVersionStatus.APPROVED, latest().status());
        assertPending(latest());

        command("REVIEW_FINAL", CODE, null, finalReviewer(), "chain-final-1", "APPROVED");
        assertEquals(CopyrightStatus.ACTIVE, latest().rights().orElseThrow().status());
        assertTrue(latest().rights().orElseThrow()
                .allows(com.englishflow.content.domain.ContentChannel.LEARNER, Instant.now()));

        command("PUBLISH", CODE, null, publisher(), "chain-publish-1");
        assertEquals(ContentVersionStatus.PUBLISHED, latest().status());
        assertTrue(content().currentPublishedVersionId().isPresent());
        assertEquals(1L, outbox.countByType("content.version.published.v1"));
    }

    @Test
    void finalApprovalWithoutBoundReportLeavesPendingAndPublishFailsClosed() {
        command("CREATE_DRAFT", CODE, attestedDraft(), editor(), "noreport-create-1");
        // Submit path bypassed on purpose is impossible here: submit requires
        // the report. Drive the domain directly to prove activation needs it.
        ContentDefinition content = content();
        ContentVersion version = latest();
        version.submitForReview("editor-1");
        version.review(com.englishflow.content.domain.ReviewStage.FIRST_REVIEW,
                com.englishflow.content.domain.ReviewDecision.APPROVED, "reviewer-1", Instant.now());
        ContentCommandService direct = service();
        direct.review(new ContentCommandService.ReviewCommand(content.contentId(), version.versionId(),
                com.englishflow.content.domain.ReviewStage.FINAL_REVIEW,
                com.englishflow.content.domain.ReviewDecision.APPROVED, "B31_REVIEW", ""),
                finalReviewerActor(), key("noreport-final-1"),
                new com.englishflow.content.domain.ContentRequestContext("req-noreport-1", "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"));
        assertPending(latest());

        ContentOperationException blocked = assertThrows(ContentOperationException.class,
                () -> command("PUBLISH", CODE, null, publisher(), "noreport-publish-1"));
        assertEquals("CONTENT_RIGHTS_NOT_READY", blocked.code());
        assertTrue(content().currentPublishedVersionId().isEmpty());
    }

    @Test
    void incompleteDossierStaysPendingThroughFinalApproval() {
        command("CREATE_DRAFT", CODE, draft(), editor(), "incomplete-create-1");
        ContentDefinition content = content();
        ContentVersion version = latest();
        version.submitForReview("editor-1");
        version.review(com.englishflow.content.domain.ReviewStage.FIRST_REVIEW,
                com.englishflow.content.domain.ReviewDecision.APPROVED, "reviewer-1", Instant.now());
        ContentCommandService direct = service();
        direct.review(new ContentCommandService.ReviewCommand(content.contentId(), version.versionId(),
                com.englishflow.content.domain.ReviewStage.FINAL_REVIEW,
                com.englishflow.content.domain.ReviewDecision.APPROVED, "B31_REVIEW", ""),
                finalReviewerActor(), key("incomplete-final-1"),
                new com.englishflow.content.domain.ContentRequestContext("req-incomplete-1", "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"));
        assertPending(latest());
    }

    private void assertPending(ContentVersion version) {
        assertEquals(CopyrightStatus.PENDING, version.rights().orElseThrow().status());
    }

    private ContentCommandService service() {
        return new ContentCommandService(repository, outbox, new InMemoryContentIdempotency(),
                new InMemoryPublicProjectionStore(), new RecordingContentCacheInvalidator(),
                reports, Clock.systemUTC());
    }

    private com.englishflow.content.domain.ContentActor finalReviewerActor() {
        return new com.englishflow.content.domain.ContentActor("reviewer-2", "platform",
                Set.of("review-l2"), Set.of("content:review:final"), false);
    }

    private com.englishflow.content.domain.ContentIdempotencyKey key(String value) {
        return new com.englishflow.content.domain.ContentIdempotencyKey(value + "-idempotency");
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
        if (draft != null) {
            body.put("content", draft);
        }
        if (decision != null) {
            body.put("reviewDecision", decision);
        }
        assertEquals(202, controller.command(body, actor, key, HEADERS).getStatusCode().value());
    }

    private Map<String, Object> commandResult(String operation, String code, Map<String, Object> draft,
            JwtAuthenticationToken actor, String key) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("command", operation);
        body.put("contentCode", code);
        body.put("expectedStateVersion", repository.findByCode(code)
                .map(ContentDefinition::stateVersion).orElse(0L));
        if (draft != null) {
            body.put("content", draft);
        }
        Object raw = controller.command(body, actor, key, HEADERS).getBody();
        return data((Map<String, Object>) raw);
    }

    private static Map<String, Object> attestedDraft() {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("contentType", "COURSE_UNIT");
        result.put("title", "Activation chain lesson");
        result.put("contentLocale", "en-US");
        result.put("targetLevel", "A1");
        result.put("sourceCode", "SOURCE-CHAIN");
        result.put("licenseCode", "LICENSE-CHAIN");
        result.put("permittedChannels", List.of("LEARNER", "PUBLIC"));
        result.put("authorizationEvidenceRef", "evidence-chain-1");
        result.put("allowsLearning", true);
        result.put("items", List.of(Map.of("displayText", "Read this sentence.")));
        return result;
    }

    private static Map<String, Object> draft() {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("contentType", "COURSE_UNIT");
        result.put("title", "Incomplete dossier lesson");
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
