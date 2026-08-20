package com.englishflow.modules.learning.b3;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.concurrent.atomic.AtomicLong;
import java.util.function.Supplier;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

/**
 * B3 application boundary. The maps are an executable adapter for the current
 * repository baseline; V0012 is the durable schema boundary for the MySQL
 * adapter. No method fabricates a successful result when a resource is absent.
 */
@Service
public final class B3MultimodalService {
    private static final long CONTENT_VERSION = 301L;
    private static final String MANIFEST_ID = "b3-phase1-core-v1";
    private final Clock clock;
    private final B3DurableRepository durableRepository;
    private final AtomicLong ids = new AtomicLong(3000L);
    private final Map<Long, Map<String, Object>> grammarPoints = new LinkedHashMap<>();
    private final Map<Long, Map<String, Object>> grammarTraps = new LinkedHashMap<>();
    private final Map<Long, Map<String, Object>> grammarExercises = new LinkedHashMap<>();
    private final Map<Long, Map<String, Object>> sentences = new LinkedHashMap<>();
    private final Map<String, Map<String, Object>> grammarMastery = new ConcurrentHashMap<>();
    private final Map<Long, Map<String, Object>> writingPrompts = new LinkedHashMap<>();
    private final Map<Long, Map<String, Object>> writingTemplates = new LinkedHashMap<>();
    private final Map<Long, Map<String, Object>> writingMaterials = new LinkedHashMap<>();
    private final Map<Long, Map<String, Object>> proofreadingExercises = new LinkedHashMap<>();
    private final Map<Long, Map<String, Object>> materials = new LinkedHashMap<>();
    private final Map<Long, Map<String, Object>> clips = new LinkedHashMap<>();
    private final Map<Long, Map<String, Object>> offlinePackages = new LinkedHashMap<>();
    private final Map<Long, Map<String, Object>> articles = new LinkedHashMap<>();
    private final Map<String, Map<String, Object>> dictionaryEntries = new LinkedHashMap<>();
    private final Map<Long, Map<String, Object>> readingQuestions = new LinkedHashMap<>();
    private final Map<Long, Map<String, Object>> minimalPairs = new LinkedHashMap<>();
    private final Map<String, List<Map<String, Object>>> roleplayScripts = new LinkedHashMap<>();
    private final List<Map<String, Object>> phonemes = new ArrayList<>();
    private final ConcurrentMap<String, Map<String, Object>> sessions = new ConcurrentHashMap<>();
    private final ConcurrentMap<String, Map<String, Object>> recordings = new ConcurrentHashMap<>();
    private final ConcurrentMap<String, Map<String, Object>> shadowingSessions = new ConcurrentHashMap<>();
    private final ConcurrentMap<String, Map<String, Object>> roleplaySessions = new ConcurrentHashMap<>();
    private final ConcurrentMap<String, Map<String, Object>> writingResults = new ConcurrentHashMap<>();
    private final ConcurrentMap<String, Map<String, Object>> progress = new ConcurrentHashMap<>();
    private final ConcurrentMap<String, Map<String, Object>> idempotency = new ConcurrentHashMap<>();
    private final ConcurrentMap<String, String> idempotencyFingerprints = new ConcurrentHashMap<>();
    private final List<Map<String, Object>> syncChanges = new ArrayList<>();
    private final List<Map<String, Object>> emittedEvents = new ArrayList<>();
    private long syncCursor = 0L;

    public B3MultimodalService() { this(Clock.systemUTC(), new InMemoryB3DurableRepository()); }

    public B3MultimodalService(Clock clock) { this(clock, new InMemoryB3DurableRepository()); }

    @Autowired
    public B3MultimodalService(B3DurableRepository durableRepository) { this(Clock.systemUTC(), durableRepository); }

    public B3MultimodalService(Clock clock, B3DurableRepository durableRepository) {
        this.clock = clock;
        this.durableRepository = durableRepository;
        seedGrammar();
        seedWriting();
        seedListening();
        seedReading();
        seedPhonetics();
        seedRoleplay();
    }

    public Map<String, Object> listGrammarPoints(int limit, String cefrLevel) {
        List<Map<String, Object>> items = grammarPoints.values().stream()
                .filter(item -> cefrLevel == null || cefrLevel.isBlank() || cefrLevel.equals(item.get("cefrLevel")))
                .limit(safeLimit(limit)).toList();
        return page(items);
    }

    public Map<String, Object> getGrammarPoint(long grammarPointId) {
        return envelope(require(grammarPoints, grammarPointId, "GRAMMAR_POINT_NOT_FOUND"));
    }

    public Map<String, Object> grammarTree(Long contentVersionId) {
        List<Map<String, Object>> points = grammarPoints.values().stream()
                .filter(item -> contentVersionId == null || contentVersionId.equals(item.get("contentVersionId")))
                .map(item -> map("grammarPointId", item.get("grammarPointId"), "code", item.get("code"),
                        "title", item.get("title"), "cefrLevel", item.get("cefrLevel"),
                        "prerequisites", item.getOrDefault("prerequisites", List.of()),
                        "contentVersionId", item.get("contentVersionId")))
                .toList();
        return envelope(map("contentVersionId", contentVersionId == null ? CONTENT_VERSION : contentVersionId,
                "nodes", points, "edges", grammarPrerequisiteEdges(points), "ruleVersion", B3RuleEngine.RULE_VERSION));
    }

    public Map<String, Object> listGrammarTraps(long grammarPointId) {
        require(grammarPoints, grammarPointId, "GRAMMAR_POINT_NOT_FOUND");
        return envelope(map("grammarPointId", grammarPointId, "items", grammarTraps.values().stream()
                .filter(item -> grammarPointId == longValue(item.get("grammarPointId"), "grammarPointId"))
                .map(this::publicTrap).toList(), "contentVersionId", CONTENT_VERSION));
    }

    public Map<String, Object> listGrammarExercises(Long grammarPointId, String type, int limit) {
        List<Map<String, Object>> items = grammarExercises.values().stream()
                .filter(item -> grammarPointId == null || grammarPointId == longValue(item.get("grammarPointId"), "grammarPointId"))
                .filter(item -> type == null || type.isBlank() || type.equals(item.get("type")))
                .limit(safeLimit(limit)).map(this::publicExercise).toList();
        return page(items);
    }

    public Map<String, Object> getGrammarExercise(long exerciseId) {
        return envelope(publicExercise(require(grammarExercises, exerciseId, "GRAMMAR_EXERCISE_NOT_FOUND")));
    }

    public Map<String, Object> submitGrammarAttempt(long userId, Map<String, Object> body, String key) {
        requireKey(key);
        return idempotent(userId, "grammar-attempt", key, body, () -> envelope(scoreGrammarAttempt(userId, body, key)));
    }

    /** Scores against server-owned answer material; callers cannot self-report correctness. */
    private Map<String, Object> scoreGrammarAttempt(long userId, Map<String, Object> body, String key) {
            requireContentVersion(body.get("contentVersionId"));
            long exerciseId = longValue(body.get("exerciseId"), "exerciseId");
            Map<String, Object> exercise = require(grammarExercises, exerciseId, "GRAMMAR_EXERCISE_NOT_FOUND");
            Object rawAnswer = body.get("answer");
            Map<String, Double> observation = new LinkedHashMap<>();
            B3RuleEngine.GrammarResult grammarResult;
            B3RuleEngine.SentenceBlockResult blockResult = null;
            if ("SENTENCE_BUILD".equals(exercise.get("type"))) {
                List<String> expected = stringList(exercise.get("expectedOrder"), 64);
                List<String> candidate = rawAnswer instanceof Map<?, ?> answerMap ? stringList(answerMap.get("blockOrder"), 64) : List.of();
                blockResult = B3RuleEngine.scoreSentenceBlocks(expected, candidate);
                grammarResult = new B3RuleEngine.GrammarResult(blockResult.correct(), blockResult.score(), blockResult.feedbackCode(), List.of(), blockResult.correct() ? "NONE" : "SRS_REVIEW", B3RuleEngine.RULE_VERSION);
            } else if ("CHOICE".equals(exercise.get("type"))) {
                String candidate = rawAnswer instanceof Map<?, ?> answerMap ? text(answerMap.get("optionCode"), "") : text(rawAnswer, "");
                grammarResult = B3RuleEngine.scoreGrammarChoice(stringList(exercise.get("correctOptions"), 16), candidate, stringList(exercise.get("ruleCodes"), 16));
            } else {
                String candidate = rawAnswer instanceof Map<?, ?> answerMap ? text(answerMap.get("value"), "") : text(rawAnswer, "");
                grammarResult = B3RuleEngine.scoreGrammarAnswer(text(exercise.get("expectedAnswer"), ""), candidate, stringList(exercise.get("ruleCodes"), 16));
            }
            observation.put("FORM", grammarResult.score());
            observation.put("MEANING", grammarResult.score());
            observation.put("USAGE", grammarResult.score());
            observation.put("ORDER", blockResult == null ? grammarResult.score() : blockResult.score());
            observation.put("ERROR_CONTROL", grammarResult.score());
            observation.put("TRANSFER", grammarResult.score());
            String masteryKey = userId + ":" + exercise.get("grammarPointId");
            Map<String, Object> previous = grammarMastery.get(masteryKey);
            Map<String, Double> oldScores = doubleMap(previous == null ? null : previous.get("dimensions"));
            B3RuleEngine.MasterySnapshot mastery = B3RuleEngine.updateMastery(oldScores, observation);
            Map<String, Object> savedMastery = map("grammarPointId", exercise.get("grammarPointId"), "dimensions", mastery.dimensions(),
                    "overall", mastery.overall(), "level", mastery.level(), "ruleVersion", mastery.ruleVersion(), "updatedAt", clock.instant().toString());
            grammarMastery.put(masteryKey, savedMastery);
            emitEvent("grammar.mastery.updated.v1", map("grammarPointId", exercise.get("grammarPointId"), "userId", userId,
                    "dimensions", mastery.dimensions(), "overall", mastery.overall(), "masteryLevel", mastery.level(), "ruleVersion", mastery.ruleVersion()));
            long attemptId = ids.incrementAndGet();
            durableAttempt(userId, "GRAMMAR:" + exerciseId, body, grammarResult.score(), grammarResult.correct(), grammarResult.feedbackCode(), key);
            return map("attemptId", attemptId, "exerciseId", exerciseId,
                    "correct", grammarResult.correct(), "score", grammarResult.score(), "feedbackCode", grammarResult.feedbackCode(),
                    "reviewSignal", grammarResult.reviewSignal(), "ruleVersion", grammarResult.ruleVersion(), "mastery", savedMastery);
    }

