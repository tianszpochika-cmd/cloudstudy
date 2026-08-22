package com.englishflow.gamification.domain;

import java.util.Map;

/** Versioned, allowlisted completion-to-reward policy owned by this service. */
public final class CompletionRuleCatalog {

    private final Map<String, CompletionRule> rules = Map.ofEntries(
            Map.entry("learning.task.completed.v1", new CompletionRule("learning.task.completed.v1", 15, 1, 8, "LEARNING_REWARD_BOX")),
            Map.entry("learning.lesson.completed.v1", new CompletionRule("learning.lesson.completed.v1", 20, 1, 10, "LEARNING_REWARD_BOX")),
            Map.entry("learning.review.completed.v1", new CompletionRule("learning.review.completed.v1", 15, 1, 8, "LEARNING_REWARD_BOX")),
            Map.entry("learning.reading.completed.v1", new CompletionRule("learning.reading.completed.v1", 20, 1, 10, "LEARNING_REWARD_BOX")),
            Map.entry("learning.listening.completed.v1", new CompletionRule("learning.listening.completed.v1", 20, 1, 10, "LEARNING_REWARD_BOX")),
            Map.entry("learning.writing.completed.v1", new CompletionRule("learning.writing.completed.v1", 25, 2, 12, "LEARNING_REWARD_BOX")),
            Map.entry("learning.daily_goal.reached.v1", new CompletionRule("learning.daily_goal.reached.v1", 50, 20, 25, "LEARNING_REWARD_BOX")),
            Map.entry("assessment.practice.completed.v1", new CompletionRule("assessment.practice.completed.v1", 30, 3, 20, "ASSESSMENT_REWARD_BOX")),
            Map.entry("assessment.attempt.completed.v1", new CompletionRule("assessment.attempt.completed.v1", 40, 5, 25, "ASSESSMENT_REWARD_BOX")),
            Map.entry("assessment.attempt.assessed.v1", new CompletionRule("assessment.attempt.assessed.v1", 40, 5, 25, "ASSESSMENT_REWARD_BOX")),
            Map.entry("assessment.checkpoint.completed.v1", new CompletionRule("assessment.checkpoint.completed.v1", 60, 10, 40, "ASSESSMENT_REWARD_BOX")),
            Map.entry("assessment.checkpoint.passed.v1", new CompletionRule("assessment.checkpoint.passed.v1", 60, 10, 40, "ASSESSMENT_REWARD_BOX")),
            Map.entry("grammar.practice.completed.v1", new CompletionRule("grammar.practice.completed.v1", 30, 3, 20, "ASSESSMENT_REWARD_BOX")),
            Map.entry("writing.evaluation.completed.v1", new CompletionRule("writing.evaluation.completed.v1", 25, 2, 12, "LEARNING_REWARD_BOX")));

    public CompletionRule forEvent(TrustedCompletionEvent event) {
        CompletionRule rule = rules.get(event.eventType());
        if (rule == null) {
            throw GamificationDomainException.invalidEvent("completion event is not supported");
        }
        return rule;
    }
}
