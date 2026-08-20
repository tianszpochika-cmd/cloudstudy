package com.englishflow.modules.onboarding;

import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

/** Deterministic, non-AI placement assessment for the Phase 1 first-day loop. */
@Service
public final class PlacementService {
    private final OnboardingProfileService profileService;
    private final Clock clock;
    private final ConcurrentMap<String, PlacementSession> sessions = new ConcurrentHashMap<>();
    private final ConcurrentMap<String, PlacementSubmitResponse> idempotentResponses = new ConcurrentHashMap<>();
    private final List<PlacementQuestion> questions = List.of(
            q("vocab-01", 1, "VOCABULARY", 2, "Which word is closest in meaning to rapid?", "quick", "slow", "quick", "quiet", "heavy"),
            q("vocab-02", 2, "VOCABULARY", 2, "What does except mean in this sentence?", "excluding", "including", "excluding", "beside", "before"),
            q("vocab-03", 3, "VOCABULARY", 3, "Which phrase means to make something better?", "improve it", "remove it", "repeat it", "improve it", "hide it"),
            q("grammar-01", 4, "GRAMMAR", 2, "If I ___ more time, I would join the group.", "had", "have", "will have", "am having", "had"),
            q("grammar-02", 5, "GRAMMAR", 3, "She has lived here ___ 2022.", "since", "since", "for", "during", "from"),
            q("grammar-03", 6, "GRAMMAR", 4, "The report, ___ was sent yesterday, needs review.", "which", "what", "which", "where", "who"),
            q("listening-01", 7, "LISTENING", 2, "The train leaves at half past nine. What time is it?", "9:30", "8:30", "9:00", "9:30", "10:30"),
            q("listening-02", 8, "LISTENING", 3, "Why was the meeting moved? The flight was delayed.", "A flight was late.", "A room was closed.", "The speaker was ill.", "The topic changed.", "A flight was late."),
            q("listening-03", 9, "LISTENING", 4, "What should the learner do? Reserve a seat in advance.", "Book a seat early.", "Book a seat early.", "Change the route.", "Arrive later.", "Cancel the trip."),
            q("scenario-01", 10, "SCENARIO", 4, "You need help at a station. Which is the clearest request?", "Could you show me where platform two is?", "Give platform.", "Could you show me where platform two is?", "I station.", "Platform now.")
    );

    @Autowired
    public PlacementService(OnboardingProfileService profileService) {
        this(profileService, Clock.systemUTC());
    }

    PlacementService(OnboardingProfileService profileService, Clock clock) {
        this.profileService = profileService;
        this.clock = clock;
    }

    public PlacementStartResponse start(long userId) {
        Instant now = clock.instant();
        PlacementSession session = new PlacementSession("placement_" + UUID.randomUUID().toString().replace("-", ""), userId, now);
        sessions.put(session.sessionId(), session);
        return PlacementStartResponse.from(session, publicQuestion(session, questions.get(0)));
    }

    public PlacementSubmitResponse submit(long userId, PlacementSubmitRequest request, String idempotencyKey) {
        if (request == null || request.effectiveSessionId() == null || request.questionId() == null || request.effectiveSelectedKey() == null) {
            throw new IllegalArgumentException("sessionId, questionId and selected answer are required");
        }
        String key = userId + ":" + request.effectiveSessionId() + ":" + (idempotencyKey == null ? "none" : idempotencyKey);
        PlacementSubmitResponse cached = idempotentResponses.get(key);
        if (cached != null) return cached;
        PlacementSession session = sessions.get(request.effectiveSessionId());
        if (session == null || session.userId() != userId) throw B1DomainException.notFound("placement session does not exist");
        if (session.status() != PlacementSession.Status.ACTIVE) throw B1DomainException.conflict("ASSESSMENT_NOT_ACTIVE", "placement session is not active");
        int index = session.answers().size();
        if (index >= questions.size()) throw B1DomainException.conflict("ASSESSMENT_COMPLETED", "placement session is complete");
        PlacementQuestion question = questions.get(index);
        if (!question.questionId().equals(request.questionId())) throw B1DomainException.conflict("QUESTION_OUT_OF_ORDER", "question is not the current item");
        int seconds = Math.max(0, Math.min(question.timeLimitSec(), request.timeSpentSec() == null ? question.timeLimitSec() : request.timeSpentSec()));
        boolean correct = question.correctKey().equalsIgnoreCase(request.effectiveSelectedKey());
        session.add(new PlacementAnswer(question.questionId(), request.effectiveSelectedKey(), correct, seconds, clock.instant()));
        PlacementSubmitResponse response;
        if (session.answers().size() == questions.size()) {
            PlacementReport report = calculate(session.answers());
            session.complete(report);
            profileService.applyPlacement(userId, report.cefrLevel(), report.estimatedVocabulary(), false);
            response = new PlacementSubmitResponse(true, null, report, session.answers().size(), session.status().name());
        } else {
            response = new PlacementSubmitResponse(false, publicQuestion(session, questions.get(session.answers().size())), null,
                    session.answers().size(), session.status().name());
        }
        idempotentResponses.putIfAbsent(key, response);
        return idempotentResponses.get(key);
    }

