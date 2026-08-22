package com.englishflow.content.domain;

import java.time.Instant;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Public/learner read model. The projection is deliberately not the content fact and never
 * contains answer rules, reviewer identity, private notes or write capabilities.
 */
public record PublicContentProjection(
        ContentId contentId,
        ContentVersionId versionId,
        ContentKind kind,
        String title,
        String locale,
        String targetLevel,
        String goalCode,
        ContentAudience audience,
        Map<String, Object> fields,
        String contentHash,
        Instant generatedAt) {

    public PublicContentProjection {
        fields = immutableMap(fields);
    }

    public boolean containsAnswerRules() {
        return ContentPayload.containsAnswerRules(fields);
    }

    private static Map<String, Object> immutableMap(Map<String, Object> source) {
        if (source == null) {
            return Map.of();
        }
        return Collections.unmodifiableMap(new LinkedHashMap<>(source));
    }
}
