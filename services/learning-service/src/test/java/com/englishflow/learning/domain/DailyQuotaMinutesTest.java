package com.englishflow.learning.domain;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Phase 1 frozen daily study quota: only 5/15/30/45 are legal. */
class DailyQuotaMinutesTest {

    @Test
    void allowedQuotaValuesAreAccepted() {
        assertThat(DailyQuotaMinutes.require(5)).isEqualTo(5);
        assertThat(DailyQuotaMinutes.require(15)).isEqualTo(15);
        assertThat(DailyQuotaMinutes.require(30)).isEqualTo(30);
        assertThat(DailyQuotaMinutes.require(45)).isEqualTo(45);
    }

    @Test
    void retiredAndUnsupportedQuotaValuesAreRejected() {
        for (int illegal : new int[]{0, 1, 10, 20, 60, 90, 100}) {
            assertThatThrownBy(() -> DailyQuotaMinutes.require(illegal))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("5, 15, 30, or 45");
        }
    }
}
