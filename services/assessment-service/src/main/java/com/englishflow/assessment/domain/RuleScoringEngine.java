package com.englishflow.assessment.domain;

import java.text.Normalizer;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

/**
 * Deterministic Phase 1 scorer. It consumes only the frozen content snapshot and the submitted
 * answer; client score/isCorrect/correctAnswer fields are rejected before this class is called.
 */
public final class RuleScoringEngine {
    public ScoringResult score(ContentSnapshot snapshot, Map<String, Object> answer) {
        Objects.requireNonNull(snapshot, "snapshot is required");
        Map<String, Object> safeAnswer = SafePayloads.copyMap(answer == null ? Map.of() : answer);
        String answerHash = SafePayloads.digest(safeAnswer);
        return switch (snapshot.questionType()) {
            case CHOICE, LISTEN_CHOICE -> choice(snapshot, safeAnswer, answerHash);
            case FILL_BLANK -> fillBlank(snapshot, safeAnswer, answerHash);
            case DRAG_SORTER -> ordered(snapshot, safeAnswer, answerHash);
            case SPELL_INPUT -> text(snapshot, safeAnswer, answerHash, "SPELLING_WRONG");
            case ERROR_CORRECTION -> correction(snapshot, safeAnswer, answerHash);
            case TRANSLATION_INPUT -> translation(snapshot, safeAnswer, answerHash);
            case CONNECT_LINE -> pairs(snapshot, safeAnswer, answerHash);
        };
    }

    private ScoringResult choice(ContentSnapshot snapshot, Map<String, Object> answer, String hash) {
        List<String> submitted = strings(answer.get("selectedOptionKeys"), "selectedOptionKeys");
        List<String> expected = strings(first(snapshot.answerRules(), "correctOptionKeys", "correctOptions"), "correctOptionKeys");
        if (expected.isEmpty() && snapshot.answerRules().get("correctOption") != null) {
            expected = List.of(String.valueOf(snapshot.answerRules().get("correctOption")));
        }
        if (expected.isEmpty()) throw AssessmentDomainException.invalid("ASM_ANSWER_RULE_INVALID", "choice rule has no correct option");
        Set<String> actualSet = new LinkedHashSet<>(submitted);
        Set<String> expectedSet = new LinkedHashSet<>(expected);
        boolean correct = actualSet.equals(expectedSet);
        boolean partial = Boolean.TRUE.equals(snapshot.answerRules().get("partialCredit"));
        double earned = correct ? snapshot.maxScore() : partial ? partialScore(actualSet, expectedSet, snapshot.maxScore()) : 0;
        String cause = cause(snapshot, correct, "MEANING_CONFUSION");
        return result(snapshot, earned, correct, hash, correct ? List.of() : List.of(cause));
    }

    private ScoringResult fillBlank(ContentSnapshot snapshot, Map<String, Object> answer, String hash) {
        Object submittedValue = answer.get("blanks");
        if (!(submittedValue instanceof Collection<?> submitted)) {
            return rejected(snapshot, hash, "blanks must be an array");
        }
        Object acceptedValue = snapshot.answerRules().get("acceptedAnswers");
        if (!(acceptedValue instanceof Map<?, ?> accepted)) return rejected(snapshot, hash, "acceptedAnswers rule is required");
        int total = Math.max(1, accepted.size());
        int correctCount = 0;
        for (Object item : submitted) {
            if (!(item instanceof Map<?, ?> blank)) continue;
            String blankId = String.valueOf(blank.get("blankId"));
            String text = normalizeText(blank.get("text"));
            Object expected = accepted.get(blankId);
            if (matchesText(text, expected)) correctCount++;
        }
        double earned = snapshot.maxScore() * (correctCount / (double) total);
        boolean correct = correctCount == total;
        return result(snapshot, earned, correct, hash, correct ? List.of() : List.of(cause(snapshot, false, "SPELLING_WRONG")));
    }

    private ScoringResult ordered(ContentSnapshot snapshot, Map<String, Object> answer, String hash) {
        List<String> actual = strings(answer.get("orderedTokenIds"), "orderedTokenIds");
        List<String> expected = strings(snapshot.answerRules().get("answerKeyOrder"), "answerKeyOrder");
        boolean correct = actual.equals(expected);
        boolean partial = Boolean.TRUE.equals(snapshot.answerRules().get("partialPosition"));
        double earned = correct ? snapshot.maxScore() : partial ? positionalScore(actual, expected, snapshot.maxScore()) : 0;
        return result(snapshot, earned, correct, hash, correct ? List.of() : List.of(cause(snapshot, false, "SENTENCE_STRUCTURE_ERROR")));
    }

    private ScoringResult text(ContentSnapshot snapshot, Map<String, Object> answer, String hash, String defaultCause) {
        String actual = normalizeText(answer.get("text"));
        Object expectedValue = first(snapshot.answerRules(), "acceptedAnswers", "acceptedText");
        boolean correct = matchesText(actual, expectedValue);
        return result(snapshot, correct ? snapshot.maxScore() : 0, correct, hash,
                correct ? List.of() : List.of(cause(snapshot, false, defaultCause)));
    }

    private ScoringResult correction(ContentSnapshot snapshot, Map<String, Object> answer, String hash) {
        boolean selected = set(answer.get("selectedSpanIds")).equals(set(snapshot.answerRules().get("selectedSpanIds")));
        boolean replacements = Objects.equals(answer.get("replacements"), snapshot.answerRules().get("replacements"));
        boolean correct = selected && replacements;
        return result(snapshot, correct ? snapshot.maxScore() : 0, correct, hash,
                correct ? List.of() : List.of(cause(snapshot, false, "GRAMMAR_CONCEPT_CONFUSION")));
    }