    public Map<String, Object> getGrammarMastery(long userId, Long grammarPointId) {
        List<Map<String, Object>> items = grammarMastery.entrySet().stream()
                .filter(entry -> entry.getKey().startsWith(userId + ":"))
                .map(Map.Entry::getValue)
                .filter(item -> grammarPointId == null || grammarPointId.equals(item.get("grammarPointId")))
                .toList();
        return envelope(map("items", items, "dimensions", List.of("FORM", "MEANING", "USAGE", "ORDER", "ERROR_CONTROL", "TRANSFER"), "ruleVersion", B3RuleEngine.RULE_VERSION));
    }

    public Map<String, Object> targetedGrammarPack(long userId, int limit) {
        Long weakestPoint = null;
        double weakestScore = Double.MAX_VALUE;
        for (Map.Entry<String, Map<String, Object>> entry : grammarMastery.entrySet()) {
            if (!entry.getKey().startsWith(userId + ":")) continue;
            double overall = doubleValue(entry.getValue().get("overall"));
            if (overall < weakestScore) {
                weakestScore = overall;
                weakestPoint = longValue(entry.getValue().get("grammarPointId"), "grammarPointId");
            }
        }
        final Long targetPoint = weakestPoint;
        List<Map<String, Object>> available = grammarExercises.values().stream()
                .sorted(Comparator.comparingInt((Map<String, Object> item) -> targetPoint != null && targetPoint.equals(item.get("grammarPointId")) ? 0 : 1)
                        .thenComparingLong(item -> longValue(item.get("exerciseId"), "exerciseId")))
                .map(this::publicExercise).toList();
        int requested = safeLimit(Math.min(limit, 10));
        return envelope(map("packId", "b3-pack-" + userId + "-" + (targetPoint == null ? "baseline" : targetPoint),
                "items", available.stream().limit(requested).toList(), "availableCount", available.size(),
                "requestedCount", requested, "targetGrammarPointId", targetPoint,
                "source", targetPoint == null ? "BASELINE_REVIEW" : "WEAK_DIMENSION_REVIEW",
                "userIdScoped", true, "ruleVersion", B3RuleEngine.RULE_VERSION));
    }

    public Map<String, Object> getSentence(long sentenceId) {
        return envelope(require(sentences, sentenceId, "SENTENCE_NOT_FOUND"));
    }

    public Map<String, Object> sentenceXray(long sentenceId) {
        Map<String, Object> sentence = require(sentences, sentenceId, "SENTENCE_NOT_FOUND");
        return envelope(map("sentenceId", sentenceId, "tokens", sentence.getOrDefault("tokens", List.of()),
                "slices", sentence.getOrDefault("slices", List.of()), "nodes", sentence.get("nodes"), "edges", sentence.get("edges"),
                "audioTracks", sentence.getOrDefault("audioTracks", List.of()), "ruleVersion", B3RuleEngine.RULE_VERSION));
    }

    public Map<String, Object> sentenceBlocks(long sentenceId) {
        Map<String, Object> sentence = require(sentences, sentenceId, "SENTENCE_NOT_FOUND");
        return envelope(map("sentenceId", sentenceId, "blocks", sentence.getOrDefault("slices", List.of()),
                "blockOrder", sentence.getOrDefault("blockOrder", List.of()), "state", "READY"));
    }

    public Map<String, Object> submitSentenceBlocks(long userId, long sentenceId, Map<String, Object> body, String key) {
        requireKey(key);
        Map<String, Object> sentence = require(sentences, sentenceId, "SENTENCE_NOT_FOUND");
        return idempotent(userId, "sentence-blocks:" + sentenceId, key, body, () -> {
            requireContentVersion(body.get("contentVersionId"));
            B3RuleEngine.SentenceBlockResult result = B3RuleEngine.scoreSentenceBlocks(stringList(sentence.get("blockOrder"), 64), stringList(body.get("blockOrder"), 64));
            durableAttempt(userId, "SENTENCE_BLOCKS:" + sentenceId, body, result.score(), result.correct(), result.feedbackCode(), key);
            return envelope(map("sentenceId", sentenceId, "correct", result.correct(), "acyclic", result.acyclic(), "score", result.score(),
                    "blockOrder", result.normalizedOrder(), "feedbackCode", result.feedbackCode(), "ruleVersion", result.ruleVersion()));
        });
    }

    public Map<String, Object> submitImitation(long userId, long sentenceId, Map<String, Object> body, String key) {
        requireKey(key);
        Map<String, Object> sentence = require(sentences, sentenceId, "SENTENCE_NOT_FOUND");
        return idempotent(userId, "sentence-imitation:" + sentenceId, key, body, () -> {
            requireContentVersion(body.get("contentVersionId"));
            Map<String, String> expected = stringMap(sentence.get("imitationSlots"));
            Map<String, String> candidate = stringMap(body.get("slotValues"));
            B3RuleEngine.ImitationResult result = B3RuleEngine.scoreImitation(expected, candidate);
            durableAttempt(userId, "IMITATION:" + sentenceId, body, result.score(), result.structureMatched(), result.feedbackCode(), key);
            return envelope(map("sentenceId", sentenceId, "structureMatched", result.structureMatched(), "score", result.score(),
                    "missingSlots", result.missingSlots(), "feedbackCode", result.feedbackCode(), "ruleVersion", result.ruleVersion()));
        });
    }

    public Map<String, Object> createGrammarSession(long userId, Map<String, Object> body, String key) {
        requireKey(key);
        return idempotent(userId, "grammar-session", key, body, () -> {
            requireContentVersion(body.get("contentVersionId"));
            long pointId = longValue(body.get("grammarPointId"), "grammarPointId");
            Map<String, Object> point = require(grammarPoints, pointId, "GRAMMAR_POINT_NOT_FOUND");
            int targetCount = intValue(body.getOrDefault("targetCount", 10), "targetCount");
            if (targetCount < 1 || targetCount > 10) throw error("B3_SCHEMA_INVALID", "targetCount 超出范围", 400, false);
            String mode = text(body.get("mode"), "");
            List<Map<String, Object>> authoredExercises = grammarExercises.values().stream()
                    .filter(exercise -> pointId == longValue(exercise.get("grammarPointId"), "grammarPointId"))
                    .filter(exercise -> mode.isBlank() || mode.equals(exercise.get("type")))
                    .limit(targetCount)
                    .toList();
            if (authoredExercises.isEmpty()) throw error("NO_ELIGIBLE_EXERCISES", "该语法点暂无可用练习", 422, false);
            String sessionId = UUID.randomUUID().toString();
            List<Map<String, Object>> exercises = authoredExercises.stream().map(this::publicExercise).toList();
            List<Long> exerciseIds = authoredExercises.stream().map(exercise -> longValue(exercise.get("exerciseId"), "exerciseId")).toList();
            Map<String, Object> session = map("sessionId", sessionId, "userId", userId, "grammarPointId", pointId,
                    "grammarCode", point.get("code"), "contentVersionId", body.get("contentVersionId"), "ruleVersion", B3RuleEngine.RULE_VERSION,
                    "status", "IN_PROGRESS", "currentIndex", 0, "positionVersion", 1L, "exerciseIds", exerciseIds, "exercises", exercises,
                    "createdAt", clock.instant().toString());
            sessions.put(sessionId, session);
            durableRepository.savePracticeSession(new B3DurableRepository.PracticeSession(sessionId, userId, "GRAMMAR", pointId,
                    longValue(body.get("contentVersionId"), "contentVersionId"), B3RuleEngine.RULE_VERSION, "IN_PROGRESS", 0, 1));
            return envelope(publicSession(session));
        });
    }

    public Map<String, Object> answerGrammar(long userId, String sessionId, Map<String, Object> body, String key) {
        requireKey(key);
        Map<String, Object> session = ownedSession(userId, sessionId);
        return idempotent(userId, "grammar-answer:" + sessionId, key, body, () -> {
            int index = ((Number) session.getOrDefault("currentIndex", 0)).intValue();
            List<Long> exerciseIds = longList(session.get("exerciseIds"), 64);
            if (index >= exerciseIds.size()) throw error("GRAMMAR_SESSION_COMPLETE", "练习会话已完成", 409, false);
            long exerciseId = longValue(body.get("exerciseId"), "exerciseId");
            if (exerciseId != exerciseIds.get(index)) throw error("GRAMMAR_SESSION_ORDER_CONFLICT", "当前题目不是会话中的下一题", 409, false);
            Map<String, Object> attemptBody = new LinkedHashMap<>(body);
            attemptBody.put("exerciseId", exerciseId);
            attemptBody.putIfAbsent("contentVersionId", session.get("contentVersionId"));
            Map<String, Object> attempt = scoreGrammarAttempt(userId, attemptBody, key);
            int nextIndex = index + 1;
            String status = nextIndex >= exerciseIds.size() ? "COMPLETED" : "IN_PROGRESS";
            session.put("currentIndex", nextIndex);
            session.put("status", status);
            durableRepository.savePracticeSession(new B3DurableRepository.PracticeSession(sessionId, userId, "GRAMMAR",
                    longValue(session.get("grammarPointId"), "grammarPointId"), longValue(session.get("contentVersionId"), "contentVersionId"),
                    B3RuleEngine.RULE_VERSION, status, nextIndex, longValue(session.getOrDefault("positionVersion", 1), "positionVersion")));
            Map<String, Object> response = new LinkedHashMap<>(attempt);
            response.put("sessionId", sessionId);
            response.put("currentIndex", nextIndex);
            response.put("status", status);
            response.put("answersRemainProtected", true);
            return envelope(response);
        });
    }

    public Map<String, Object> listWritingPrompts(int limit, String promptType) {
        List<Map<String, Object>> items = writingPrompts.values().stream()
                .filter(item -> promptType == null || promptType.isBlank() || promptType.equals(item.get("promptType")))
                .limit(safeLimit(limit)).map(this::publicWritingPrompt).toList();
        return page(items);
    }

    public Map<String, Object> listTranslationExercises(int limit) {
        return page(writingPrompts.values().stream().filter(item -> "TRANSLATION".equals(item.get("promptType")))
                .limit(safeLimit(limit)).map(this::publicWritingPrompt).toList());
    }

    public Map<String, Object> listWritingTemplates(int limit) { return page(writingTemplates.values().stream().limit(safeLimit(limit)).toList()); }

    public Map<String, Object> listWritingMaterials(int limit, String topicCode) {
        return page(writingMaterials.values().stream().filter(item -> topicCode == null || topicCode.isBlank() || topicCode.equals(item.get("topicCode")))
                .limit(safeLimit(limit)).toList());
    }

    public Map<String, Object> listProofreadingExercises(int limit) { return page(proofreadingExercises.values().stream().limit(safeLimit(limit)).map(this::publicProofreading).toList()); }

    public Map<String, Object> listWritingHistory(long userId, int limit) {
        List<Map<String, Object>> items = writingResults.entrySet().stream().filter(entry -> entry.getKey().startsWith(userId + ":"))
                .map(Map.Entry::getValue).map(this::historyView).limit(safeLimit(limit)).toList();
        return page(items);
    }

