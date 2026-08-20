package com.englishflow.modules.learning.b3;

import java.text.Normalizer;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Phase 1 B3 deterministic rules. It deliberately has no speech-recognition,
 * model-scoring, or external model dependency. Raw learner input is accepted only for comparison and is never
 * returned by the result records.
 */
public final class B3RuleEngine {
    public static final String RULE_VERSION = "B3-RULE-1";
    public static final String SOUND_CHANGE_VERSION = "SOUND-CHANGE-RULES-1";
    private static final Pattern PUNCTUATION = Pattern.compile("[.!?,;:。！？、，；：]+$");

    public record DictationResult(double score, boolean correct, int expectedTokenCount,
                                  int matchedTokenCount, List<Integer> mismatchPositions,
                                  List<String> feedbackCodes) {}

    public record WritingPointResult(String code, double score, String feedbackCode) {}

    public record WritingResult(double score, String band, List<WritingPointResult> points,
                                Set<String> matchedPointCodes, String ruleVersion,
                                boolean aiScoringAvailable) {}

    public record GrammarResult(boolean correct, double score, String feedbackCode,
                                List<String> matchedRuleCodes, String reviewSignal,
                                String ruleVersion) {}

    public record SentenceBlockResult(boolean correct, boolean acyclic, double score,
                                      List<String> normalizedOrder, String feedbackCode,
                                      String ruleVersion) {}

    public record ImitationResult(boolean structureMatched, double score,
                                  List<String> missingSlots, String feedbackCode,
                                  String ruleVersion) {}

    public record MasterySnapshot(Map<String, Double> dimensions, double overall,
                                  String level, String ruleVersion) {}

    public record SoundToken(String tokenId, String text, String ipa, String partOfSpeech,
                             String stress, int startMs, int endMs) {}

    public record SoundAnnotation(String annotationId, String ruleCode, String tokenStartId,
                                  String tokenEndId, int startMs, int endMs, String label,
                                  String explanation, String ruleSetVersion) {}

    public record SyncChange(String changeId, String entityType, String entityId,
                             long entityVersion, String operation, String payloadHash) {}

    public record SyncDecision(String changeId, String resolution, long serverVersion) {}

    public static String normalizeText(String value) {
        if (value == null) return "";
        String normalized = Normalizer.normalize(value, Normalizer.Form.NFC)
                .trim().toLowerCase(Locale.ROOT).replaceAll("\\s+", " ");
        return PUNCTUATION.matcher(normalized).replaceAll("");
    }

    public static List<String> tokens(String value) {
        String normalized = normalizeText(value);
        if (normalized.isBlank()) return List.of();
        return List.of(normalized.split(" "));
    }

    public static DictationResult scoreDictation(String expected, String candidate) {
        List<String> expectedTokens = tokens(expected);
        List<String> candidateTokens = tokens(candidate);
        int matched = 0;
        List<Integer> mismatches = new ArrayList<>();
        int max = Math.max(expectedTokens.size(), candidateTokens.size());
        for (int index = 0; index < max; index++) {
            String left = index < expectedTokens.size() ? expectedTokens.get(index) : "";
            String right = index < candidateTokens.size() ? candidateTokens.get(index) : "";
            if (Objects.equals(left, right) && !left.isBlank()) matched++;
            else mismatches.add(index);
        }
        double score = expectedTokens.isEmpty() ? 0d : (double) matched / expectedTokens.size();
        List<String> feedback = new ArrayList<>();
        if (!mismatches.isEmpty()) feedback.add("DICTATION_TOKEN_MISMATCH");
        if (candidateTokens.size() != expectedTokens.size()) feedback.add("DICTATION_LENGTH_MISMATCH");
        if (score == 1d) feedback.add("DICTATION_COMPLETE");
        return new DictationResult(score, score == 1d, expectedTokens.size(), matched,
                List.copyOf(mismatches), List.copyOf(feedback));
    }

    public static WritingResult scoreWriting(String candidate, Map<String, Collection<String>> rubric) {
        String normalized = normalizeText(candidate);
        List<WritingPointResult> points = new ArrayList<>();
        Set<String> matched = new LinkedHashSet<>();
        if (rubric != null) {
            for (Map.Entry<String, Collection<String>> entry : rubric.entrySet()) {
                boolean hit = entry.getValue() != null && entry.getValue().stream()
                        .map(B3RuleEngine::normalizeText).filter(value -> !value.isBlank())
                        .anyMatch(normalized::contains);
                points.add(new WritingPointResult(entry.getKey(), hit ? 1d : 0d,
                        hit ? "RUBRIC_POINT_MATCHED" : "RUBRIC_POINT_MISSING"));
                if (hit) matched.add(entry.getKey());
            }
        }
        double score = points.isEmpty() ? 0d : points.stream().mapToDouble(WritingPointResult::score).average().orElse(0d) * 100d;
        String band = score >= 85 ? "HIGH" : score >= 60 ? "PASS" : "RETRY";
        return new WritingResult(score, band, List.copyOf(points), Set.copyOf(matched), RULE_VERSION, false);
    }

