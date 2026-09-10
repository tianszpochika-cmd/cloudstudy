package com.englishflow.assessment.domain;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Deterministic Phase 1 scorer. It consumes only the frozen content snapshot plus the submitted
 * answer; client score / isCorrect / correctAnswer fields never reach this class.
 */
class RuleScoringEngineTest {

    private final RuleScoringEngine engine = new RuleScoringEngine();

    private static ContentSnapshot snapshot(QuestionType type, Map<String, Object> answerRules, int maxScore) {
        return new ContentSnapshot("Q-1", 1001L, 2001L, 3001L, type, Map.of(), answerRules,
                "scoring-v1", maxScore, true);
    }

    // --- CHOICE ---

    @Test
    void choiceExactSelectionEarnsFullScore() {
        ContentSnapshot snapshot = snapshot(QuestionType.CHOICE,
                Map.of("correctOptionKeys", List.of("A", "C")), 10);

        ScoringResult result = engine.score(snapshot, Map.of("selectedOptionKeys", List.of("A", "C")));

        assertThat(result.status()).isEqualTo(ScoringStatus.SCORED);
        assertThat(result.correct()).isTrue();
        assertThat(result.earnedScore()).isEqualTo(10);
        assertThat(result.maxScore()).isEqualTo(10);
        assertThat(result.errorCauseCandidates()).isEmpty();
        assertThat(result.normalizedAnswerHash()).isNotBlank();
    }

    @Test
    void choiceOrderDoesNotMatter() {
        ContentSnapshot snapshot = snapshot(QuestionType.CHOICE,
                Map.of("correctOptionKeys", List.of("A", "C")), 10);

        assertThat(engine.score(snapshot, Map.of("selectedOptionKeys", List.of("C", "A"))).correct()).isTrue();
    }

    @Test
    void choiceWrongSelectionEarnsZeroAndReportsCause() {
        ContentSnapshot snapshot = snapshot(QuestionType.CHOICE,
                Map.of("correctOptionKeys", List.of("A"), "errorCategory", "VOCAB_MISREAD"), 10);

        ScoringResult result = engine.score(snapshot, Map.of("selectedOptionKeys", List.of("B")));

        assertThat(result.correct()).isFalse();
        assertThat(result.earnedScore()).isZero();
        assertThat(result.errorCauseCandidates()).containsExactly("VOCAB_MISREAD");
    }

    @Test
    void choiceFallsBackToDefaultCauseWhenRuleHasNone() {
        ContentSnapshot snapshot = snapshot(QuestionType.CHOICE, Map.of("correctOptionKeys", List.of("A")), 10);

        assertThat(engine.score(snapshot, Map.of("selectedOptionKeys", List.of("B")))
                .errorCauseCandidates()).containsExactly("MEANING_CONFUSION");
    }

    @Test
    void choicePartialCreditAwardsProportionalScore() {
        ContentSnapshot snapshot = snapshot(QuestionType.CHOICE,
                Map.of("correctOptionKeys", List.of("A", "B"), "partialCredit", true), 10);

        // 命中 1/2
        assertThat(engine.score(snapshot, Map.of("selectedOptionKeys", List.of("A"))).earnedScore())
                .isEqualTo(5);
    }

    @Test
    void choiceWithoutPartialCreditAwardsNothing() {
        ContentSnapshot snapshot = snapshot(QuestionType.CHOICE, Map.of("correctOptionKeys", List.of("A", "B")), 10);

        assertThat(engine.score(snapshot, Map.of("selectedOptionKeys", List.of("A"))).earnedScore()).isZero();
    }

    @Test
    void choiceSupportsSingularCorrectOptionRule() {
        ContentSnapshot snapshot = snapshot(QuestionType.CHOICE, Map.of("correctOption", "B"), 10);

        assertThat(engine.score(snapshot, Map.of("selectedOptionKeys", List.of("B"))).correct()).isTrue();
    }

    @Test
    void choiceWithoutAnswerRuleIsRejected() {
        ContentSnapshot snapshot = snapshot(QuestionType.CHOICE, Map.of("errorCategory", "X"), 10);

        assertThatThrownBy(() -> engine.score(snapshot, Map.of("selectedOptionKeys", List.of("A"))))
                .isInstanceOf(AssessmentDomainException.class)
                .satisfies(t -> assertThat(((AssessmentDomainException) t).code())
                        .isEqualTo("ASM_ANSWER_RULE_INVALID"));
    }

    @Test
    void choiceWithNonArraySelectionIsRejected() {
        ContentSnapshot snapshot = snapshot(QuestionType.CHOICE, Map.of("correctOptionKeys", List.of("A")), 10);

        assertThatThrownBy(() -> engine.score(snapshot, Map.of("selectedOptionKeys", "A")))
                .isInstanceOf(AssessmentDomainException.class)
                .satisfies(t -> assertThat(((AssessmentDomainException) t).code())
                        .isEqualTo("ASM_ANSWER_SCHEMA_INVALID"));
    }