    public Map<String, Object> submitWriting(long userId, Map<String, Object> body, String key) {
        requireKey(key);
        return idempotent(userId, "writing-submission", key, body, () -> {
            requireContentVersion(body.get("contentVersionId"));
            long promptId = longValue(body.get("promptId"), "promptId");
            Map<String, Object> prompt = require(writingPrompts, promptId, "WRITING_PROMPT_NOT_FOUND");
            String answer = text(body.get("answer"), "");
            Map<String, Collection<String>> rubric = new LinkedHashMap<>();
            rubric.put("THESIS", List.of("because", "important", "should"));
            rubric.put("CONNECTOR", List.of("however", "therefore", "moreover"));
            B3RuleEngine.WritingResult result = B3RuleEngine.scoreWriting(answer, rubric);
            Map<String, Object> evaluation = map("submissionId", ids.incrementAndGet(), "promptId", promptId,
                    "promptTitle", prompt.get("title"), "score", result.score(), "band", result.band(),
                    "ruleVersion", result.ruleVersion(), "aiScoringAvailable", false,
                    "matchedPointCodes", result.matchedPointCodes(), "reviewState", "RULE_EVALUATED",
                    "rubricResults", result.points().stream().map(point -> map("code", point.code(), "score", point.score(), "feedbackCode", point.feedbackCode())).toList());
            Map<String, Object> response = envelope(evaluation);
            writingResults.put(userId + ":" + evaluation.get("submissionId"), response);
            durableAttempt(userId, "WRITING:" + promptId, body, result.score(), !result.matchedPointCodes().isEmpty(), "RULE_EVALUATED", key);
            emitEvent("writing.evaluation.completed.v1", map("submissionId", String.valueOf(evaluation.get("submissionId")), "userId", userId,
                    "promptId", promptId, "ruleVersion", result.ruleVersion(), "score", result.score(), "matchedPointCount", result.matchedPointCodes().size(),
                    "aiScoringAvailable", false, "reviewSignal", result.matchedPointCodes().isEmpty() ? "SRS_REVIEW" : "NONE"));
            return response;
        });
    }

    public Map<String, Object> getWriting(long userId, long submissionId) {
        Map<String, Object> result = writingResults.get(userId + ":" + submissionId);
        if (result == null) throw error("WRITING_SUBMISSION_NOT_FOUND", "writing submission does not exist", 404, false);
        return result;
    }

    public Map<String, Object> submitCorrection(long userId, Map<String, Object> body, String key) {
        requireKey(key);
        return idempotent(userId, "correction", key, body, () -> {
            requireContentVersion(body.get("contentVersionId"));
            long promptId = longValue(body.get("promptId"), "promptId");
            require(writingPrompts, promptId, "WRITING_PROMPT_NOT_FOUND");
            long exerciseId = body.containsKey("exerciseId")
                    ? longValue(body.get("exerciseId"), "exerciseId")
                    : proofreadingExercises.values().stream()
                            .filter(exercise -> promptId == longValue(exercise.get("promptId"), "promptId"))
                            .map(exercise -> longValue(exercise.get("exerciseId"), "exerciseId"))
                            .findFirst()
                            .orElseThrow(() -> error("PROOFREADING_EXERCISE_NOT_FOUND", "该写作题暂无改错练习", 404, false));
            Map<String, Object> exercise = require(proofreadingExercises, exerciseId, "PROOFREADING_EXERCISE_NOT_FOUND");
            if (promptId != longValue(exercise.get("promptId"), "promptId")) {
                throw error("PROOFREADING_EXERCISE_MISMATCH", "改错题不属于当前写作任务", 409, false);
            }
            String answer = B3RuleEngine.normalizeText(text(body.get("answer"), ""));
            String expected = B3RuleEngine.normalizeText(text(exercise.get("correctText"), ""));
            boolean corrected = !answer.isBlank() && answer.equals(expected);
            durableAttempt(userId, "CORRECTION:" + exerciseId, body, corrected ? 1d : 0d, corrected,
                    corrected ? "CORRECTION_RULE_MATCHED" : "CORRECTION_RETRY", key);
            return envelope(map("correct", corrected, "score", corrected ? 1d : 0d,
                    "feedbackCode", corrected ? "CORRECTION_RULE_MATCHED" : "CORRECTION_RETRY",
                    "ruleVersion", B3RuleEngine.RULE_VERSION, "exerciseId", exerciseId, "aiScoringAvailable", false));
        });
    }

    public Map<String, Object> listMaterials(int limit, String cefrLevel) {
        List<Map<String, Object>> items = materials.values().stream()
                .filter(item -> cefrLevel == null || cefrLevel.isBlank() || cefrLevel.equals(item.get("cefrLevel")))
                .limit(safeLimit(limit)).toList();
        return page(items);
    }

    public Map<String, Object> getMaterial(long materialId) { return envelope(require(materials, materialId, "MATERIAL_NOT_FOUND")); }

    public Map<String, Object> getListeningTimeline(long materialId) {
        Map<String, Object> material = require(materials, materialId, "MATERIAL_NOT_FOUND");
        return envelope(map("materialId", materialId, "durationMs", material.get("durationMs"),
                "contentVersionId", material.get("contentVersionId"), "segments", material.get("segments"),
                "timelineVersion", "B3-TIMELINE-1", "audioPositionUnit", "ms"));
    }

    public Map<String, Object> listClips(Long materialId, int limit) {
        return page(clips.values().stream().filter(item -> materialId == null || materialId.equals(item.get("materialId")))
                .limit(safeLimit(limit)).toList());
    }

    public Map<String, Object> listOfflinePackages(long userId, int limit) {
        return page(offlinePackages.values().stream().filter(item -> userId == longValue(item.get("userId"), "userId")).map(this::publicOfflinePackage).limit(safeLimit(limit)).toList());
    }

    public Map<String, Object> createOfflinePackage(long userId, Map<String, Object> body, String key) {
        requireKey(key);
        return idempotent(userId, "offline-package", key, body, () -> {
            requireContentVersion(body.get("contentVersionId"));
            List<Long> materialIds = longList(body.get("materialIds"), 20);
            if (materialIds.isEmpty()) throw error("OFFLINE_PACKAGE_EMPTY", "至少选择一个媒体材料", 400, false);
            List<Map<String, Object>> items = new ArrayList<>();
            for (Long materialId : materialIds) {
                Map<String, Object> material = require(materials, materialId, "MATERIAL_NOT_FOUND");
                String assetId = text(((Map<?, ?>) material.get("mediaRef")).get("assetId"), "");
                items.add(map("assetId", assetId, "kind", "AUDIO", "size", material.get("durationMs"), "sha256", material.get("manifestHash"), "status", "WAITING_FOR_MEDIA"));
            }
            long packageId = ids.incrementAndGet();
            Map<String, Object> offlinePackage = map("packageId", packageId, "userId", userId,
                    "packageCode", "b3-offline-" + packageId, "contentVersionId", body.get("contentVersionId"),
                    "manifestHash", "c".repeat(64), "totalBytes", items.stream().mapToLong(item -> longValue(item.get("size"), "size")).sum(),
                    "expiresAt", clock.instant().plus(Duration.ofDays(7)).toString(), "status", "PENDING_MEDIA", "items", items,
                    "deviceId", body.get("deviceId"));
            offlinePackages.put(packageId, offlinePackage);
            return envelope(publicOfflinePackage(offlinePackage));
        });
    }

    public Map<String, Object> getOfflinePackage(long userId, long packageId) {
        Map<String, Object> value = require(offlinePackages, packageId, "OFFLINE_PACKAGE_NOT_FOUND");
        if (userId != longValue(value.get("userId"), "userId")) throw error("OFFLINE_PACKAGE_NOT_FOUND", "offline package does not exist", 404, false);
        if (Instant.parse(text(value.get("expiresAt"), clock.instant().toString())).isBefore(clock.instant())) throw error("OFFLINE_PACKAGE_EXPIRED", "offline package has expired", 410, false);
        return envelope(publicOfflinePackage(value));
    }

    public Map<String, Object> downloadOfflineAsset(long userId, long packageId, String assetId, String range) {
        Map<String, Object> offlinePackage = require(offlinePackages, packageId, "OFFLINE_PACKAGE_NOT_FOUND");
        if (userId != longValue(offlinePackage.get("userId"), "userId")) throw error("OFFLINE_PACKAGE_NOT_FOUND", "offline package does not exist", 404, false);
        if (Instant.parse(text(offlinePackage.get("expiresAt"), clock.instant().toString())).isBefore(clock.instant())) throw error("OFFLINE_PACKAGE_EXPIRED", "offline package has expired", 410, false);
        Map<String, Object> item = ((List<Map<String, Object>>) offlinePackage.get("items")).stream()
                .filter(candidate -> assetId.equals(candidate.get("assetId"))).findFirst()
                .orElseThrow(() -> error("OFFLINE_ASSET_NOT_FOUND", "offline asset does not exist", 404, false));
        throw error("MEDIA_NOT_READY", "媒体资源尚未挂载授权对象存储，未返回伪造下载结果", 503, true);
    }

    public Map<String, Object> syncOfflinePackage(long userId, long packageId, Map<String, Object> body, String key) {
        requireKey(key);
        getOfflinePackage(userId, packageId);
        return idempotent(userId, "offline-package-sync:" + packageId, key, body, () -> envelope(map("packageId", packageId,
                "clientEventId", body.get("clientEventId"), "accepted", true, "items", body.getOrDefault("items", List.of()), "nextAction", "SYNC_PROGRESS")));
    }

    public Map<String, Object> createListeningSession(long userId, Map<String, Object> body, String key) {
        requireKey(key);
        return idempotent(userId, "listening-session", key, body, () -> {
            requireContentVersion(body.get("contentVersionId"));
            long materialId = longValue(body.get("materialId"), "materialId");
            Map<String, Object> material = require(materials, materialId, "MATERIAL_NOT_FOUND");
            String sessionId = UUID.randomUUID().toString();
            Map<String, Object> session = map("sessionId", sessionId, "userId", userId, "materialId", materialId,
                    "contentVersionId", material.get("contentVersionId"), "status", "IN_PROGRESS", "positionMs", 0,
                    "positionVersion", 1L, "playbackRate", 1d, "subtitleMode", "HIDDEN", "mode", body.getOrDefault("mode", "LISTEN"));
            sessions.put(sessionId, session);
            durableRepository.savePracticeSession(new B3DurableRepository.PracticeSession(sessionId, userId, "LISTENING", materialId,
                    longValue(material.get("contentVersionId"), "contentVersionId"), B3RuleEngine.RULE_VERSION, "IN_PROGRESS", 0, 1));
            return envelope(publicSession(session));
        });
    }

