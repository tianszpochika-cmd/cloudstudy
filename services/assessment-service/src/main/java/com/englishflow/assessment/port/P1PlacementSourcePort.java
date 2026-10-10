package com.englishflow.assessment.port;

import com.englishflow.assessment.domain.ContentSnapshot;
import com.englishflow.assessment.domain.P1PlacementScorer;
import com.englishflow.assessment.domain.SafePayloads;
import com.englishflow.assessment.domain.QuestionType;
import com.englishflow.assessment.web.AssessmentHttpPrincipals.VerifiedAssessmentPrincipal;

import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.math.BigDecimal;

/**
 * Read-only owner boundary. A real adapter must get an active target from
 * learner-service and one published, rights-checked, sealed ten-item snapshot
 * from content-service. Assessment never invents pins or question masters.
 */
public interface P1PlacementSourcePort {
    Resolved resolve(VerifiedAssessmentPrincipal principal);

    record SealedItem(long itemId, P1PlacementScorer.Dimension dimension,
                      Map<String, Object> learnerItem, ContentSnapshot scoringSnapshot) {
        public SealedItem {
            // A null scoring snapshot means the sealed bank did not ship answer
            // rules. Opening still accepts the item. R1-021 owns scoring.
            if (itemId < 1 || dimension == null
                    || scoringSnapshot != null && scoringSnapshot.itemId() != itemId) {
                throw new IllegalArgumentException("placement item and scoring snapshot must agree");
            }
            learnerItem = SafePayloads.freeze(learnerItem);
            if (SafePayloads.containsSensitive(learnerItem)
                    || !Set.of("itemId", "itemCode", "itemType", "stem", "options", "mediaRef", "displayOrder")
                    .containsAll(learnerItem.keySet())
                    || integer(learnerItem.get("itemId"), 1) != itemId
                    || !token(learnerItem.get("itemCode"), "[a-z][a-z0-9._:-]{1,127}")
                    || !Set.of("VOCABULARY", "PHRASE", "GRAMMAR", "SENTENCE", "READING", "LISTENING", "WRITING")
                    .contains(learnerItem.get("itemType"))
                    || !text(learnerItem.get("stem"), 1, 4096)
                    || learnerItem.containsKey("mediaRef") && !text(learnerItem.get("mediaRef"), 0, 512)
                    || learnerItem.containsKey("displayOrder") && integer(learnerItem.get("displayOrder"), 0) < 0) {
                throw new IllegalArgumentException("placement learner item is incomplete or exposes scoring data");
            }
            if (learnerItem.containsKey("options")) {
                Object rawOptions = learnerItem.get("options");
                if (!(rawOptions instanceof List<?> options) || options.size() > 32) {
                    throw new IllegalArgumentException("placement options are invalid");
                }
                Set<Object> ids = new HashSet<>();
                for (Object rawOption : options) {
                    if (!(rawOption instanceof Map<?, ?> option)
                            || !option.keySet().equals(Set.of("optionId", "label"))
                            || !token(option.get("optionId"), "[a-z][a-z0-9._:-]{0,63}")
                            || !text(option.get("label"), 1, 512)
                            || !ids.add(option.get("optionId"))) {
                        throw new IllegalArgumentException("placement option is invalid");
                    }
                }
            }
            String expectedType = switch (dimension) {
                case VOCABULARY -> "VOCABULARY";
                case BASIC_GRAMMAR -> "GRAMMAR";
                case READING -> "READING";
                case LISTENING -> "LISTENING";
            };
            if (!expectedType.equals(learnerItem.get("itemType"))) {
                throw new IllegalArgumentException("placement item type does not match its dimension");
            }
            if (scoringSnapshot != null && !Set.of(QuestionType.CHOICE, QuestionType.LISTEN_CHOICE,
                    QuestionType.FILL_BLANK, QuestionType.DRAG_SORTER, QuestionType.SPELL_INPUT,
                    QuestionType.DICTATION, QuestionType.CONNECT_LINE).contains(scoringSnapshot.questionType())) {
                throw new IllegalArgumentException("placement item is not objectively gradable");
            }
        }
    }

