package com.englishflow.content.domain;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** Answer-leak prevention and audience/channel projection rules for {@link ContentProjectionPolicy}. */
@DisplayName("ContentProjectionPolicy answer-leak and audience rules")
class ContentProjectionPolicyTest {

    private static final Instant NOW = Instant.parse("2026-08-22T00:00:00Z");

    private static ContentRights publishableRights(Set<String> channels) {
        return new ContentRights("src", "lic", CopyrightStatus.ACTIVE, true,
                channels, NOW.minusSeconds(60), null, "evidence-1");
    }

    private static ContentVersion publishedVersion(ContentRights rights, Map<String, Object> fields, ContentVersionStatus status) {
        String hash = ContentPayloadHash.sha256(fields);
        return ContentVersion.rehydrate(
                ContentVersionId.of(1L), 1, ContentKind.VOCABULARY, fields, hash,
                rights, "editor-1", "note", NOW, status, null, null, null,
                status == ContentVersionStatus.PUBLISHED ? NOW : null, null, null, 0, 0, 1L);
    }

    private static ContentDefinition definitionWith(ContentVersion version) {
        boolean published = version.status() == ContentVersionStatus.PUBLISHED;
        return ContentDefinition.rehydrate(
                ContentId.of("cnt_proj_1"), "platform", "vocab-proj-1", ContentKind.VOCABULARY,
                "Title", "en-US", "A1", "ONB", "editor-1", NOW,
                List.of(version), published ? version.versionId() : null, 1L, 1L);
    }

    @Test
    @DisplayName("public projection strips restricted answer-rule keys")
    void publicProjectionStripsAnswerRules() {
        Map<String, Object> fields = Map.of(
                "term", "cat", "definition", "猫",
                "answerRule", Map.of("correctOption", "A"));
        ContentVersion version = publishedVersion(
                publishableRights(Set.of("PUBLIC", "LEARNER")), fields, ContentVersionStatus.PUBLISHED);
        ContentDefinition content = definitionWith(version);

        PublicContentProjection projection = ContentProjectionPolicy.project(
                content, version, ContentAudience.PUBLIC, ContentChannel.PUBLIC, NOW, false);
        assertFalse(projection.fields().containsKey("answerRule"));
        assertTrue(projection.fields().containsKey("term"));
    }

    @Test
    @DisplayName("nested answer rules inside options are also stripped")
    void nestedAnswerRulesStripped() {
        Map<String, Object> fields = Map.of(
                "prompt", "choose",
                "options", List.of(
                        Map.of("label", "A"),
                        Map.of("correct", true, "answerRule", Map.of("correctOption", "A"))));
        ContentVersion version = publishedVersion(
                publishableRights(Set.of("PUBLIC")), fields, ContentVersionStatus.PUBLISHED);
        ContentDefinition content = definitionWith(version);

        PublicContentProjection projection = ContentProjectionPolicy.project(
                content, version, ContentAudience.PUBLIC, ContentChannel.PUBLIC, NOW, false);
        assertFalse(projection.containsAnswerRules());
        List<?> options = (List<?>) projection.fields().get("options");
        assertEquals(2, options.size());
        for (Object option : options) {
            assertFalse(((Map<?, ?>) option).containsKey("answerRule"));
        }
    }

    @Test
    @DisplayName("admin preview returns the raw payload including answer rules")
    void adminPreviewReturnsRawPayload() {
        Map<String, Object> fields = Map.of(
                "term", "cat", "answerRule", Map.of("correctOption", "A"));
        ContentVersion version = publishedVersion(
                publishableRights(Set.of("PUBLIC")), fields, ContentVersionStatus.PUBLISHED);
        ContentDefinition content = definitionWith(version);

        PublicContentProjection projection = ContentProjectionPolicy.project(
                content, version, ContentAudience.ADMIN_PREVIEW, ContentChannel.ADMIN, NOW, false);
        assertTrue(projection.fields().containsKey("answerRule"));
    }

    @Test
    @DisplayName("unpublished versions are not available to public readers")
    void unpublishedNotAvailable() {
        ContentVersion version = publishedVersion(
                publishableRights(Set.of("PUBLIC")), Map.of("term", "cat"), ContentVersionStatus.DRAFT);
        ContentDefinition content = definitionWith(version);

        ContentOperationException ex = assertThrows(ContentOperationException.class,
                () -> ContentProjectionPolicy.project(
                        content, version, ContentAudience.PUBLIC, ContentChannel.PUBLIC, NOW, false));
        assertEquals("CONTENT_NOT_PUBLISHED", ex.code());
    }