    // --- FILL_BLANK ---

    @Test
    void fillBlankAllCorrectEarnsFullScore() {
        ContentSnapshot snapshot = snapshot(QuestionType.FILL_BLANK,
                Map.of("acceptedAnswers", Map.of("b1", "apple", "b2", "banana")), 10);

        ScoringResult result = engine.score(snapshot, Map.of("blanks", List.of(
                Map.of("blankId", "b1", "text", "apple"),
                Map.of("blankId", "b2", "text", "banana"))));

        assertThat(result.correct()).isTrue();
        assertThat(result.earnedScore()).isEqualTo(10);
    }

    @Test
    void fillBlankPartialCorrectScoresProportionally() {
        ContentSnapshot snapshot = snapshot(QuestionType.FILL_BLANK,
                Map.of("acceptedAnswers", Map.of("b1", "apple", "b2", "banana")), 10);

        ScoringResult result = engine.score(snapshot, Map.of("blanks", List.of(
                Map.of("blankId", "b1", "text", "apple"),
                Map.of("blankId", "b2", "text", "wrong"))));

        assertThat(result.correct()).isFalse();
        assertThat(result.earnedScore()).isEqualTo(5);
    }

    @Test
    void fillBlankIsCaseAndWhitespaceInsensitive() {
        ContentSnapshot snapshot = snapshot(QuestionType.FILL_BLANK,
                Map.of("acceptedAnswers", Map.of("b1", "New York")), 10);

        ScoringResult result = engine.score(snapshot, Map.of("blanks", List.of(
                Map.of("blankId", "b1", "text", "  new   york  "))));

        assertThat(result.correct()).isTrue();
    }

    @Test
    void fillBlankWithoutArrayIsRejected() {
        ContentSnapshot snapshot = snapshot(QuestionType.FILL_BLANK,
                Map.of("acceptedAnswers", Map.of("b1", "apple")), 10);

        ScoringResult result = engine.score(snapshot, Map.of("blanks", "apple"));

        assertThat(result.status()).isEqualTo(ScoringStatus.REJECTED);
        assertThat(result.earnedScore()).isZero();
        assertThat(result.errorCauseCandidates()).containsExactly("ANSWER_SCHEMA_INVALID");
    }

    @Test
    void fillBlankWithoutAcceptedAnswersRuleIsRejected() {
        ContentSnapshot snapshot = snapshot(QuestionType.FILL_BLANK, Map.of("errorCategory", "X"), 10);

        ScoringResult result = engine.score(snapshot, Map.of("blanks", List.of()));

        assertThat(result.status()).isEqualTo(ScoringStatus.REJECTED);
    }

    // --- DRAG_SORTER ---

    @Test
    void dragSorterRequiresExactOrder() {
        ContentSnapshot snapshot = snapshot(QuestionType.DRAG_SORTER,
                Map.of("answerKeyOrder", List.of("t1", "t2", "t3")), 10);

        assertThat(engine.score(snapshot, Map.of("orderedTokenIds", List.of("t1", "t2", "t3"))).correct())
                .isTrue();
        assertThat(engine.score(snapshot, Map.of("orderedTokenIds", List.of("t2", "t1", "t3"))).correct())
                .isFalse();
    }

    @Test
    void dragSorterPartialPositionScoresByPositionHits() {
        ContentSnapshot snapshot = snapshot(QuestionType.DRAG_SORTER,
                Map.of("answerKeyOrder", List.of("t1", "t2"), "partialPosition", true), 10);

        // 位置 0 命中 1/2
        assertThat(engine.score(snapshot, Map.of("orderedTokenIds", List.of("t1", "tX"))).earnedScore())
                .isEqualTo(5);
    }

    // --- SPELL_INPUT ---

    @Test
    void spellInputAcceptsAnyOfTheAcceptedAnswers() {
        ContentSnapshot snapshot = snapshot(QuestionType.SPELL_INPUT,
                Map.of("acceptedAnswers", List.of("colour", "color")), 10);

        assertThat(engine.score(snapshot, Map.of("text", "Color")).correct()).isTrue();
        assertThat(engine.score(snapshot, Map.of("text", "colour")).correct()).isTrue();
        assertThat(engine.score(snapshot, Map.of("text", "colur")).correct()).isFalse();
    }

    @Test
    void spellInputWrongReportsSpellingCause() {
        ContentSnapshot snapshot = snapshot(QuestionType.SPELL_INPUT, Map.of("acceptedText", "apple"), 10);

        assertThat(engine.score(snapshot, Map.of("text", "aple")).errorCauseCandidates())
                .containsExactly("SPELLING_WRONG");
    }

    // --- TRANSLATION_INPUT ---