    public PlacementSubmitResponse skip(long userId, String fastTrackLevel, String idempotencyKey) {
        String key = userId + ":skip:" + (idempotencyKey == null ? fastTrackLevel : idempotencyKey);
        PlacementSubmitResponse cached = idempotentResponses.get(key);
        if (cached != null) return cached;
        PlacementSession session = new PlacementSession("skip_" + UUID.randomUUID().toString().replace("-", ""), userId, clock.instant());
        PlacementReport report = fastTrackReport(fastTrackLevel);
        session.skip(report);
        sessions.put(session.sessionId(), session);
        profileService.applyPlacement(userId, report.cefrLevel(), report.estimatedVocabulary(), true);
        PlacementSubmitResponse response = new PlacementSubmitResponse(true, null, report, 0, session.status().name());
        idempotentResponses.put(key, response);
        return response;
    }

    public PlacementReport report(String sessionId, long userId) {
        PlacementSession session = sessions.get(sessionId);
        if (session == null || session.userId() != userId || session.report() == null) throw B1DomainException.notFound("placement report does not exist");
        return session.report();
    }

    private PlacementReport calculate(List<PlacementAnswer> answers) {
        int correct = (int) answers.stream().filter(PlacementAnswer::correct).count();
        double accuracy = answers.isEmpty() ? 0 : (double) correct / answers.size();
        double speed = answers.isEmpty() ? 0 : answers.stream().mapToDouble(answer -> Math.max(0, 1 - answer.timeSpentSec() / 25.0)).average().orElse(0);
        int score = (int) Math.round(Math.min(100, accuracy * 70 + speed * 30));
        int level = score < 25 ? 1 : score < 45 ? 2 : score < 65 ? 3 : score < 80 ? 4 : score < 92 ? 5 : 6;
        String cefr = List.of("A1", "A2", "B1", "B2", "C1", "C2").get(level - 1);
        int vocab = new int[]{500, 1000, 2200, 4500, 6500, 9000}[level - 1] +
                (int) Math.round(new int[]{500, 1200, 2300, 2000, 2500, 3000}[level - 1] * dimensionScore(answers, "VOCABULARY") / 100.0);
        int grammar = dimensionScore(answers, "GRAMMAR");
        int listening = dimensionScore(answers, "LISTENING");
        String weakest = grammar <= listening && grammar <= dimensionScore(answers, "VOCABULARY") ? "语法" : listening <= dimensionScore(answers, "VOCABULARY") ? "听力" : "词汇";
        String advice = "VOCABULARY".equals(weakest) || grammar < 70 || listening < 70
                ? "最近的" + weakest + "表现更需要巩固，首周已增加对应短任务。"
                : "基础较均衡，首周按新学、复习与错题修复保持节奏。";
        return new PlacementReport(score, level, cefr, vocab,
                new PlacementRadarScores(dimensionScore(answers, "VOCABULARY"), grammar, listening, (int) Math.round(speed * 100), score),
                advice, "PLACEMENT", clock.instant());
    }

    private static int dimensionScore(List<PlacementAnswer> answers, String dimension) {
        // The question dimension is encoded in its stable id; this keeps the
        // assessment data independent of model/AI output.
        String prefix = switch (dimension) {
            case "VOCABULARY" -> "vocab";
            case "GRAMMAR" -> "grammar";
            case "LISTENING" -> "listening";
            default -> "scenario";
        };
        List<String> ids = answers.stream().map(PlacementAnswer::questionId).filter(id -> id.startsWith(prefix)).toList();
        return ids.isEmpty() ? 0 : (int) Math.round(ids.stream().filter(id -> answers.stream().anyMatch(a -> a.questionId().equals(id) && a.correct())).count() * 100.0 / ids.size());
    }

    private PlacementReport fastTrackReport(String value) {
        String key = value == null ? "ZERO_A1" : value.toUpperCase();
        return switch (key) {
            case "CET4_B1" -> new PlacementReport(48, 3, "B1", 3200, new PlacementRadarScores(60, 60, 60, 60, 60), "基于已有成绩快速定级，后续可重新测评。", "FAST_TRACK", clock.instant());
            case "CET6_B2", "POSTGRAD_B2_PLUS" -> new PlacementReport(64, 4, "B2", 5000, new PlacementRadarScores(60, 60, 60, 60, 60), "基于已有成绩快速定级，后续可重新测评。", "FAST_TRACK", clock.instant());
            default -> new PlacementReport(16, 1, "A1", 700, new PlacementRadarScores(60, 60, 60, 60, 60), "从 A1 基础开始，先建立每日微习惯。", "FAST_TRACK", clock.instant());
        };
    }

    private static PublicPlacementQuestion publicQuestion(PlacementSession session, PlacementQuestion question) {
        return new PublicPlacementQuestion(question.questionId(), session.sessionId(), question.stepIndex(), question.totalSteps(), question.dimension(), question.difficulty(), question.stemText(), question.helperText(), question.options(), question.timeLimitSec());
    }

    private static PlacementQuestion q(String id, int step, String dimension, int difficulty, String stem, String helper, String a, String b, String c, String d) {
        String correct = switch (step % 4) { case 1 -> "A"; case 2 -> "B"; case 3 -> "C"; default -> "D"; };
        return new PlacementQuestion(id, step, 10, dimension, difficulty, stem, dimension + " · 规则化测评",
                List.of(new PlacementOption("A", a), new PlacementOption("B", b), new PlacementOption("C", c), new PlacementOption("D", d)), correct, 25);
    }
}