    @Test
    @DisplayName("missing rights block projection")
    void missingRightsBlockProjection() {
        ContentVersion version = publishedVersion(null, Map.of("term", "cat"), ContentVersionStatus.PUBLISHED);
        ContentDefinition content = definitionWith(version);

        ContentOperationException ex = assertThrows(ContentOperationException.class,
                () -> ContentProjectionPolicy.project(
                        content, version, ContentAudience.PUBLIC, ContentChannel.PUBLIC, NOW, false));
        assertEquals("CONTENT_RIGHTS_NOT_READY", ex.code());
    }

    @Test
    @DisplayName("rights that do not allow the channel block projection")
    void channelNotAllowedBlocksProjection() {
        ContentVersion version = publishedVersion(
                publishableRights(Set.of("LEARNER")), Map.of("term", "cat"), ContentVersionStatus.PUBLISHED);
        ContentDefinition content = definitionWith(version);

        ContentOperationException ex = assertThrows(ContentOperationException.class,
                () -> ContentProjectionPolicy.project(
                        content, version, ContentAudience.PUBLIC, ContentChannel.PUBLIC, NOW, false));
        assertEquals("CONTENT_RIGHTS_NOT_READY", ex.code());
    }

    @Test
    @DisplayName("assessment snapshot returns answer rules for a published question")
    void assessmentSnapshotReturnsAnswerRules() {
        Map<String, Object> fields = Map.of(
                "prompt", "choose", "options", List.of("A", "B"),
                "answerRule", Map.of("correctOption", "A"));
        ContentVersion version = publishedVersion(
                publishableRights(Set.of("ASSESSMENT", "PUBLIC")), fields, ContentVersionStatus.PUBLISHED);
        ContentDefinition content = definitionWith(version);

        AssessmentContentSnapshot snapshot = ContentProjectionPolicy.assessmentSnapshot(
                content, version, ContentChannel.ASSESSMENT, NOW);
        assertTrue(snapshot.answerRules().containsKey("correctOption"));
        assertFalse(snapshot.learnerFields().containsKey("answerRule"));
    }

    @Test
    @DisplayName("assessment snapshot rejects content with no answer rule")
    void assessmentSnapshotRequiresAnswerRule() {
        ContentVersion version = publishedVersion(
                publishableRights(Set.of("ASSESSMENT")), Map.of("prompt", "choose"), ContentVersionStatus.PUBLISHED);
        ContentDefinition content = definitionWith(version);

        ContentOperationException ex = assertThrows(ContentOperationException.class,
                () -> ContentProjectionPolicy.assessmentSnapshot(content, version, ContentChannel.ASSESSMENT, NOW));
        assertEquals("QUESTION_ANSWER_RULE_REQUIRED", ex.code());
    }

    @Test
    @DisplayName("isAnswerRuleKey detects known keys and case-insensitive substrings")
    void isAnswerRuleKeyDetectsVariants() {
        assertTrue(ContentProjectionPolicy.isAnswerRuleKey("answerRule"));
        assertTrue(ContentProjectionPolicy.isAnswerRuleKey("AnswerRule"));
        assertTrue(ContentProjectionPolicy.isAnswerRuleKey("myanswerrulefield"));
        assertTrue(ContentProjectionPolicy.isAnswerRuleKey("correctAnswer"));
        assertTrue(ContentProjectionPolicy.isAnswerRuleKey("scoringRule"));
        assertFalse(ContentProjectionPolicy.isAnswerRuleKey("title"));
        assertFalse(ContentProjectionPolicy.isAnswerRuleKey("options"));
        assertFalse(ContentProjectionPolicy.isAnswerRuleKey(null));
    }

    @Test
    @DisplayName("answer rule leak is blocked even on a poisoned projection path")
    void assessmentLeakBlockedForAnswerRulesKey() {
        // A key containing the substring but not in the explicit list must still be detected.
        Map<String, Object> fields = Map.of("prompt", "x", "expectedAnswer", Map.of("value", "A"));
        ContentVersion version = publishedVersion(
                publishableRights(Set.of("PUBLIC")), fields, ContentVersionStatus.PUBLISHED);
        ContentDefinition content = definitionWith(version);

        PublicContentProjection projection = ContentProjectionPolicy.project(
                content, version, ContentAudience.PUBLIC, ContentChannel.PUBLIC, NOW, false);
        assertFalse(projection.fields().containsKey("expectedAnswer"));
        assertEquals(null, projection.fields().get("expectedAnswer"));
    }
}