    public Map<String, Object> submitDictation(long userId, String sessionId, Map<String, Object> body, String key) {
        requireKey(key);
        Map<String, Object> session = ownedSession(userId, sessionId);
        long materialId = ((Number) session.get("materialId")).longValue();
        Map<String, Object> material = require(materials, materialId, "MATERIAL_NOT_FOUND");
        String segmentId = text(body.get("segmentId"), "");
        Map<String, Object> segment = ((List<Map<String, Object>>) material.get("segments")).stream()
                .filter(item -> segmentId.equals(item.get("segmentId"))).findFirst()
                .orElseThrow(() -> error("SEGMENT_NOT_FOUND", "segment does not exist", 404, false));
        return idempotent(userId, "dictation:" + sessionId, key, body, () -> {
            requireContentVersion(body.get("contentVersionId"));
            B3RuleEngine.DictationResult result = B3RuleEngine.scoreDictation(text(segment.get("text"), ""), text(body.get("answer"), ""));
            durableAttempt(userId, "DICTATION:" + segmentId, body, result.score(), result.correct(),
                    result.correct() ? "DICTATION_COMPLETE" : "DICTATION_TOKEN_MISMATCH", key);
            emitEvent("listening.dictation.submitted.v1", map("attemptId", UUID.randomUUID().toString(), "userId", userId, "materialId", materialId,
                    "segmentId", segmentId, "mode", body.getOrDefault("mode", "SENTENCE"), "score", result.score(),
                    "mismatchCount", result.mismatchPositions().size(), "contentVersionId", material.get("contentVersionId"),
                    "reviewSignal", result.correct() ? "NONE" : "VOCAB_REVIEW"));
            return envelope(map("sessionId", sessionId, "segmentId", segmentId, "score", result.score(), "correct", result.correct(),
                    "expectedTokenCount", result.expectedTokenCount(), "matchedTokenCount", result.matchedTokenCount(),
                    "mismatchPositions", result.mismatchPositions(), "feedbackCodes", result.feedbackCodes(),
                    "reviewSignal", result.correct() ? "NONE" : "VOCAB_REVIEW", "answerStoredProtected", true));
        });
    }

    public Map<String, Object> updateListeningProgress(long userId, String sessionId, Map<String, Object> body, String key) {
        requireKey(key);
        Map<String, Object> session = ownedSession(userId, sessionId);
        return idempotent(userId, "listening-progress:" + sessionId, key, body, () -> {
            requireContentVersion(body.get("contentVersionId"));
            int position = Math.max(0, intValue(body.getOrDefault("mediaPositionMs", 0), "mediaPositionMs"));
            long incomingVersion = longValue(body.getOrDefault("positionVersion", 1), "positionVersion");
            long currentVersion = longValue(session.getOrDefault("positionVersion", 0), "positionVersion");
            if (incomingVersion < currentVersion) throw error("PROGRESS_VERSION_CONFLICT", "a newer listening position already exists", 409, false);
            session.put("positionMs", position);
            session.put("positionVersion", incomingVersion);
            durableRepository.savePracticeSession(new B3DurableRepository.PracticeSession(sessionId, userId, "LISTENING",
                    longValue(session.get("materialId"), "materialId"), longValue(session.get("contentVersionId"), "contentVersionId"),
                    B3RuleEngine.RULE_VERSION, "IN_PROGRESS", 0, incomingVersion));
            return envelope(map("sessionId", sessionId, "positionMs", position, "positionVersion", session.get("positionVersion"), "saved", true));
        });
    }

    public Map<String, Object> listArticles(int limit, String cefrLevel) {
        List<Map<String, Object>> items = articles.values().stream()
                .filter(item -> cefrLevel == null || cefrLevel.isBlank() || cefrLevel.equals(item.get("cefrLevel")))
                .map(this::articleSummary).limit(safeLimit(limit)).toList();
        return page(items);
    }

    public Map<String, Object> getArticle(long articleId) { return envelope(require(articles, articleId, "ARTICLE_NOT_FOUND")); }

    public Map<String, Object> dictionaryEntry(long articleId, String tokenId) {
        require(articles, articleId, "ARTICLE_NOT_FOUND");
        Map<String, Object> entry = dictionaryEntries.get(articleId + ":" + tokenId);
        if (entry == null) throw error("DICTIONARY_ENTRY_NOT_FOUND", "dictionary entry does not exist", 404, false);
        return envelope(entry);
    }

    public Map<String, Object> readingStory(long articleId) {
        Map<String, Object> article = require(articles, articleId, "ARTICLE_NOT_FOUND");
        return envelope(map("articleId", articleId, "branching", article.getOrDefault("branching", false),
                "nodes", article.getOrDefault("storyNodes", List.of()), "startNodeId", "block-1"));
    }

    public Map<String, Object> listReadingQuestions(Long articleId, int limit) {
        return page(readingQuestions.values().stream().filter(item -> articleId == null || articleId.equals(item.get("articleId")))
                .map(this::publicReadingQuestion).limit(safeLimit(limit)).toList());
    }

    public Map<String, Object> submitReadingAttempt(long userId, Map<String, Object> body, String key) {
        requireKey(key);
        return idempotent(userId, "reading-attempt", key, body, () -> {
            requireContentVersion(body.get("contentVersionId"));
            long questionId = longValue(body.get("questionId"), "questionId");
            Map<String, Object> question = require(readingQuestions, questionId, "READING_QUESTION_NOT_FOUND");
            String candidate = text(body.get("answer"), "");
            boolean correct = B3RuleEngine.normalizeText(candidate).equals(B3RuleEngine.normalizeText(text(question.get("correctOption"), "")));
            durableAttempt(userId, "READING:" + questionId, body, correct ? 1d : 0d, correct, correct ? "READING_RULE_MATCHED" : "READING_REVIEW", key);
            return envelope(map("attemptId", ids.incrementAndGet(), "questionId", questionId, "correct", correct,
                    "score", correct ? 1d : 0d, "feedbackCode", correct ? "READING_RULE_MATCHED" : "READING_REVIEW",
                    "reviewSignal", correct ? "NONE" : "SRS_REVIEW", "ruleVersion", B3RuleEngine.RULE_VERSION));
        });
    }

    public Map<String, Object> updateReadingProgress(long userId, Map<String, Object> body, String key) {
        requireKey(key);
        return idempotent(userId, "reading-progress", key, body, () -> {
            requireContentVersion(body.get("contentVersionId"));
            String progressKey = userId + ":" + longValue(body.get("articleId"), "articleId");
            Map<String, Object> previous = progress.get(progressKey);
            long incoming = longValue(body.getOrDefault("positionVersion", 1), "positionVersion");
            if (previous != null && incoming < longValue(previous.get("positionVersion"), "positionVersion")) {
                throw error("PROGRESS_VERSION_CONFLICT", "a newer reading position already exists", 409, false);
            }
            Map<String, Object> saved = map("progressId", progressKey, "articleId", body.get("articleId"),
                    "contentVersionId", body.get("contentVersionId"), "blockId", body.get("blockId"),
                    "tokenId", body.get("tokenId"), "progressPercent", body.getOrDefault("progressPercent", 0),
                    "positionVersion", incoming, "updatedAt", clock.instant().toString());
            progress.put(progressKey, saved);
            durableRepository.saveReadingProgress(new B3DurableRepository.ReadingProgress(userId,
                    longValue(body.get("articleId"), "articleId"), longValue(body.get("contentVersionId"), "contentVersionId"),
                    text(body.get("blockId"), null), text(body.get("tokenId"), null),
                    doubleValue(body.getOrDefault("progressPercent", 0d)), incoming,
                    text(body.get("clientEventId"), key)));
            emitEvent("reading.progress.updated.v1", map("progressId", progressKey, "userId", userId, "articleId", body.get("articleId"),
                    "contentVersionId", body.get("contentVersionId"), "positionVersion", incoming, "progressPercent", body.getOrDefault("progressPercent", 0), "blockId", body.get("blockId")));
            return envelope(saved);
        });
    }

    public Map<String, Object> createMining(long userId, Map<String, Object> body, String key) {
        requireKey(key);
        return idempotent(userId, "sentence-mining", key, body, () -> {
            requireContentVersion(body.get("contentVersionId"));
            long articleId = longValue(body.get("articleId"), "articleId");
            Map<String, Object> article = require(articles, articleId, "ARTICLE_NOT_FOUND");
            String blockId = text(body.get("blockId"), "");
            boolean blockExists = ((List<Map<String, Object>>) article.getOrDefault("blocks", List.of())).stream()
                    .anyMatch(block -> blockId.equals(block.get("blockId")));
            if (!blockExists) throw error("READING_BLOCK_NOT_FOUND", "阅读段落不存在", 404, false);
            return envelope(map("expressionId", ids.incrementAndGet(),
                "articleId", articleId, "blockId", blockId, "status", "ACTIVE",
                "reviewSignal", "SRS_REVIEW", "sourceVersion", body.get("contentVersionId")));
        });
    }

    public Map<String, Object> phoneticsCatalog(String setCode) {
        if (setCode != null && !setCode.isBlank() && !"EN_48_PHASE1".equals(setCode)) throw error("PHONETIC_SET_NOT_FOUND", "phonetic set does not exist", 404, false);
        return envelope(map("setCode", "EN_48_PHASE1", "count", phonemes.size(), "items", List.copyOf(phonemes), "aiScoringAvailable", false));
    }

    public Map<String, Object> listMinimalPairs(Long phonemeId, int limit) {
        return page(minimalPairs.values().stream().filter(item -> phonemeId == null || phonemeId.equals(item.get("leftPhonemeId")) || phonemeId.equals(item.get("rightPhonemeId")))
                .limit(safeLimit(limit)).toList());
    }

    public Map<String, Object> createRecording(long userId, Map<String, Object> body, String key) {
        requireKey(key);
        return idempotent(userId, "speaking-recording", key, body, () -> {
            String sourceSegmentId = text(body.get("sourceSegmentId"), "");
            requireSourceSegment(sourceSegmentId);
            String storageMode = text(body.getOrDefault("storageMode", "LOCAL_ENCRYPTED"), "LOCAL_ENCRYPTED");
            if (!"LOCAL_ENCRYPTED".equals(storageMode)) throw error("RECORDING_ENCRYPTION_REQUIRED", "Phase 1 录音必须使用本地 AES-256-GCM 边界", 400, false);
            String contentHash = text(body.get("contentHash"), "");
            if (!contentHash.matches("^[A-Fa-f0-9]{64}$") || contentHash.chars().allMatch(character -> character == '0')) {
                throw error("RECORDING_HASH_INVALID", "录音内容哈希无效，未登记录音", 400, false);
            }
            int durationMs = intValue(body.get("durationMs"), "durationMs");
            if (durationMs < 500 || durationMs > 120000) throw error("RECORDING_DURATION_INVALID", "录音时长超出范围", 400, false);
            String recordingId = UUID.randomUUID().toString();
            Map<String, Object> recording = map("recordingId", recordingId, "userId", userId,
                    "sourceSegmentId", sourceSegmentId, "durationMs", durationMs,
                    "contentHash", contentHash, "storageMode", storageMode,
                    "status", "LOCAL_ONLY", "aiScoringAvailable", false,
                    "retentionUntil", clock.instant().plus(Duration.ofDays(30)).toString());
            recordings.put(recordingId, recording);
            durableRepository.saveRecording(new B3DurableRepository.Recording(userId, recordingId,
                    sourceSegmentId, contentHash, durationMs,
                    text(recording.get("storageMode"), "LOCAL_ENCRYPTED"), "LOCAL_ONLY",
                    Instant.parse(text(recording.get("retentionUntil"), clock.instant().toString())),
                    text(body.get("clientEventId"), key)));
            return envelope(publicRecording(recording));
        });
    }

