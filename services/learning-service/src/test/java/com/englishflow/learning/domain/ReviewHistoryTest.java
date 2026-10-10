package com.englishflow.learning.domain;

import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

class ReviewHistoryTest {
    @Test
    void historyKeepsOnlyFinishedAndDeferredAndARetryDoesNotAddALapse() {
        List<Map<String, Object>> visible = ReviewHistory.onlyVisible(List.of(
                Map.of("disposition", "COMPLETED"),
                Map.of("disposition", "NEW"),
                Map.of("disposition", "DEFERRED")));
        assertEquals(2, visible.size());
        assertEquals(ReviewHistory.NO_RECORD, ReviewHistory.emptyStatus(true, false));
        assertEquals(ReviewHistory.NO_DUE, ReviewHistory.emptyStatus(true, true));
        assertEquals(ReviewHistory.READY, ReviewHistory.emptyStatus(false, true));
        assertEquals("暂无到期复习", ReviewHistory.copy(ReviewHistory.NO_DUE));
        assertEquals("还没有复习记录", ReviewHistory.copy(ReviewHistory.NO_RECORD));
        assertEquals("复习列表暂时没有读出来", ReviewHistory.copy(ReviewHistory.READ_FAILED));
        assertEquals(2, LapseGuard.acceptedLapse(2, 3, false, false));
        assertEquals(2, LapseGuard.acceptedLapse(2, 3, true, true));
        assertEquals(3, LapseGuard.acceptedLapse(2, 3, true, false));
        assertEquals(Sm2Scheduler.ALGORITHM_VERSION, "SM2_Q03_V1");
    }
}