    record Resolved(Map<String, Object> targetPin, Map<String, Object> contentPin,
                    Map<String, Object> answerRulePin, List<SealedItem> items,
                    boolean targetActive, boolean published, boolean rightsGranted,
                    boolean entitled, boolean phaseOne) {
        public Resolved {
            targetPin = SafePayloads.freeze(targetPin);
            contentPin = SafePayloads.freeze(contentPin);
            answerRulePin = SafePayloads.freeze(answerRulePin);
            items = items == null ? List.of() : List.copyOf(items);
            if (!targetActive || !published || !rightsGranted || !entitled || !phaseOne) {
                throw new IllegalArgumentException("placement owner eligibility is incomplete");
            }
            if (!targetPin.keySet().equals(Set.of("targetId", "targetVersion", "targetSnapshotDigest"))
                    || !contentPin.keySet().equals(Set.of("contentVersionId", "contentEpoch", "snapshotId", "snapshotHash"))) {
                throw new IllegalArgumentException("placement pins are incomplete");
            }
            integer(targetPin.get("targetId"), 1);
            integer(targetPin.get("targetVersion"), 1);
            requireToken(targetPin.get("targetSnapshotDigest"), "[a-f0-9]{64}");
            long contentVersionId = integer(contentPin.get("contentVersionId"), 1);
            integer(contentPin.get("contentEpoch"), 0);
            requireToken(contentPin.get("snapshotId"), "snap_[A-Za-z0-9._:-]{8,127}");
            requireToken(contentPin.get("snapshotHash"), "[a-f0-9]{64}");
            P1PlacementScorer.requireManifest(items.stream()
                    .map(item -> new P1PlacementScorer.Item(Long.toString(item.itemId()), item.dimension())).toList());
            boolean scored = items.stream().allMatch(item -> item.scoringSnapshot() != null);
            boolean deferred = items.stream().allMatch(item -> item.scoringSnapshot() == null);
            if (!scored && !deferred) {
                throw new IllegalArgumentException("placement scoring snapshots must be all present or all deferred");
            }
            if (scored) {
                if (!answerRulePin.keySet().equals(Set.of(
                        "answerRuleSetVersion", "answerRuleVersion", "ruleDigest", "completionRuleVersion"))) {
                    throw new IllegalArgumentException("placement pins are incomplete");
                }
                requireText(answerRulePin.get("answerRuleSetVersion"), 1, 96);
                requireText(answerRulePin.get("answerRuleVersion"), 1, 96);
                requireToken(answerRulePin.get("ruleDigest"), "[a-f0-9]{64}");
            } else if (!answerRulePin.keySet().equals(Set.of("completionRuleVersion"))) {
                throw new IllegalArgumentException("placement pins are incomplete");
            }
            if (!"P1_PLACEMENT_V1".equals(answerRulePin.get("completionRuleVersion"))) {
                throw new IllegalArgumentException("placement completion rule must be pinned to P1_PLACEMENT_V1");
            }
            Set<Long> ids = new HashSet<>();
            for (SealedItem item : items) {
                if (!ids.add(item.itemId())) throw new IllegalArgumentException("placement item id repeats");
                if (scored && (item.scoringSnapshot().contentVersionId() != contentVersionId
                        || !item.scoringSnapshot().scoringVersion().equals(answerRulePin.get("answerRuleVersion")))) {
                    throw new IllegalArgumentException("placement item does not match content and rule pins");
                }
            }
        }
    }

    private static long integer(Object value, long minimum) {
        if (!(value instanceof Number number)) throw new IllegalArgumentException("placement pin integer is required");
        try {
            long result = new BigDecimal(number.toString()).toBigIntegerExact().longValueExact();
            if (result >= minimum) return result;
        } catch (ArithmeticException | NumberFormatException invalid) {
            // Reject rounded, fractional and overflowing pin values.
        }
        throw new IllegalArgumentException("placement pin integer is invalid");
    }

    private static boolean token(Object value, String pattern) {
        return value instanceof String string && string.matches(pattern);
    }

    private static void requireToken(Object value, String pattern) {
        if (!token(value, pattern)) throw new IllegalArgumentException("placement pin token is invalid");
    }

    private static boolean text(Object value, int minimum, int maximum) {
        return value instanceof String string && string.length() >= minimum && string.length() <= maximum;
    }

    private static void requireText(Object value, int minimum, int maximum) {
        if (!text(value, minimum, maximum)) throw new IllegalArgumentException("placement pin text is invalid");
    }
}
