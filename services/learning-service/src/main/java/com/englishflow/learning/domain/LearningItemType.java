package com.englishflow.learning.domain;

import java.util.Set;

public enum LearningItemType {
    VOCAB,
    PHRASE,
    EXPRESSION,
    GRAMMAR,
    SENTENCE,
    READING,
    WRITING,
    EXERCISE;

    /**
     * B4 SRS eligibility set (was a hardcoded three-type check). SENTENCE is
     * eligible so French sentence rows (dictation/shadowing sources) can enter
     * SRS; the three historical types are unchanged.
     */
    private static final Set<LearningItemType> SRS_ELIGIBLE = Set.of(VOCAB, PHRASE, EXPRESSION, SENTENCE);

    public boolean srsEligible() {
        return SRS_ELIGIBLE.contains(this);
    }
}
