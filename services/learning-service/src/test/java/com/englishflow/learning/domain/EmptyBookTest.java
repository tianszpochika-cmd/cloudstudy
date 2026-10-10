package com.englishflow.learning.domain;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

class EmptyBookTest {
    @Test
    void emptyBookSeparatesNoPracticeFromAllCorrectAndKeepsOneRemediation() {
        assertEquals(EmptyBook.NOT_PRACTICED, EmptyBook.status(0, 0));
        assertEquals(EmptyBook.NOT_PRACTICED_COPY, EmptyBook.copy(EmptyBook.NOT_PRACTICED));
        assertEquals(EmptyBook.ALL_CORRECT, EmptyBook.status(3, 0));
        assertEquals(EmptyBook.ALL_CORRECT_COPY, EmptyBook.copy(EmptyBook.ALL_CORRECT));
        assertEquals(EmptyBook.HAS_ITEMS, EmptyBook.status(3, 1));
        assertEquals(EmptyBook.READ_FAILED_COPY, EmptyBook.copy(EmptyBook.READ_FAILED));
        assertEquals(EmptyBook.PROJECTION, EmptyBook.projection(0, 0).get("projectionVersion"));
        long first = EmptyBook.remediationId("prn_learner00000001", "m-1");
        long second = EmptyBook.remediationId("prn_learner00000001", "m-1");
        assertEquals(first, second);
    }
}
