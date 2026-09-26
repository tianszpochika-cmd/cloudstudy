package com.englishflow.assessment.port;

import com.englishflow.assessment.domain.ContentSnapshot;
import com.englishflow.assessment.domain.P1PlacementScorer;
import com.englishflow.assessment.domain.QuestionType;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class P1PlacementSourcePortTest {
    private static final String RULE = "P1_PLACEMENT_V1";

    @Test
    void acceptsOnlyTheAuthorizedTenItemFourDimensionPinSet() {
        P1PlacementSourcePort.Resolved source = valid();
        assertEquals(10, source.items().size());
        assertEquals(22L, source.contentPin().get("contentVersionId"));

        assertThrows(IllegalArgumentException.class, () -> resolved(source.items().subList(0, 9),
                source.contentPin(), source.answerRulePin()));
        assertThrows(IllegalArgumentException.class, () -> resolved(source.items(),
                Map.of("contentVersionId", 23L, "contentEpoch", 0L,
                        "snapshotId", "snap_placement01", "snapshotHash", "a".repeat(64)),
                source.answerRulePin()));
        assertThrows(IllegalArgumentException.class, () -> resolved(source.items(), source.contentPin(),
                Map.of("answerRuleSetVersion", "set-v1", "answerRuleVersion", "wrong-rule",
                        "ruleDigest", "b".repeat(64), "completionRuleVersion", RULE)));
        assertThrows(IllegalArgumentException.class, () -> resolved(source.items(), source.contentPin(),
                Map.of("answerRuleSetVersion", "set-v1", "answerRuleVersion", "rule-v1",
                        "ruleDigest", "b".repeat(64), "completionRuleVersion", "legacy-rule")));
    }

    @Test
    void rejectsUnsafeOrMismatchedLearnerItemBeforeStorage() {
        ContentSnapshot snapshot = snapshot(1);
        assertThrows(IllegalArgumentException.class, () -> new P1PlacementSourcePort.SealedItem(
                1, P1PlacementScorer.Dimension.VOCABULARY,
                Map.of("itemId", 1L, "itemCode", "p1.item.1", "itemType", "VOCABULARY",
                        "stem", "Select the answer", "answerKey", "a"), snapshot));
        assertThrows(IllegalArgumentException.class, () -> new P1PlacementSourcePort.SealedItem(
                1, P1PlacementScorer.Dimension.VOCABULARY,
                Map.of("itemId", 2L, "itemCode", "p1.item.1", "itemType", "VOCABULARY",
                        "stem", "Select the answer"), snapshot));
        assertThrows(IllegalArgumentException.class, () -> new P1PlacementSourcePort.SealedItem(
                1, P1PlacementScorer.Dimension.VOCABULARY,
                Map.of("itemId", 1L, "itemCode", "p1.item.1", "itemType", "READING",
                        "stem", "Select the answer"), snapshot));
    }

    private static P1PlacementSourcePort.Resolved valid() {
        List<P1PlacementSourcePort.SealedItem> items = new ArrayList<>();
        for (int i = 1; i <= 10; i++) {
            P1PlacementScorer.Dimension dimension = i <= 3 ? P1PlacementScorer.Dimension.VOCABULARY
                    : i <= 6 ? P1PlacementScorer.Dimension.BASIC_GRAMMAR
                    : i <= 8 ? P1PlacementScorer.Dimension.READING : P1PlacementScorer.Dimension.LISTENING;
            String itemType = switch (dimension) {
                case VOCABULARY -> "VOCABULARY";
                case BASIC_GRAMMAR -> "GRAMMAR";
                case READING -> "READING";
                case LISTENING -> "LISTENING";
            };
            items.add(new P1PlacementSourcePort.SealedItem(i, dimension,
                    Map.of("itemId", (long) i, "itemCode", "p1.item." + i,
                            "itemType", itemType, "stem", "Select the answer"), snapshot(i)));
        }
        return resolved(items,
                Map.of("contentVersionId", 22L, "contentEpoch", 0L,
                        "snapshotId", "snap_placement01", "snapshotHash", "a".repeat(64)),
                Map.of("answerRuleSetVersion", "set-v1", "answerRuleVersion", "rule-v1",
                        "ruleDigest", "b".repeat(64), "completionRuleVersion", RULE));
    }

    private static P1PlacementSourcePort.Resolved resolved(List<P1PlacementSourcePort.SealedItem> items,
            Map<String, Object> contentPin, Map<String, Object> rulePin) {
        return new P1PlacementSourcePort.Resolved(
                Map.of("targetId", 7L, "targetVersion", 2L, "targetSnapshotDigest", "c".repeat(64)),
                contentPin, rulePin, items, true, true, true, true, true);
    }

    private static ContentSnapshot snapshot(int id) {
        return new ContentSnapshot("p1.placement", 22L, id, id, QuestionType.CHOICE,
                Map.of("stem", "Select the answer"), Map.of("correctOptionKeys", List.of("a")),
                "rule-v1", 1, true);
    }
}
