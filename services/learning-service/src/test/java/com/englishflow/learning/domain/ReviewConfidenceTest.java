package com.englishflow.learning.domain;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/** Client-reported confidence caps the raw review quality before scoring. */
class ReviewConfidenceTest {

    @Test
    void certainNeverCaps() {
        assertThat(ReviewConfidence.CERTAIN.capQuality(3)).isEqualTo(3);
        assertThat(ReviewConfidence.CERTAIN.capQuality(0)).isEqualTo(0);
    }

    @Test
    void fuzzyCapsAtThree() {
        assertThat(ReviewConfidence.FUZZY.capQuality(3)).isEqualTo(3);
        assertThat(ReviewConfidence.FUZZY.capQuality(5)).isEqualTo(3); // quality is externally bounded to 0..3
        assertThat(ReviewConfidence.FUZZY.capQuality(2)).isEqualTo(2);
    }

    @Test
    void guessedCapsAtTwo() {
        assertThat(ReviewConfidence.GUESSED.capQuality(3)).isEqualTo(2);
        assertThat(ReviewConfidence.GUESSED.capQuality(2)).isEqualTo(2);
        assertThat(ReviewConfidence.GUESSED.capQuality(1)).isEqualTo(1);
        assertThat(ReviewConfidence.GUESSED.capQuality(0)).isEqualTo(0);
    }

    @Test
    void unknownCapsAtOne() {
        assertThat(ReviewConfidence.UNKNOWN.capQuality(3)).isEqualTo(1);
        assertThat(ReviewConfidence.UNKNOWN.capQuality(2)).isEqualTo(1);
        assertThat(ReviewConfidence.UNKNOWN.capQuality(0)).isEqualTo(0);
    }
}