    @Test
    void translationManualReviewReturnsPendingWithoutScore() {
        ContentSnapshot snapshot = snapshot(QuestionType.TRANSLATION_INPUT,
                Map.of("manualReview", true), 10);

        ScoringResult result = engine.score(snapshot, Map.of("text", "anything"));

        assertThat(result.status()).isEqualTo(ScoringStatus.PENDING_MANUAL);
        assertThat(result.correct()).isNull();
        assertThat(result.earnedScore()).isZero();
        assertThat(result.scoreBreakdown()).containsEntry("manualReview", true);
    }

    @Test
    void translationScoresByRequiredConceptCoverage() {
        ContentSnapshot snapshot = snapshot(QuestionType.TRANSLATION_INPUT,
                Map.of("requiredConcepts", List.of("apple", "red")), 10);

        // 命中 1/2
        assertThat(engine.score(snapshot, Map.of("text", "an apple")).earnedScore()).isEqualTo(5);
        assertThat(engine.score(snapshot, Map.of("text", "a red apple")).correct()).isTrue();
        assertThat(engine.score(snapshot, Map.of("text", "a red apple")).earnedScore()).isEqualTo(10);
    }

    @Test
    void translationWithoutConceptsRequiresNonBlankText() {
        ContentSnapshot snapshot = snapshot(QuestionType.TRANSLATION_INPUT, Map.of("requiredConcepts", List.of()), 10);

        assertThat(engine.score(snapshot, Map.of("text", "hello")).correct()).isTrue();
        assertThat(engine.score(snapshot, Map.of("text", "   ")).correct()).isFalse();
    }

    // --- ERROR_CORRECTION ---

    @Test
    void errorCorrectionRequiresBothSpanAndReplacement() {
        ContentSnapshot snapshot = snapshot(QuestionType.ERROR_CORRECTION,
                Map.of("selectedSpanIds", List.of("s1"), "replacements", List.of("is")), 10);

        assertThat(engine.score(snapshot, Map.of(
                "selectedSpanIds", List.of("s1"), "replacements", List.of("is"))).correct()).isTrue();

        assertThat(engine.score(snapshot, Map.of(
                "selectedSpanIds", List.of("s1"), "replacements", List.of("are"))).correct()).isFalse();
    }

    // --- CONNECT_LINE ---

    @Test
    void connectLineRequiresAllPairsMatched() {
        ContentSnapshot snapshot = snapshot(QuestionType.CONNECT_LINE, Map.of("correctPairs", List.of(
                Map.of("leftId", "l1", "rightId", "r1"),
                Map.of("leftId", "l2", "rightId", "r2"))), 10);

        ScoringResult allCorrect = engine.score(snapshot, Map.of("pairs", List.of(
                Map.of("leftId", "l1", "rightId", "r1"),
                Map.of("leftId", "l2", "rightId", "r2"))));

        assertThat(allCorrect.correct()).isTrue();
        assertThat(allCorrect.earnedScore()).isEqualTo(10);
    }

    @Test
    void connectLineWithoutPairRuleIsRejected() {
        ContentSnapshot snapshot = snapshot(QuestionType.CONNECT_LINE, Map.of("errorCategory", "X"), 10);

        assertThat(engine.score(snapshot, Map.of("pairs", List.of())).status())
                .isEqualTo(ScoringStatus.REJECTED);
    }

    // --- generic behaviour ---

    @Test
    void nullSnapshotIsRejected() {
        assertThatThrownBy(() -> engine.score(null, Map.of()))
                .isInstanceOf(NullPointerException.class);
    }

    @Test
    void nullAnswerIsTreatedAsEmptySubmission() {
        ContentSnapshot snapshot = snapshot(QuestionType.CHOICE, Map.of("correctOptionKeys", List.of("A")), 10);

        ScoringResult result = engine.score(snapshot, null);

        assertThat(result.correct()).isFalse();
        assertThat(result.earnedScore()).isZero();
    }

    @Test
    void resultCarriesScoringRuleVersion() {
        ContentSnapshot snapshot = snapshot(QuestionType.SPELL_INPUT, Map.of("acceptedText", "apple"), 10);

        ScoringResult result = engine.score(snapshot, Map.of("text", "apple"));

        assertThat(result.ruleVersion()).isEqualTo("scoring-v1");
        assertThat(result.scoreBreakdown()).containsEntry("ruleVersion", "scoring-v1");
    }

    @Test
    void scoringIsDeterministicForSameInput() {
        ContentSnapshot snapshot = snapshot(QuestionType.CHOICE, Map.of("correctOptionKeys", List.of("A")), 10);
        Map<String, Object> answer = Map.of("selectedOptionKeys", List.of("A"));

        ScoringResult first = engine.score(snapshot, answer);
        ScoringResult second = engine.score(snapshot, answer);

        assertThat(first.normalizedAnswerHash()).isEqualTo(second.normalizedAnswerHash());
        assertThat(first.earnedScore()).isEqualTo(second.earnedScore());
    }
}
