package com.englishflow.learner.domain;

/**
 * Phase 1 adult learning goals; K12/child goals are intentionally absent.
 *
 * <p>{@code CET_4_6} is the historical English-exam goal and stays readable and
 * writable for existing rows. {@code LANGUAGE_CERT} (B4) is the converged
 * language-exam goal: the exam name and exam language travel in the goal
 * fields ({@code examName}, {@code language}), not in new enum values per exam.</p>
 */
public enum GoalType {
    FOUNDATION,
    CET_4_6,
    POSTGRADUATE,
    WORKPLACE,
    LANGUAGE_CERT
}