    public Map<String, Object> getRecording(long userId, String recordingId) {
        Map<String, Object> recording = recordings.get(recordingId);
        if (recording == null || ((Number) recording.get("userId")).longValue() != userId || "DELETED".equals(recording.get("status"))) throw error("RECORDING_NOT_FOUND", "recording does not exist", 404, false);
        return envelope(publicRecording(recording));
    }

    public Map<String, Object> deleteRecording(long userId, String recordingId, String key) {
        requireKey(key);
        Map<String, Object> recording = recordings.get(recordingId);
        if (recording == null || ((Number) recording.get("userId")).longValue() != userId) throw error("RECORDING_NOT_FOUND", "recording does not exist", 404, false);
        return idempotent(userId, "speaking-recording-delete:" + recordingId, key, Map.of("recordingId", recordingId), () -> {
            recording.put("status", "DELETED");
            recording.put("deletedAt", clock.instant().toString());
            durableRepository.saveRecording(new B3DurableRepository.Recording(userId, recordingId,
                    text(recording.get("sourceSegmentId"), "UNKNOWN"), text(recording.get("contentHash"), "0".repeat(64)),
                    intValue(recording.get("durationMs"), "durationMs"), text(recording.get("storageMode"), "LOCAL_ENCRYPTED"),
                    "DELETED", Instant.parse(text(recording.get("retentionUntil"), clock.instant().toString())), key));
            return envelope(map("recordingId", recordingId, "status", "DELETED", "aiScoringAvailable", false));
        });
    }

    public Map<String, Object> createShadowingSession(long userId, Map<String, Object> body, String key) {
        requireKey(key);
        return idempotent(userId, "shadowing-session", key, body, () -> {
            requireContentVersion(body.get("contentVersionId"));
            String sourceSegmentId = text(body.get("sourceSegmentId"), "");
            requireSourceSegment(sourceSegmentId);
            int gap = Math.max(500, Math.min(500, intValue(body.getOrDefault("targetGapMs", 500), "targetGapMs")));
            String sessionId = UUID.randomUUID().toString();
            Map<String, Object> session = map("shadowingSessionId", sessionId, "userId", userId,
                    "sourceSegmentId", sourceSegmentId, "targetGapMs", gap, "attemptCount", 0,
                    "positionMs", 0, "status", "IN_PROGRESS", "contentVersionId", body.getOrDefault("contentVersionId", CONTENT_VERSION));
            shadowingSessions.put(sessionId, session);
            durableRepository.saveShadowingSession(new B3DurableRepository.ShadowingSession(sessionId, userId,
                    sourceSegmentId, gap, 0, 0, "IN_PROGRESS",
                    longValue(body.getOrDefault("contentVersionId", CONTENT_VERSION), "contentVersionId"), text(body.get("clientEventId"), key)));
            return envelope(publicUserScoped(session));
        });
    }

    public Map<String, Object> updateShadowingProgress(long userId, String sessionId, Map<String, Object> body, String key) {
        requireKey(key);
        Map<String, Object> session = owned(shadowingSessions, userId, sessionId, "SHADOWING_SESSION_NOT_FOUND");
        return idempotent(userId, "shadowing-progress:" + sessionId, key, body, () -> {
            int attempt = Math.max(1, intValue(body.getOrDefault("attemptNo", 1), "attemptNo"));
            int position = Math.max(0, intValue(body.getOrDefault("positionMs", 0), "positionMs"));
            session.put("attemptCount", Math.max(intValue(session.get("attemptCount"), "attemptCount"), attempt));
            session.put("positionMs", position);
            durableRepository.saveShadowingSession(new B3DurableRepository.ShadowingSession(sessionId, userId,
                    text(session.get("sourceSegmentId"), "UNKNOWN"), intValue(session.get("targetGapMs"), "targetGapMs"),
                    intValue(session.get("attemptCount"), "attemptCount"), position, text(session.get("status"), "IN_PROGRESS"),
                    longValue(session.get("contentVersionId"), "contentVersionId"), text(body.get("clientEventId"), key)));
            return envelope(map("shadowingSessionId", sessionId, "attemptCount", session.get("attemptCount"), "positionMs", position,
                    "targetGapMs", 500, "feedbackCode", "RULE_TIMING_RECORDED", "aiScoringAvailable", false));
        });
    }

    public Map<String, Object> createRoleplaySession(long userId, Map<String, Object> body, String key) {
        requireKey(key);
        return idempotent(userId, "roleplay-session", key, body, () -> {
            requireContentVersion(body.get("contentVersionId"));
            String roleplayCode = text(body.get("roleplayCode"), "COFFEE_SHOP_V1");
            List<Map<String, Object>> turns = roleplayScripts.get(roleplayCode);
            if (turns == null) throw error("ROLEPLAY_NOT_FOUND", "角色扮演脚本不存在", 404, false);
            String sessionId = UUID.randomUUID().toString();
            Map<String, Object> session = map("roleplaySessionId", sessionId, "userId", userId,
                    "roleplayCode", roleplayCode, "scriptVersion", "COFFEE-SCRIPT-1", "role", body.getOrDefault("role", "B"),
                    "turnIndex", 0, "status", "IN_PROGRESS", "contentVersionId", body.get("contentVersionId"), "turns", turns);
            roleplaySessions.put(sessionId, session);
            durableRepository.saveRoleplaySession(new B3DurableRepository.RoleplaySession(sessionId, userId, roleplayCode, 0,
                    longValue(body.get("contentVersionId"), "contentVersionId"), "IN_PROGRESS", text(body.get("clientEventId"), key)));
            return envelope(publicUserScoped(session));
        });
    }

    public Map<String, Object> submitRoleplayTurn(long userId, String sessionId, Map<String, Object> body, String key) {
        requireKey(key);
        Map<String, Object> session = owned(roleplaySessions, userId, sessionId, "ROLEPLAY_SESSION_NOT_FOUND");
        return idempotent(userId, "roleplay-turn:" + sessionId, key, body, () -> {
            int turnIndex = intValue(body.getOrDefault("turnIndex", session.get("turnIndex")), "turnIndex");
            int currentTurn = intValue(session.get("turnIndex"), "turnIndex");
            if (turnIndex != currentTurn) throw error("ROLEPLAY_TURN_CONFLICT", "turn index is stale or out of order", 409, false);
            List<Map<String, Object>> turns = (List<Map<String, Object>>) session.get("turns");
            if (currentTurn >= turns.size()) throw error("ROLEPLAY_SESSION_COMPLETE", "角色扮演已完成", 409, false);
            Map<String, Object> turn = turns.get(currentTurn);
            List<String> choices = stringList(turn.get("choiceCodes"), 8);
            String choiceCode = text(body.get("choiceCode"), "");
            if (!choices.isEmpty() && !choices.contains(choiceCode)) throw error("INVALID_BRANCH_CHOICE", "角色扮演选项无效", 400, false);
            String recordingId = text(body.get("recordingId"), "");
            if (Boolean.TRUE.equals(turn.get("recordingRequired")) && recordingId.isBlank()) {
                throw error("ROLEPLAY_RECORDING_REQUIRED", "该角色扮演回合需要先提交录音引用", 400, false);
            }
            if (!recordingId.isBlank()) {
                Map<String, Object> recording = recordings.get(recordingId);
                if (recording == null || userId != longValue(recording.get("userId"), "userId") || "DELETED".equals(recording.get("status"))) {
                    throw error("RECORDING_NOT_FOUND", "角色扮演录音不存在", 404, false);
                }
            }
            int nextTurn = currentTurn + 1;
            String status = nextTurn >= turns.size() ? "COMPLETED" : "IN_PROGRESS";
            session.put("turnIndex", nextTurn);
            session.put("status", status);
            durableRepository.saveRoleplaySession(new B3DurableRepository.RoleplaySession(sessionId, userId,
                    text(session.get("roleplayCode"), "UNKNOWN"), nextTurn, longValue(session.get("contentVersionId"), "contentVersionId"),
                    status, text(body.get("clientEventId"), key)));
            return envelope(map("roleplaySessionId", sessionId, "turnIndex", currentTurn, "nextTurnIndex", nextTurn,
                    "nextTurn", nextTurn < turns.size() ? turns.get(nextTurn) : null, "status", status,
                    "recordingId", recordingId.isBlank() ? null : recordingId, "feedbackCode", "ROLEPLAY_TURN_RECORDED", "aiScoringAvailable", false));
        });
    }

    public Map<String, Object> selfRate(long userId, String recordingId, Map<String, Object> body, String key) {
        requireKey(key);
        Map<String, Object> recording = recordings.get(recordingId);
        if (recording == null || ((Number) recording.get("userId")).longValue() != userId || "DELETED".equals(recording.get("status"))) throw error("RECORDING_NOT_FOUND", "recording does not exist", 404, false);
        return idempotent(userId, "speaking-rating:" + recordingId, key, body, () -> {
            recording.put("selfRating", body.get("rating"));
            recording.put("ratingTags", body.getOrDefault("tags", List.of()));
            durableRepository.saveSelfRating(userId, recordingId, text(body.get("rating"), "UNCERTAIN"),
                    stringList(body.get("tags"), 16), text(body.get("clientEventId"), key));
            emitEvent("speaking.self_rating.submitted.v1", map("recordingId", recordingId, "userId", userId, "rating", body.get("rating"),
                    "tagCount", body.get("tags") instanceof Collection<?> tags ? tags.size() : 0, "durationMs", recording.get("durationMs"),
                    "aiScoringAvailable", false, "reviewSignal", "SRS_REVIEW"));
            return envelope(map("recordingId", recordingId, "rating", body.get("rating"), "aiScoringAvailable", false, "reviewSignal", "SRS_REVIEW"));
        });
    }