    private ScoringResult translation(ContentSnapshot snapshot, Map<String, Object> answer, String hash) {
        if (Boolean.TRUE.equals(snapshot.answerRules().get("manualReview"))) {
            return new ScoringResult(0, snapshot.maxScore(), null, ScoringStatus.PENDING_MANUAL, hash, List.of(),
                    snapshot.scoringVersion(), Map.of("manualReview", true));
        }
        String actual = normalizeText(answer.get("text"));
        List<String> required = strings(snapshot.answerRules().get("requiredConcepts"), "requiredConcepts");
        int hits = 0;
        for (String concept : required) if (actual.contains(normalizeText(concept))) hits++;
        boolean correct = required.isEmpty() ? !actual.isBlank() : hits == required.size();
        double earned = required.isEmpty() ? (correct ? snapshot.maxScore() : 0) : snapshot.maxScore() * (hits / (double) required.size());
        return result(snapshot, earned, correct, hash, correct ? List.of() : List.of(cause(snapshot, false, "TRANSLATION_OMISSION")));
    }

    private ScoringResult pairs(ContentSnapshot snapshot, Map<String, Object> answer, String hash) {
        Set<String> actual = pairKeys(answer.get("pairs"));
        Set<String> expected = pairKeys(snapshot.answerRules().get("correctPairs"));
        if (expected.isEmpty()) return rejected(snapshot, hash, "correctPairs rule is required");
        int hits = 0;
        for (String item : actual) if (expected.contains(item)) hits++;
        boolean correct = hits == expected.size() && actual.size() == expected.size();
        double earned = Boolean.TRUE.equals(snapshot.answerRules().get("partialCredit"))
                ? snapshot.maxScore() * (hits / (double) expected.size()) : (correct ? snapshot.maxScore() : 0);
        return result(snapshot, earned, correct, hash, correct ? List.of() : List.of(cause(snapshot, false, "COLLOCATION_WRONG")));
    }

    private static ScoringResult result(ContentSnapshot snapshot, double earned, boolean correct, String hash, List<String> causes) {
        return new ScoringResult(earned, snapshot.maxScore(), correct, ScoringStatus.SCORED, hash, causes,
                snapshot.scoringVersion(), Map.of("ruleVersion", snapshot.scoringVersion()));
    }

    private static ScoringResult rejected(ContentSnapshot snapshot, String hash, String message) {
        return new ScoringResult(0, snapshot.maxScore(), null, ScoringStatus.REJECTED, hash,
                List.of("ANSWER_SCHEMA_INVALID"), snapshot.scoringVersion(), Map.of("reason", message));
    }

    private static String cause(ContentSnapshot snapshot, boolean correct, String fallback) {
        if (correct) return "";
        Object configured = snapshot.answerRules().get("errorCategory");
        return configured == null || String.valueOf(configured).isBlank() ? fallback : String.valueOf(configured);
    }

    private static double partialScore(Set<String> actual, Set<String> expected, int max) {
        int hits = 0;
        for (String key : actual) if (expected.contains(key)) hits++;
        return max * Math.min(1d, hits / (double) expected.size());
    }

    private static double positionalScore(List<String> actual, List<String> expected, int max) {
        if (expected.isEmpty()) return 0;
        int hits = 0;
        for (int i = 0; i < Math.min(actual.size(), expected.size()); i++) if (actual.get(i).equals(expected.get(i))) hits++;
        return max * (hits / (double) expected.size());
    }

    private static boolean matchesText(String actual, Object expected) {
        if (expected instanceof Collection<?> collection) {
            for (Object item : collection) if (actual.equals(normalizeText(item))) return true;
            return false;
        }
        return expected != null && actual.equals(normalizeText(expected));
    }

    private static String normalizeText(Object value) {
        if (value == null) return "";
        return Normalizer.normalize(String.valueOf(value), Normalizer.Form.NFC)
                .trim().replaceAll("\\s+", " ").toLowerCase(Locale.ROOT);
    }

    private static List<String> strings(Object value, String field) {
        if (!(value instanceof Collection<?> collection)) {
            if (value == null) return List.of();
            throw AssessmentDomainException.invalid("ASM_ANSWER_SCHEMA_INVALID", field + " must be an array");
        }
        List<String> result = new ArrayList<>();
        for (Object item : collection) {
            if (item == null || String.valueOf(item).isBlank()) throw AssessmentDomainException.invalid("ASM_ANSWER_SCHEMA_INVALID", field + " contains an empty value");
            result.add(String.valueOf(item));
        }
        return List.copyOf(result);
    }

    private static Set<String> set(Object value) {
        return new LinkedHashSet<>(strings(value, "set"));
    }

    private static Set<String> pairKeys(Object value) {
        if (!(value instanceof Collection<?> collection)) return Set.of();
        Set<String> result = new LinkedHashSet<>();
        for (Object item : collection) {
            if (!(item instanceof Map<?, ?> pair)) continue;
            result.add(String.valueOf(pair.get("leftId")) + "=" + String.valueOf(pair.get("rightId")));
        }
        return result;
    }

    private static Object first(Map<String, Object> map, String... keys) {
        for (String key : keys) if (map.containsKey(key)) return map.get(key);
        return null;
    }
}
