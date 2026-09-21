package com.englishflow.assessment.domain;

/**
 * Phase 1 scorable interaction types. DICTATION (listening dictation) is
 * rule-scored like typed input; SHADOWING (speaking shadowing) cannot be
 * rule-scored in Phase 1 and resolves to pending manual review.
 */
public enum QuestionType {
    CHOICE,
    CONNECT_LINE,
    DRAG_SORTER,
    FILL_BLANK,
    SPELL_INPUT,
    LISTEN_CHOICE,
    ERROR_CORRECTION,
    TRANSLATION_INPUT,
    DICTATION,
    SHADOWING
}