    public synchronized Map<String, Object> pushSync(long userId, Map<String, Object> body, String key) {
        requireKey(key);
        return idempotent(userId, "sync-push", key, body, () -> {
            List<String> accepted = new ArrayList<>();
            List<Map<String, Object>> conflicts = new ArrayList<>();
            Object rawChanges = body.get("changes");
            if (rawChanges instanceof List<?> list) {
                for (Object raw : list) {
                    if (!(raw instanceof Map<?, ?> change)) continue;
                    String changeId = text(change.get("changeId"), "");
                    if (changeId.isBlank()) continue;
                    boolean duplicate = syncChanges.stream().anyMatch(existing -> changeId.equals(existing.get("changeId")) && userId == longValue(existing.get("userId"), "userId"));
                    if (duplicate) { accepted.add(changeId); continue; }
                    long localVersion = longValue(change.containsKey("entityVersion") ? change.get("entityVersion") : 1, "entityVersion");
                    long serverVersion = serverVersion(change.get("entityType"), change.get("entityId"));
                    B3RuleEngine.SyncDecision decision = serverVersion == 0L
                            ? new B3RuleEngine.SyncDecision(changeId, "MERGED", 0L)
                            : B3RuleEngine.resolveSync(new B3RuleEngine.SyncChange(changeId, text(change.get("entityType"), "UNKNOWN"), text(change.get("entityId"), ""), localVersion, text(change.get("operation"), "UPSERT"), text(change.get("payloadHash"), "")), serverVersion);
                    Map<String, Object> stored = map("changeId", changeId, "userId", userId, "entityType", change.get("entityType"), "entityId", change.get("entityId"), "entityVersion", localVersion, "operation", change.get("operation"), "payloadHash", change.get("payloadHash"), "occurredAt", change.get("occurredAt"), "clientEventId", change.get("clientEventId"), "status", decision.resolution(), "cursor", ++syncCursor);
                    syncChanges.add(stored);
                    durableRepository.saveOfflineChange(new B3DurableRepository.OfflineChange(userId,
                            text(body.get("deviceId"), "unknown-device"), changeId, text(body.get("clientBatchId"), key),
                            text(change.get("entityType"), "UNKNOWN"), text(change.get("entityId"), ""), localVersion,
                            text(change.get("operation"), "UPSERT"), text(change.get("payloadHash"), ""),
                            parseInstant(change.get("occurredAt"), clock.instant()), decision.resolution()));
                    if ("SERVER_WINS".equals(decision.resolution())) {
                        conflicts.add(map("conflictId", ids.incrementAndGet(), "changeId", changeId, "entityType", change.get("entityType"), "entityId", change.get("entityId"), "resolution", decision.resolution(), "serverVersion", decision.serverVersion()));
                        durableRepository.saveOfflineConflict(userId, changeId, text(change.get("entityType"), "UNKNOWN"), text(change.get("entityId"), ""), localVersion, decision.serverVersion(), decision.resolution());
                    } else accepted.add(changeId);
                }
            }
            durableRepository.saveOfflineCursor(new B3DurableRepository.OfflineCursor(userId,
                    text(body.get("deviceId"), "unknown-device"), syncCursor, "b3-sync-v2"));
            emitEvent("offline.sync.applied.v1", map("clientBatchId", body.get("clientBatchId"), "userId", userId,
                    "acceptedCount", accepted.size(), "conflictCount", conflicts.size(), "nextCursor", Long.toString(syncCursor),
                    "resolution", conflicts.isEmpty() ? "MERGED" : "SERVER_WINS"));
            return envelope(map("clientBatchId", body.get("clientBatchId"), "acceptedChangeIds", accepted, "conflicts", conflicts, "nextCursor", Long.toString(syncCursor), "serverVersion", syncCursor));
        });
    }

    public synchronized Map<String, Object> pullSync(long userId, String cursor, int limit) {
        long after = 0L;
        try { if (cursor != null && !cursor.isBlank()) after = Long.parseLong(cursor); } catch (NumberFormatException ignored) { throw error("SYNC_CURSOR_INVALID", "cursor is invalid", 400, false); }
        final long cursorAfter = after;
        List<Map<String, Object>> changes = syncChanges.stream().filter(item -> userId == longValue(item.get("userId"), "userId") && longValue(item.get("cursor"), "cursor") > cursorAfter).limit(safeLimit(limit)).toList();
        return envelope(map("cursor", Long.toString(syncCursor), "changes", changes, "hasMore", changes.size() >= safeLimit(limit)));
    }

    public Map<String, Object> manifest(String manifestId) {
        if (!MANIFEST_ID.equals(manifestId)) throw error("MANIFEST_NOT_FOUND", "offline manifest does not exist", 404, false);
        return envelope(map("manifestId", MANIFEST_ID, "contentVersionId", CONTENT_VERSION,
                "expiresAt", clock.instant().plus(Duration.ofDays(7)).toString(), "sha256", "d".repeat(64),
                "items", List.of(map("assetId", "b3-phonetics-2d-v1", "kind", "PHONETICS_2D", "size", 1024, "sha256", "e".repeat(64))), "bytes", 1024));
    }

    private void seedGrammar() {
        String[][] points = {
                {"TENSE_PRESENT_SIMPLE", "一般现在时", "subject + base verb(s)", "习惯、事实和规律", "A1"},
                {"TENSE_PRESENT_CONTINUOUS", "现在进行时", "am/is/are + verb-ing", "正在发生的动作", "A2"},
                {"TENSE_PRESENT_PERFECT", "现在完成时", "have/has + past participle", "过去发生且与现在有联系", "B1"},
                {"TENSE_PRESENT_PERFECT_CONTINUOUS", "现在完成进行时", "have/has been + verb-ing", "持续到现在的动作", "B2"},
                {"TENSE_PAST_SIMPLE", "一般过去时", "verb-ed / irregular verb", "过去已结束的动作", "A2"},
                {"TENSE_PAST_CONTINUOUS", "过去进行时", "was/were + verb-ing", "过去某时正在发生", "B1"},
                {"TENSE_PAST_PERFECT", "过去完成时", "had + past participle", "过去某时之前已完成", "B1"},
                {"TENSE_PAST_PERFECT_CONTINUOUS", "过去完成进行时", "had been + verb-ing", "过去某时之前持续", "B2"},
                {"TENSE_FUTURE_WILL", "一般将来时", "will + base verb", "预测、承诺和即时决定", "A2"},
                {"TENSE_FUTURE_GOING_TO", "be going to", "am/is/are going to + verb", "计划和有迹象的预测", "A2"},
                {"TENSE_FUTURE_CONTINUOUS", "将来进行时", "will be + verb-ing", "将来某时正在发生", "B2"},
                {"TENSE_FUTURE_PERFECT", "将来完成时", "will have + past participle", "将来某时之前完成", "B2"}
        };
        for (int index = 0; index < points.length; index++) {
            long pointId = 3101L + index;
            String[] point = points[index];
            grammarPoints.put(pointId, map("grammarPointId", pointId, "code", point[0], "title", point[1], "ruleFormula", point[2],
                    "meaningCn", point[3], "cefrLevel", point[4], "contentVersionId", CONTENT_VERSION,
                    "examples", List.of("The team has completed the project.", "The team has not completed the project."),
                    "trapTags", List.of("时间状语误用", "主谓一致"), "prerequisites", index == 0 ? List.of() : List.of(3101L + index - 1)));
            grammarTraps.put(3800L + index, map("trapId", 3800L + index, "grammarPointId", pointId, "trapCode", point[0] + "_TIME_MARKER",
                    "wrongPattern", "与时态不匹配的时间状语", "correctRule", point[2], "explanationCn", "先识别时间范围，再选择动词形式。", "contentVersionId", CONTENT_VERSION));
        }
        grammarExercises.put(3701L, map("exerciseId", 3701L, "grammarPointId", 3103L, "type", "FILL_BLANK", "promptText", "The team ___ completed the project.", "expectedAnswer", "has", "ruleCodes", List.of("AUXILIARY_AGREEMENT", "PAST_PARTICIPLE"), "contentVersionId", CONTENT_VERSION));
        grammarExercises.put(3702L, map("exerciseId", 3702L, "grammarPointId", 3103L, "type", "CHOICE", "promptText", "Choose the correct auxiliary.", "correctOptions", List.of("has"), "options", List.of(map("optionCode", "has", "label", "has"), map("optionCode", "have", "label", "have")), "ruleCodes", List.of("SUBJECT_AGREEMENT"), "contentVersionId", CONTENT_VERSION));
        grammarExercises.put(3703L, map("exerciseId", 3703L, "grammarPointId", 3103L, "type", "SENTENCE_BUILD", "promptText", "Rebuild the sentence blocks.", "expectedOrder", List.of("subject", "predicate", "object"), "contentVersionId", CONTENT_VERSION));
        grammarExercises.put(3704L, map("exerciseId", 3704L, "grammarPointId", 3103L, "type", "PARAPHRASE", "promptText", "Use the target structure to rewrite the sentence.", "expectedAnswer", "the team has completed the project", "ruleCodes", List.of("PRESENT_PERFECT"), "contentVersionId", CONTENT_VERSION));
        List<Map<String, Object>> nodes = List.of(map("nodeId", "n1", "role", "SUBJECT", "text", "The team", "startToken", 0, "endToken", 1), map("nodeId", "n2", "role", "PREDICATE", "text", "has completed", "startToken", 2, "endToken", 3), map("nodeId", "n3", "role", "OBJECT", "text", "the project", "startToken", 4, "endToken", 5));
        sentences.put(3201L, map("sentenceId", 3201L, "text", "The team has completed the project.", "translation", "团队已经完成了项目。", "contentVersionId", CONTENT_VERSION,
                "tokens", List.of(map("tokenId", "w1", "text", "The", "startToken", 0, "endToken", 0), map("tokenId", "w2", "text", "team", "startToken", 1, "endToken", 1), map("tokenId", "w3", "text", "has completed", "startToken", 2, "endToken", 3), map("tokenId", "w4", "text", "the project", "startToken", 4, "endToken", 5)),
                "slices", List.of(map("sliceId", "subject", "sliceCode", "subject", "role", "SUBJECT", "text", "The team", "colorToken", "BLUE", "startToken", 0, "endToken", 1), map("sliceId", "predicate", "sliceCode", "predicate", "role", "PREDICATE", "text", "has completed", "colorToken", "GREEN", "startToken", 2, "endToken", 3), map("sliceId", "object", "sliceCode", "object", "role", "OBJECT", "text", "the project", "colorToken", "ORANGE", "startToken", 4, "endToken", 5)),
                "blockOrder", List.of("subject", "predicate", "object"), "imitationSlots", map("subject", "the team", "predicate", "has completed", "object", "the project"),
                "audioTracks", List.of(map("trackCode", "NORMAL", "speed", 1.0, "durationMs", 1450), map("trackCode", "SLOW", "speed", 0.7, "durationMs", 2070)),
                "nodes", nodes, "edges", List.of(map("fromNodeId", "n1", "toNodeId", "n2", "relation", "SUBJECT_OF"), map("fromNodeId", "n2", "toNodeId", "n3", "relation", "TAKES_OBJECT"))));
    }

