package com.englishflow.content.domain;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Explicit public/learner field filtering. A deny list is retained as a second guard so a new
 * editor field cannot accidentally become an answer leak; answer rules remain assessment-only.
 */
public final class ContentProjectionPolicy {

    private static final Set<String> PUBLIC_KEYS = Set.of(
            "title", "summary", "prompt", "options", "blocks", "items", "content", "media",
            "metadata", "learningMetadata", "locale", "targetLevel", "goalCode", "unitCode",
            "term", "headword", "definition", "example", "examples", "rule", "explanation",
            "grammarPoint", "sentence", "transcript", "image", "audio", "durationSeconds");

    private static final Set<String> LEARNER_ONLY_KEYS = Set.of("learningMetadata", "practiceMetadata");

    private static final Set<String> RESTRICTED_KEYS = Set.of(
            "answer", "answers", "answerRule", "answerRules", "correctAnswer", "correctAnswers",
            "expectedAnswer", "solution", "solutions", "scoringRule", "scoringRules", "rubric",
            "teacherNotes", "editorNotes", "reviewNotes", "privateNotes", "copyrightEvidence");

    private ContentProjectionPolicy() {
    }

    public static PublicContentProjection project(
            ContentDefinition content,
            ContentVersion version,
            ContentAudience audience,
            ContentChannel channel,
            Instant now,
            boolean allowPreviouslyPublishedPin) {
        if (audience == ContentAudience.ADMIN_PREVIEW) {
            return new PublicContentProjection(
                    content.contentId(), version.versionId(), content.kind(), content.title(), content.locale(),
                    content.targetLevel(), content.goalCode(), audience, version.payload().raw(),
                    version.contentHash(), now);
        }
        if (version.status() != ContentVersionStatus.PUBLISHED
                && !(audience == ContentAudience.LEARNER
                && allowPreviouslyPublishedPin
                && version.wasPublished())) {
            throw ContentOperationException.notFound(
                    "CONTENT_NOT_PUBLISHED", "requested content version is not available to this audience");
        }
        ContentRights rights = version.rights().orElseThrow(() ->
                ContentOperationException.forbidden(
                        "CONTENT_RIGHTS_NOT_READY", "content copyright rights are missing"));
        if (!rights.allows(channel, now)) {
            throw ContentOperationException.forbidden(
                    "CONTENT_RIGHTS_NOT_READY", "content copyright rights do not allow this channel");
        }

        Map<String, Object> fields = sanitize(version.payload().raw(), audience);
        if (ContentPayload.containsAnswerRules(fields)) {
            throw ContentOperationException.forbidden(
                    "ANSWER_RULE_LEAK_BLOCKED", "answer rules cannot be emitted to public or learner projections");
        }
        return new PublicContentProjection(
                content.contentId(), version.versionId(), content.kind(), content.title(), content.locale(),
                content.targetLevel(), content.goalCode(), audience, fields, version.contentHash(), now);
    }

    public static AssessmentContentSnapshot assessmentSnapshot(
            ContentDefinition content,
            ContentVersion version,
            ContentChannel channel,
            Instant now) {
        if (version.status() != ContentVersionStatus.PUBLISHED) {
            throw ContentOperationException.notFound(
                    "CONTENT_NOT_PUBLISHED", "assessment cannot load an unpublished content version");
        }
        ContentRights rights = version.rights().orElseThrow(() ->
                ContentOperationException.forbidden(
                        "CONTENT_RIGHTS_NOT_READY", "content copyright rights are missing"));
        if (!rights.allows(channel, now)) {
            throw ContentOperationException.forbidden(
                    "CONTENT_RIGHTS_NOT_READY", "content copyright rights do not allow assessment");
        }
        Map<String, Object> answerRules = findAnswerRules(version.payload().raw());
        if (answerRules.isEmpty()) {
            throw ContentOperationException.badRequest(
                    "QUESTION_ANSWER_RULE_REQUIRED", "assessment content has no answer rule");
        }
        Map<String, Object> learnerFields = sanitize(version.payload().raw(), ContentAudience.LEARNER);
        return new AssessmentContentSnapshot(
                content.contentId(), version.versionId(), content.kind(), learnerFields, answerRules,
                version.contentHash());
    }

    public static boolean isAnswerRuleKey(String key) {
        if (key == null) {
            return false;
        }
        String normalized = key.trim().toLowerCase(Locale.ROOT);
        return RESTRICTED_KEYS.contains(normalized)
                || normalized.contains("answerrule")
                || normalized.contains("correctanswer")
                || normalized.contains("expectedanswer")
                || normalized.contains("scoringrule");
    }

    private static Map<String, Object> sanitize(Map<String, Object> source, ContentAudience audience) {
        LinkedHashMap<String, Object> result = new LinkedHashMap<>();
        source.forEach((key, value) -> {
            if (isAnswerRuleKey(key)) {
                return;
            }
            if (!PUBLIC_KEYS.contains(key) && !(audience == ContentAudience.LEARNER && LEARNER_ONLY_KEYS.contains(key))) {
                return;
            }
            result.put(key, sanitizeValue(value, audience));
        });
        return Collections.unmodifiableMap(result);
    }

    private static Object sanitizeValue(Object value, ContentAudience audience) {
        if (value instanceof Map<?, ?> map) {
            LinkedHashMap<String, Object> nested = new LinkedHashMap<>();
            map.forEach((key, nestedValue) -> {
                String stringKey = String.valueOf(key);
                if (!isAnswerRuleKey(stringKey)) {
                    nested.put(stringKey, sanitizeValue(nestedValue, audience));
                }
            });
            return Collections.unmodifiableMap(nested);
        }
        if (value instanceof List<?> list) {
            List<Object> sanitized = new ArrayList<>();
            for (Object item : list) {
                sanitized.add(sanitizeValue(item, audience));
            }
            return Collections.unmodifiableList(sanitized);
        }
        return value;
    }

    private static Map<String, Object> findAnswerRules(Map<String, Object> source) {
        for (Map.Entry<String, Object> entry : source.entrySet()) {
            if (isAnswerRuleKey(entry.getKey()) && entry.getValue() instanceof Map<?, ?> map) {
                LinkedHashMap<String, Object> result = new LinkedHashMap<>();
                map.forEach((key, value) -> result.put(String.valueOf(key), value));
                return Collections.unmodifiableMap(result);
            }
        }
        return Map.of();
    }
}
