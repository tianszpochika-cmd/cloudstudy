package com.englishflow.gamification.application;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

import com.englishflow.gamification.domain.GamificationException;
import com.englishflow.gamification.domain.RewardRule;
import com.englishflow.gamification.domain.TrustedCompletionEvent;

/** Allowlist for completion facts. Unknown learning events never create GAM side effects. */
public final class EventPolicy {

    public static final String LEARNING_SERVICE = "learning-service";
    public static final String ASSESSMENT_SERVICE = "assessment-service";
    public static final Set<String> ALLOWED_SOURCE_SERVICES = Set.of(LEARNING_SERVICE, ASSESSMENT_SERVICE);

    private static final Pattern SCHEMA_V1 = Pattern.compile("^(?:v)?1(?:\\.0){0,2}$");
    private final String seasonId;
    private final Map<String, RewardRule> rules;
    private final Map<String, String> sourceByEventType;

    public EventPolicy(String seasonId) {
        if (seasonId == null || seasonId.isBlank()) {
            throw new IllegalArgumentException("seasonId is required");
        }
        this.seasonId = seasonId;
        Map<String, RewardRule> ruleMap = new LinkedHashMap<>();
        Map<String, String> sourceMap = new LinkedHashMap<>();
        add(ruleMap, sourceMap, LEARNING_SERVICE, "learning.task.completed.v1", "LEARNING_TASK_COMPLETED", 20, 1, 10);
        add(ruleMap, sourceMap, LEARNING_SERVICE, "learning.lesson.completed.v1", "LESSON_COMPLETED", 20, 1, 10);
        add(ruleMap, sourceMap, LEARNING_SERVICE, "learning.review.completed.v1", "REVIEW_COMPLETED", 15, 1, 8);
        add(ruleMap, sourceMap, LEARNING_SERVICE, "learning.reading.completed.v1", "READING_COMPLETED", 20, 1, 10);
        add(ruleMap, sourceMap, LEARNING_SERVICE, "learning.listening.completed.v1", "LISTENING_COMPLETED", 20, 1, 10);
        add(ruleMap, sourceMap, LEARNING_SERVICE, "learning.writing.completed.v1", "WRITING_COMPLETED", 25, 2, 12);
        add(ruleMap, sourceMap, LEARNING_SERVICE, "learning.daily_goal.reached.v1", "DAILY_GOAL_REACHED", 50, 20, 25);
        add(ruleMap, sourceMap, ASSESSMENT_SERVICE, "assessment.attempt.completed.v1", "ASSESSMENT_COMPLETED", 80, 8, 20);
        add(ruleMap, sourceMap, ASSESSMENT_SERVICE, "assessment.attempt.assessed.v1", "ASSESSMENT_COMPLETED", 80, 8, 20);
        add(ruleMap, sourceMap, ASSESSMENT_SERVICE, "assessment.checkpoint.passed.v1", "CHECKPOINT_PASSED", 200, 30, 50);

        // B4 source names remain accepted only as explicit internal aliases, never as public input.
        add(ruleMap, sourceMap, LEARNING_SERVICE, "LESSON_COMPLETE", "LESSON_COMPLETED", 20, 1, 10);
        add(ruleMap, sourceMap, LEARNING_SERVICE, "REVIEW_BATCH_COMPLETE", "REVIEW_COMPLETED", 15, 1, 8);
        add(ruleMap, sourceMap, ASSESSMENT_SERVICE, "CHECKPOINT_PASS", "CHECKPOINT_PASSED", 200, 30, 50);
        rules = Map.copyOf(ruleMap);
        sourceByEventType = Map.copyOf(sourceMap);
    }

    public RewardRule validateAndResolve(TrustedCompletionEvent event) {
        if (!ALLOWED_SOURCE_SERVICES.contains(event.sourceService())) {
            throw GamificationException.badRequest("EVENT_SOURCE_NOT_ALLOWED", "sourceService is not allowlisted");
        }
        if (!SCHEMA_V1.matcher(event.schemaVersion()).matches()) {
            throw GamificationException.badRequest("EVENT_SCHEMA_UNSUPPORTED", "only schema version 1 is accepted");
        }
        if (!event.eventType().endsWith(".v1") && !rules.containsKey(event.eventType())) {
            throw GamificationException.badRequest("EVENT_TYPE_NOT_ALLOWED", "event type is not an eligible completion");
        }
        String expectedSource = sourceByEventType.get(event.eventType());
        if (expectedSource == null || !expectedSource.equals(event.sourceService())) {
            throw GamificationException.badRequest("EVENT_TYPE_NOT_ALLOWED", "event type/source pair is not allowlisted");
        }
        if (event.occurredAt().isAfter(Instant.now().plusSeconds(300))) {
            throw GamificationException.badRequest("EVENT_TIME_INVALID", "occurredAt cannot be materially in the future");
        }
        return rules.get(event.eventType());
    }

    public String seasonId() {
        return seasonId;
    }

    public boolean isAllowedSource(String sourceService) {
        return ALLOWED_SOURCE_SERVICES.contains(sourceService);
    }

    private static void add(
            Map<String, RewardRule> rules,
            Map<String, String> sourceByEventType,
            String sourceService,
            String eventType,
            String reasonCode,
            long xp,
            long coins,
            long seasonPoints) {
        rules.put(eventType, new RewardRule(reasonCode, xp, coins, seasonPoints, true));
        sourceByEventType.put(eventType, sourceService);
    }
}