    private void seedWriting() {
        writingPrompts.put(3301L, map("promptId", 3301L, "promptType", "TRANSLATION", "title", "规则化汉译英：学习习惯", "taskText", "良好的学习习惯有助于长期进步。", "targetStructure", List.of("good habits", "help", "long-term progress"), "contentVersionId", CONTENT_VERSION));
        writingPrompts.put(3302L, map("promptId", 3302L, "promptType", "CORRECTION", "title", "主谓一致改错", "taskText", "Find and correct the grammar error.", "targetStructure", List.of("subject", "verb"), "contentVersionId", CONTENT_VERSION));
        writingPrompts.put(3303L, map("promptId", 3303L, "promptType", "ESSAY", "title", "短文：可持续学习计划", "taskText", "Write a short opinion paragraph with a clear reason and example.", "targetStructure", List.of("thesis", "reason", "example", "connector"), "contentVersionId", CONTENT_VERSION));
        writingTemplates.put(3901L, map("templateId", 3901L, "templateType", "ESSAY", "title", "观点段落四槽模板", "structure", List.of(map("slotCode", "THESIS", "label", "观点", "required", true), map("slotCode", "REASON", "label", "原因", "required", true), map("slotCode", "EXAMPLE", "label", "例子", "required", true), map("slotCode", "CLOSING", "label", "收束", "required", false)), "contentVersionId", CONTENT_VERSION));
        writingTemplates.put(3902L, map("templateId", 3902L, "templateType", "LETTER", "title", "正式邮件模板", "structure", List.of(map("slotCode", "GREETING", "label", "称呼", "required", true), map("slotCode", "REQUEST", "label", "请求", "required", true), map("slotCode", "CLOSING", "label", "结尾", "required", true)), "contentVersionId", CONTENT_VERSION));
        writingMaterials.put(3910L, map("materialId", 3910L, "topicCode", "LEARNING_HABITS", "title", "学习习惯高分表达", "bodyText", "Regular review makes progress visible; however, a sustainable plan matters more than a burst of effort.", "contentVersionId", CONTENT_VERSION));
        proofreadingExercises.put(3920L, map("exerciseId", 3920L, "promptId", 3302L, "errorType", "SUBJECT_VERB_AGREEMENT", "wrongText", "The team have completed the task.", "wrongTextHash", "f".repeat(64), "correctText", "The team has completed the task.", "explanation", "集合名词 team 在这里按单数处理。", "contentVersionId", CONTENT_VERSION));
    }

    private void seedListening() {
        List<Map<String, Object>> tokens = List.of(map("tokenId", "t1", "text", "Good", "startMs", 0, "endMs", 280, "ipa", "gʊd", "stress", "PRIMARY"), map("tokenId", "t2", "text", "habits", "startMs", 300, "endMs", 760, "ipa", "hæbɪts", "stress", "PRIMARY"), map("tokenId", "t3", "text", "help", "startMs", 800, "endMs", 1060, "ipa", "help", "stress", "PRIMARY"));
        List<Map<String, Object>> segments = List.of(map("segmentId", "seg-1", "startMs", 0, "endMs", 1200, "text", "Good habits help.", "translation", "良好的习惯有帮助。", "tokens", tokens, "annotations", List.of(map("annotationId", "a1", "ruleCode", "LINK_C2V", "startMs", 760, "endMs", 800, "label", "连读", "ruleSetVersion", B3RuleEngine.SOUND_CHANGE_VERSION))));
        materials.put(3401L, map("materialId", 3401L, "title", "Learning in small steps", "cefrLevel", "B1", "durationMs", 1200, "contentVersionId", CONTENT_VERSION, "rightsStatus", "AUTHORIZED", "manifestHash", "a".repeat(64), "mediaRef", map("assetId", "b3-audio-3401", "variant", "LOW", "rightsStatus", "AUTHORIZED", "availability", "NOT_READY"), "segments", segments));
        clips.put(3410L, map("clipId", 3410L, "materialId", 3401L, "title", "Good habits help", "startMs", 0, "endMs", 1200, "mediaRef", map("assetId", "b3-audio-3401", "variant", "LOW", "rightsStatus", "AUTHORIZED", "availability", "NOT_READY"), "contentVersionId", CONTENT_VERSION));
    }

    private void seedReading() {
        List<Map<String, Object>> blocks = List.of(map("blockId", "block-1", "blockIndex", 0, "text", "Small routines make difficult goals easier to reach.", "translation", "小习惯能让困难目标更容易实现。", "tokens", List.of(map("tokenId", "small", "text", "Small", "startMs", 0, "endMs", 1), map("tokenId", "routines", "text", "routines", "startMs", 2, "endMs", 3))), map("blockId", "block-2", "blockIndex", 1, "text", "Reviewing regularly keeps progress visible.", "translation", "定期复习能让进步保持可见。", "tokens", List.of()));
        List<Map<String, Object>> storyNodes = List.of(map("nodeId", "block-1", "blockId", "block-1", "choices", List.of(map("choiceCode", "NEXT", "label", "继续阅读", "nextBlockId", "block-2"))), map("nodeId", "block-2", "blockId", "block-2", "choices", List.of()));
        articles.put(3501L, map("articleId", 3501L, "title", "Small routines, steady progress", "cefrLevel", "B1", "wordCount", 12, "estimatedMinutes", 2, "rightsStatus", "AUTHORIZED", "contentVersionId", CONTENT_VERSION, "branching", true, "blocks", blocks, "storyNodes", storyNodes));
        dictionaryEntries.put("3501:small", map("articleId", 3501L, "tokenId", "small", "lemma", "small", "partOfSpeech", "adjective", "meaningCn", "小的；少量的", "exampleText", "small routines", "contentVersionId", CONTENT_VERSION));
        dictionaryEntries.put("3501:routines", map("articleId", 3501L, "tokenId", "routines", "lemma", "routine", "partOfSpeech", "noun", "meaningCn", "日常习惯", "exampleText", "daily routines", "contentVersionId", CONTENT_VERSION));
        readingQuestions.put(3950L, map("questionId", 3950L, "articleId", 3501L, "questionType", "MAIN_IDEA", "stemText", "What is the main idea?", "options", List.of(map("optionCode", "A", "label", "Small routines support steady progress."), map("optionCode", "B", "label", "Large goals need no review.")), "correctOption", "A", "contentVersionId", CONTENT_VERSION));
    }

    private void seedPhonetics() {
        String[] symbols = { "iː", "ɪ", "e", "æ", "ɜː", "ə", "ʌ", "ɔː", "ɒ", "ʊ", "uː", "ɑː", "eɪ", "aɪ", "ɔɪ", "əʊ", "aʊ", "ɪə", "eə", "ʊə", "p", "b", "t", "d", "k", "g", "f", "v", "θ", "ð", "s", "z", "ʃ", "ʒ", "h", "tʃ", "dʒ", "m", "n", "ŋ", "l", "r", "j", "w", "ɾ", "ʔ", "ʍ", "x" };
        for (int index = 0; index < symbols.length; index++) {
            String group = index < 12 ? "MONOPHTHONG" : index < 20 ? "DIPHTHONG" : index < 44 ? "CONSONANT" : "TEACHING_VARIANT";
            phonemes.add(map("phonemeId", 3600L + index, "symbol", symbols[index], "group", group, "exampleWord", index < 20 ? "example" : "practice", "description", "Phase 1 rule-based phoneme reference", "contentVersionId", CONTENT_VERSION, "mouthProfile", map("profileVersion", "mouth-v1", "fallback2d", "svg-mouth-v1", "jawOpen", 0.4, "tongueHeight", 0.5, "tongueBackness", 0.0, "lipRound", 0.3, "voicing", index % 2 == 0)));
        }
        minimalPairs.put(3960L, map("pairId", 3960L, "leftPhonemeId", 3601L, "rightPhonemeId", 3603L, "leftWord", "ship", "rightWord", "sheep", "contentVersionId", CONTENT_VERSION));
        minimalPairs.put(3961L, map("pairId", 3961L, "leftPhonemeId", 3620L, "rightPhonemeId", 3621L, "leftWord", "fan", "rightWord", "van", "contentVersionId", CONTENT_VERSION));
    }

    private void seedRoleplay() {
        roleplayScripts.put("COFFEE_SHOP_V1", List.of(
                map("turnIndex", 0, "speaker", "A", "text", "Welcome. What would you like today?", "choiceCodes", List.of("COFFEE", "TEA"), "recordingRequired", false),
                map("turnIndex", 1, "speaker", "B", "text", "I would like a coffee, please.", "choiceCodes", List.of(), "recordingRequired", true),
                map("turnIndex", 2, "speaker", "A", "text", "Would you like anything else?", "choiceCodes", List.of("NO", "CAKE"), "recordingRequired", false),
                map("turnIndex", 3, "speaker", "B", "text", "No, thank you.", "choiceCodes", List.of(), "recordingRequired", true)));
    }

    private List<Map<String, Object>> grammarPrerequisiteEdges(List<Map<String, Object>> points) {
        List<Map<String, Object>> edges = new ArrayList<>();
        for (Map<String, Object> point : points) for (Long prerequisite : longList(point.get("prerequisites"), 8)) {
            edges.add(map("fromGrammarPointId", prerequisite, "toGrammarPointId", point.get("grammarPointId"), "relation", "PREREQUISITE"));
        }
        return edges;
    }

    private Map<String, Object> publicTrap(Map<String, Object> source) {
        return map("trapId", source.get("trapId"), "grammarPointId", source.get("grammarPointId"), "trapCode", source.get("trapCode"),
                "wrongPattern", source.get("wrongPattern"), "correctRule", source.get("correctRule"), "explanationCn", source.get("explanationCn"),
                "contentVersionId", source.get("contentVersionId"));
    }

    private Map<String, Object> publicExercise(Map<String, Object> source) {
        Map<String, Object> view = new LinkedHashMap<>(source);
        view.remove("expectedAnswer");
        view.remove("correctOptions");
        view.remove("expectedOrder");
        view.remove("ruleCodes");
        return view;
    }

    private Map<String, Object> publicWritingPrompt(Map<String, Object> source) {
        Map<String, Object> view = new LinkedHashMap<>(source);
        for (String secret : List.of("expectedAnswer", "referenceAnswer", "answerKey", "correctOptions", "ruleCodes", "rubric", "scoringPoints")) {
            view.remove(secret);
        }
        return view;
    }

    private Map<String, Object> publicProofreading(Map<String, Object> source) {
        return map("issueId", source.get("exerciseId"), "promptId", source.get("promptId"), "errorType", source.get("errorType"),
                "wrongText", source.get("wrongText"), "wrongTextHash", source.get("wrongTextHash"), "explanation", source.get("explanation"),
                "contentVersionId", source.get("contentVersionId"));
    }

    private Map<String, Object> historyView(Map<String, Object> source) {
        Object data = source.get("data");
        if (!(data instanceof Map<?, ?> value)) return map("status", "UNAVAILABLE");
        Map<String, Object> view = new LinkedHashMap<>();
        for (String field : List.of("submissionId", "promptId", "score", "band", "ruleVersion", "matchedPointCodes", "reviewState")) {
            if (value.containsKey(field)) view.put(field, value.get(field));
        }
        return view;
    }

