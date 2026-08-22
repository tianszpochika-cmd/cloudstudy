package com.englishflow.learning.domain;

public enum LearningItemType {
    VOCAB,
    PHRASE,
    EXPRESSION,
    GRAMMAR,
    SENTENCE,
    READING,
    WRITING,
    EXERCISE;

    public boolean srsEligible() {
        return this == VOCAB || this == PHRASE || this == EXPRESSION;
    }
}