    /**
     * Compare a bounded answer with a pre-authored grammar key. Empty or
     * malformed input fails closed and emits a review signal instead of a
     * fabricated success.
     */
    public static GrammarResult scoreGrammarAnswer(String expected, String candidate,
                                                   Collection<String> ruleCodes) {
        String left = bounded(expected, 400);
        String right = bounded(candidate, 400);
        boolean correct = !left.isBlank() && left.equals(right);
        List<String> matched = correct && ruleCodes != null
                ? ruleCodes.stream().filter(Objects::nonNull).map(B3RuleEngine::normalizeText).filter(value -> !value.isBlank()).toList()
                : List.of();
        return new GrammarResult(correct, correct ? 1d : 0d,
                correct ? "GRAMMAR_RULE_MATCHED" : "GRAMMAR_RULE_REVIEW",
                matched, correct ? "NONE" : "SRS_REVIEW", RULE_VERSION);
    }

    public static GrammarResult scoreGrammarChoice(Collection<String> expectedOptions,
                                                   String candidate,
                                                   Collection<String> ruleCodes) {
        String answer = normalizeText(candidate);
        boolean allowed = expectedOptions != null && expectedOptions.stream()
                .filter(Objects::nonNull)
                .map(B3RuleEngine::normalizeText)
                .anyMatch(answer::equals);
        return scoreGrammarAnswer(allowed ? answer : "__no_match__", answer, ruleCodes);
    }

    public static SentenceBlockResult scoreSentenceBlocks(List<String> expectedOrder,
                                                           List<String> candidateOrder) {
        List<String> expected = normalizeList(expectedOrder, 64);
        List<String> candidate = normalizeList(candidateOrder, 64);
        boolean same = !expected.isEmpty() && expected.equals(candidate);
        List<String> nodes = candidate.isEmpty() ? expected : candidate;
        List<String[]> edges = new ArrayList<>();
        for (int index = 1; index < nodes.size(); index++) edges.add(new String[] { nodes.get(index - 1), nodes.get(index) });
        boolean acyclic = isAcyclic(new LinkedHashSet<>(nodes), edges);
        double score = same && acyclic ? 1d : 0d;
        return new SentenceBlockResult(same && acyclic, acyclic, score, List.copyOf(candidate),
                same && acyclic ? "SENTENCE_ORDER_MATCHED" : acyclic ? "SENTENCE_ORDER_REVIEW" : "SENTENCE_GRAPH_INVALID",
                RULE_VERSION);
    }

    public static ImitationResult scoreImitation(Map<String, String> requiredSlots,
                                                 Map<String, String> candidateSlots) {
        List<String> missing = new ArrayList<>();
        if (requiredSlots == null || requiredSlots.isEmpty()) missing.add("STRUCTURE_TEMPLATE");
        else for (Map.Entry<String, String> slot : requiredSlots.entrySet()) {
            String actual = candidateSlots == null ? "" : normalizeText(candidateSlots.get(slot.getKey()));
            if (slot.getValue() == null || !normalizeText(slot.getValue()).equals(actual)) missing.add(slot.getKey());
        }
        boolean matched = missing.isEmpty();
        double score = requiredSlots == null || requiredSlots.isEmpty() ? 0d
                : (double) (requiredSlots.size() - missing.size()) / requiredSlots.size();
        return new ImitationResult(matched, score, List.copyOf(missing),
                matched ? "IMITATION_STRUCTURE_MATCHED" : "IMITATION_SLOT_REVIEW", RULE_VERSION);
    }

    public static MasterySnapshot updateMastery(Map<String, Double> previous,
                                                Map<String, Double> observations) {
        List<String> dimensions = List.of("FORM", "MEANING", "USAGE", "ORDER", "ERROR_CONTROL", "TRANSFER");
        Map<String, Double> next = new LinkedHashMap<>();
        for (String dimension : dimensions) {
            double oldValue = boundedScore(previous == null ? null : previous.get(dimension));
            double observation = boundedScore(observations == null ? null : observations.get(dimension));
            next.put(dimension, roundScore(oldValue * 0.7d + observation * 0.3d));
        }
        double overall = roundScore(next.values().stream().mapToDouble(Double::doubleValue).average().orElse(0d));
        String level = overall >= 0.85d ? "MASTERED" : overall >= 0.6d ? "DEVELOPING" : "REVIEW";
        return new MasterySnapshot(Map.copyOf(next), overall, level, RULE_VERSION);
    }