    private Map<String, Object> publicOfflinePackage(Map<String, Object> source) {
        Map<String, Object> view = new LinkedHashMap<>(source);
        view.remove("userId");
        return view;
    }

    private Map<String, Object> publicUserScoped(Map<String, Object> source) {
        Map<String, Object> view = new LinkedHashMap<>(source);
        view.remove("userId");
        return view;
    }

    private Map<String, Object> publicReadingQuestion(Map<String, Object> source) {
        Map<String, Object> view = new LinkedHashMap<>(source);
        view.remove("correctOption");
        return view;
    }

    private <T> Map<String, Object> owned(Map<String, Map<String, Object>> source, long userId, String id, String code) {
        Map<String, Object> value = source.get(id);
        if (value == null || userId != longValue(value.get("userId"), "userId")) throw error(code, "learning session does not exist", 404, false);
        return value;
    }

    private Map<String, Object> requireSourceSegment(String segmentId) {
        if (segmentId == null || segmentId.isBlank()) throw error("SOURCE_SEGMENT_REQUIRED", "录音必须绑定已发布的内容片段", 400, false);
        for (Map<String, Object> material : materials.values()) {
            Object rawSegments = material.get("segments");
            if (!(rawSegments instanceof Collection<?> segments)) continue;
            for (Object rawSegment : segments) {
                if (rawSegment instanceof Map<?, ?> segment && segmentId.equals(segment.get("segmentId"))) {
                    return (Map<String, Object>) segment;
                }
            }
        }
        throw error("SOURCE_SEGMENT_NOT_FOUND", "内容片段不存在或未发布", 404, false);
    }

    private static List<String> stringList(Object value, int limit) {
        if (!(value instanceof Collection<?> collection)) return List.of();
        return collection.stream().limit(limit).map(item -> text(item, "")).filter(item -> !item.isBlank()).toList();
    }

    private static List<Long> longList(Object value, int limit) {
        if (!(value instanceof Collection<?> collection)) return List.of();
        List<Long> result = new ArrayList<>();
        for (Object item : collection.stream().limit(limit).toList()) result.add(longValue(item, "id"));
        return result;
    }

    private static Map<String, String> stringMap(Object value) {
        if (!(value instanceof Map<?, ?> map)) return Map.of();
        Map<String, String> result = new LinkedHashMap<>();
        for (Map.Entry<?, ?> entry : map.entrySet()) result.put(text(entry.getKey(), ""), text(entry.getValue(), ""));
        return result;
    }

    private static Map<String, Double> doubleMap(Object value) {
        if (!(value instanceof Map<?, ?> map)) return Map.of();
        Map<String, Double> result = new LinkedHashMap<>();
        for (Map.Entry<?, ?> entry : map.entrySet()) {
            try { result.put(text(entry.getKey(), ""), Double.parseDouble(String.valueOf(entry.getValue()))); }
            catch (NumberFormatException ignored) { }
        }
        return result;
    }

    private static int intValue(Object value, String name) {
        if (value instanceof Number number) return number.intValue();
        try { return Integer.parseInt(String.valueOf(value)); }
        catch (Exception exception) { throw error("B3_SCHEMA_INVALID", name + " is required", 400, false); }
    }

    private static double doubleValue(Object value) {
        if (value instanceof Number number) return number.doubleValue();
        try { return Double.parseDouble(String.valueOf(value)); }
        catch (Exception ignored) { return 0d; }
    }

    private static Instant parseInstant(Object value, Instant fallback) {
        try { return value == null ? fallback : Instant.parse(String.valueOf(value)); }
        catch (Exception ignored) { return fallback; }
    }

    private void durableAttempt(long userId, String itemCode, Map<String, Object> body, double score,
                                Boolean correct, String feedbackCode, String fallbackClientEventId) {
        durableRepository.saveAttempt(new B3DurableRepository.Attempt(userId, itemCode,
                longValue(body.get("contentVersionId"), "contentVersionId"), fingerprint(body.get("answer")), score,
                correct, feedbackCode, text(body.get("clientAnswerId"), text(body.get("clientEventId"),
                        text(body.get("clientSubmissionId"), fallbackClientEventId)))));
    }

    private static long parseRangeStart(String range, long size) {
        if (range == null || range.isBlank()) return 0L;
        if (!range.matches("bytes=\\d+-\\d*")) throw error("MEDIA_RANGE_INVALID", "Range is invalid", 416, false);
        try { return Long.parseLong(range.substring(6).split("-", 2)[0]); }
        catch (NumberFormatException exception) { throw error("MEDIA_RANGE_INVALID", "Range is invalid", 416, false); }
    }

    private static long parseRangeEnd(String range, long size) {
        long start = parseRangeStart(range, size);
        if (start >= size) throw error("MEDIA_RANGE_INVALID", "Range is outside media", 416, false);
        if (range == null || range.isBlank()) return size - 1;
        String endValue = range.substring(6).split("-", 2)[1];
        if (endValue.isBlank()) return size - 1;
        try {
            long end = Long.parseLong(endValue);
            if (end < start) throw error("MEDIA_RANGE_INVALID", "Range is reversed", 416, false);
            return Math.min(end, size - 1);
        } catch (NumberFormatException exception) { throw error("MEDIA_RANGE_INVALID", "Range is invalid", 416, false); }
    }

    private Map<String, Object> ownedSession(long userId, String sessionId) {
        Map<String, Object> session = sessions.get(sessionId);
        if (session == null || ((Number) session.get("userId")).longValue() != userId) throw error("B3_SESSION_NOT_FOUND", "learning session does not exist", 404, false);
        return session;
    }

    private Map<String, Object> publicSession(Map<String, Object> session) {
        Map<String, Object> publicView = new LinkedHashMap<>(session);
        publicView.remove("userId");
        return publicView;
    }

    private Map<String, Object> publicRecording(Map<String, Object> recording) {
        Map<String, Object> publicView = new LinkedHashMap<>(recording);
        publicView.remove("userId");
        publicView.remove("contentHash");
        return publicView;
    }

    private Map<String, Object> articleSummary(Map<String, Object> article) {
        return map("articleId", article.get("articleId"), "title", article.get("title"), "cefrLevel", article.get("cefrLevel"), "wordCount", article.get("wordCount"), "estimatedMinutes", article.get("estimatedMinutes"), "contentVersionId", article.get("contentVersionId"), "rightsStatus", article.get("rightsStatus"));
    }

    private Map<String, Object> page(List<Map<String, Object>> items) { return envelope(map("items", items, "page", map("nextCursor", null, "hasMore", false, "serverTime", clock.instant().toString()))); }

    private Map<String, Object> idempotent(long userId, String scope, String key, Map<String, Object> body, Supplier<Map<String, Object>> action) {
        String identity = userId + ":" + scope + ":" + key;
        String requestFingerprint = fingerprint(body);
        synchronized (idempotency) {
            Map<String, Object> previous = idempotency.get(identity);
            if (previous != null) {
                if (!requestFingerprint.equals(idempotencyFingerprints.get(identity))) {
                    throw error("IDEMPOTENCY_CONFLICT", "Idempotency-Key was already used with a different request body", 409, false);
                }
                return previous;
            }
            Map<String, Object> created = action.get();
            idempotency.put(identity, created);
            idempotencyFingerprints.put(identity, requestFingerprint);
            return created;
        }
    }

    private long serverVersion(Object entityType, Object entityId) {
        return syncChanges.stream().filter(item -> String.valueOf(entityType).equals(item.get("entityType")) && String.valueOf(entityId).equals(item.get("entityId"))).mapToLong(item -> longValue(item.get("entityVersion"), "entityVersion")).max().orElse(0L);
    }

    private synchronized void emitEvent(String eventName, Map<String, Object> payload) {
        emittedEvents.add(map("eventName", eventName, "eventVersion", 1, "occurredAt", clock.instant().toString(), "payload", payload));
    }

    private Map<String, Object> envelope(Map<String, Object> data) { return map("requestId", "req_b3_" + UUID.randomUUID(), "serverTime", clock.instant().toString(), "data", data); }

    private static Map<String, Object> require(Map<Long, Map<String, Object>> source, long id, String code) { Map<String, Object> value = source.get(id); if (value == null) throw error(code, "resource does not exist", 404, false); return value; }
    private static B3Exception error(String code, String message, int status, boolean retryable) { return new B3Exception(code, message, status, retryable); }
    private static void requireKey(String key) { if (key == null || key.isBlank() || key.length() < 8 || key.length() > 96) throw error("B3_IDEMPOTENCY_REQUIRED", "Idempotency-Key must contain 8-96 characters", 400, false); }
    private static void requireContentVersion(Object value) {
        if (value == null) throw error("CONTENT_VERSION_REQUIRED", "contentVersionId is required", 400, false);
        long version = longValue(value, "contentVersionId");
        if (version != CONTENT_VERSION) throw error("CONTENT_VERSION_UNAVAILABLE", "contentVersionId is unsupported", 409, false);
    }
    private static int safeLimit(int limit) { return Math.max(1, Math.min(limit <= 0 ? 20 : limit, 100)); }
    private static long longValue(Object value, String name) { if (value instanceof Number number) return number.longValue(); try { return Long.parseLong(String.valueOf(value)); } catch (Exception exception) { throw error("B3_SCHEMA_INVALID", name + " is required", 400, false); } }
    private static String text(Object value, String fallback) { return value == null ? fallback : String.valueOf(value); }
    private static String fingerprint(Object value) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(canonical(value).getBytes(StandardCharsets.UTF_8));
            StringBuilder result = new StringBuilder(digest.length * 2);
            for (byte item : digest) result.append(String.format("%02x", item));
            return result.toString();
        } catch (Exception exception) {
            throw error("IDEMPOTENCY_FINGERPRINT_FAILED", "request fingerprint is unavailable", 500, true);
        }
    }
    private static String canonical(Object value) {
        if (value == null) return "null";
        if (value instanceof Map<?, ?> map) return map.entrySet().stream()
                .sorted(Comparator.comparing(entry -> String.valueOf(entry.getKey())))
                .map(entry -> quote(String.valueOf(entry.getKey())) + ":" + canonical(entry.getValue()))
                .collect(java.util.stream.Collectors.joining(",", "{", "}"));
        if (value instanceof Collection<?> collection) return collection.stream().map(B3MultimodalService::canonical).collect(java.util.stream.Collectors.joining(",", "[", "]"));
        if (value.getClass().isArray()) return "[array:" + value.getClass().getComponentType().getName() + "]";
        if (value instanceof Number || value instanceof Boolean) return String.valueOf(value);
        return quote(String.valueOf(value));
    }
    private static String quote(String value) { return "\"" + value.replace("\\", "\\\\").replace("\"", "\\\"") + "\""; }
    private static Map<String, Object> map(Object... values) { Map<String, Object> result = new LinkedHashMap<>(); for (int index = 0; index + 1 < values.length; index += 2) if (values[index + 1] != null) result.put(String.valueOf(values[index]), values[index + 1]); return result; }
}