    public static boolean isAcyclic(Collection<String> nodeIds, Collection<String[]> edges) {
        Map<String, Set<String>> graph = new HashMap<>();
        Map<String, Integer> degree = new HashMap<>();
        for (String node : nodeIds) { graph.put(node, new LinkedHashSet<>()); degree.put(node, 0); }
        for (String[] edge : edges) {
            if (edge == null || edge.length < 2 || !graph.containsKey(edge[0]) || !graph.containsKey(edge[1])) return false;
            if (graph.get(edge[0]).add(edge[1])) degree.put(edge[1], degree.get(edge[1]) + 1);
        }
        ArrayDeque<String> queue = new ArrayDeque<>(degree.entrySet().stream().filter(entry -> entry.getValue() == 0).map(Map.Entry::getKey).toList());
        int visited = 0;
        while (!queue.isEmpty()) {
            String current = queue.removeFirst();
            visited++;
            for (String child : graph.getOrDefault(current, Set.of())) {
                int next = degree.merge(child, -1, Integer::sum);
                if (next == 0) queue.addLast(child);
            }
        }
        return visited == graph.size();
    }

    public static List<SoundAnnotation> soundChanges(List<SoundToken> tokens) {
        if (tokens == null || tokens.isEmpty()) return List.of();
        List<SoundAnnotation> result = new ArrayList<>();
        for (int index = 0; index < tokens.size(); index++) {
            SoundToken current = tokens.get(index);
            SoundToken next = index + 1 < tokens.size() ? tokens.get(index + 1) : null;
            if (next == null) continue;
            String currentIpa = current.ipa() == null ? "" : current.ipa();
            String nextIpa = next.ipa() == null ? "" : next.ipa();
            if (endsWithConsonant(currentIpa) && startsWithVowel(nextIpa) && current.endMs() <= next.startMs() + 160) {
                result.add(annotation("LINK_C2V", current, next, "连读", "末辅音连接到下一词首元音"));
            }
            if (Set.of("a", "an", "the", "to", "of", "and", "for").contains(normalizeText(current.text()))
                    && "NONE".equalsIgnoreCase(current.stress())) {
                result.add(annotation("WEAK_FUNCTION_WORD", current, current, "弱读", "功能词处于非重读位置"));
            }
            if (currentIpa.matches(".*[ptk]$") && (startsWithConsonant(nextIpa) || next.startMs() - current.endMs() >= 120)) {
                result.add(annotation("UNRELEASED_STOP", current, current, "失爆", "阻塞形成但未完全释放"));
            }
            if (currentIpa.endsWith("n") && nextIpa.matches("^[bgkm].*")) {
                result.add(annotation("PLACE_ASSIM_N", current, next, "部位同化", "鼻音部位向后续辅音靠拢"));
            }
        }
        return List.copyOf(result);
    }

    public static SyncDecision resolveSync(SyncChange change, long serverVersion) {
        if (change == null) throw new IllegalArgumentException("change is required");
        if (change.entityVersion() > serverVersion) return new SyncDecision(change.changeId(), "LOCAL_RETRY", serverVersion);
        if (change.entityVersion() == serverVersion) return new SyncDecision(change.changeId(), "MERGED", serverVersion);
        return new SyncDecision(change.changeId(), "SERVER_WINS", serverVersion);
    }

    private static SoundAnnotation annotation(String ruleCode, SoundToken from, SoundToken to,
                                              String label, String explanation) {
        return new SoundAnnotation(ruleCode + ":" + from.tokenId() + ":" + to.tokenId(), ruleCode,
                from.tokenId(), to.tokenId(), Math.min(from.startMs(), to.startMs()),
                Math.max(from.endMs(), to.endMs()), label, explanation, SOUND_CHANGE_VERSION);
    }

    private static boolean startsWithVowel(String ipa) { return ipa.matches("^[aeiouəɪʊɔɑɛ].*"); }
    private static boolean startsWithConsonant(String ipa) { return !ipa.isBlank() && !startsWithVowel(ipa); }
    private static boolean endsWithConsonant(String ipa) { return ipa.matches(".*[bcdfghjklmnpqrstvwxyzŋ]$"); }

    private static String bounded(String value, int maxLength) {
        String normalized = normalizeText(value);
        return normalized.length() > maxLength ? normalized.substring(0, maxLength) : normalized;
    }

    private static List<String> normalizeList(List<String> values, int maxItems) {
        if (values == null || values.isEmpty()) return List.of();
        return values.stream().limit(maxItems).map(value -> bounded(value, 160)).toList();
    }

    private static double boundedScore(Double value) {
        if (value == null || !Double.isFinite(value)) return 0d;
        return Math.max(0d, Math.min(1d, value));
    }

    private static double roundScore(double value) { return Math.round(value * 1000d) / 1000d; }
}
