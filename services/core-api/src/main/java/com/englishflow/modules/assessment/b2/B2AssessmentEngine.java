package com.englishflow.modules.assessment.b2;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.Base64;
import java.util.Collection;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;
import java.util.function.Supplier;

import org.springframework.stereotype.Service;

/**
 * B2's deterministic assessment boundary.  The implementation is deliberately
 * dependency-light: the in-memory stores make the rules executable in the
 * current Core API while the V0011 schema preserves the durable boundary.
 */
@Service
public final class B2AssessmentEngine {
    public static final String ALGORITHM_VERSION = "ASM-DS-1";
    public static final String RULE_VERSION = "ASM-RULE-1";
    public static final List<String> QUESTION_TYPES = List.of(
            "CHOICE", "CONNECT_LINE", "DRAG_SORTER", "FILL_BLANK",
            "SPELL_INPUT", "LISTEN_CHOICE", "ERROR_CORRECTION", "TRANSLATION_INPUT");

    private static final ZoneId DEFAULT_ZONE = ZoneId.of("Asia/Shanghai");
    private static final String DAILY_SECRET = "daily_stream_secret_v1:test";
    private final AtomicLong exerciseSequence = new AtomicLong(120000);
    private final AtomicLong mistakeSequence = new AtomicLong(70000);
    private final AtomicLong verificationSequence = new AtomicLong(80000);
    private final AtomicLong reportSequence = new AtomicLong(90000);
    private final Map<Long, QuestionVersion> questions = new ConcurrentHashMap<>();
    private final Map<String, Session> sessions = new ConcurrentHashMap<>();
    private final Map<Long, Mistake> mistakes = new ConcurrentHashMap<>();
    private final Map<Long, Verification> verifications = new ConcurrentHashMap<>();
    private final Map<String, IdempotentResult> idempotency = new ConcurrentHashMap<>();
    private final Map<Long, Paper> papers = new ConcurrentHashMap<>();
    private final List<Attempt> attempts = Collections.synchronizedList(new ArrayList<>());

    public B2AssessmentEngine() {
        seedQuestions();
        seedPapers();
    }

    public List<String> registeredQuestionTypes() { return QUESTION_TYPES; }

    public Map<String, Object> dailyStream(long userId, LocalDate date, int requestedCount, String idempotencyKey) {
        LocalDate localDate = date == null ? LocalDate.now(DEFAULT_ZONE) : date;
        int count = normalizeTargetCount(requestedCount);
        Map<String, Object> body = Map.of("sessionType", "DAILY_STREAM", "targetCount", count, "date", localDate.toString());
        String key = idempotencyKey == null || idempotencyKey.isBlank()
                ? "daily:" + userId + ":" + localDate + ":" + count : idempotencyKey;
        return idempotent(userId, "assessment.daily-stream", key, body,
                () -> createAssessmentSessionInternal(userId, body, localDate));
    }

    public Map<String, Object> createAssessmentSession(long userId, Map<String, Object> request, String idempotencyKey) {
        Map<String, Object> body = copy(request);
        String sessionType = text(body.getOrDefault("sessionType", "DAILY_STREAM"));
        if (!Set.of("DAILY_STREAM", "QUICK_PRACTICE", "CHECKPOINT").contains(sessionType)) {
            throw invalid("sessionType is invalid");
        }
        String key = requireIdempotency(idempotencyKey);
        return idempotent(userId, "assessment.sessions", key, body,
                () -> createAssessmentSessionInternal(userId, body, LocalDate.now(DEFAULT_ZONE)));
    }

    public Map<String, Object> getSession(long userId, String sessionId) {
        return sessionView(ownedSession(userId, sessionId), false);
    }

    public Map<String, Object> submitAssessmentAnswer(long userId, String sessionId,
                                                       Map<String, Object> request, String idempotencyKey) {
        Session session = ownedSession(userId, sessionId);
        ensureWritable(session);
        Map<String, Object> body = copy(request);
        long exerciseId = longValue(body.get("exerciseId"), "exerciseId");
        Exercise exercise = exercise(session, exerciseId);
        String key = firstNonBlank(idempotencyKey, text(body.get("clientSubmissionId")));
        key = requireIdempotency(key);
        return idempotent(userId, "assessment.answers." + sessionId, key, body,
                () -> scoreAndStore(session, exercise, body, false));
    }

    public Map<String, Object> saveCheckpoint(long userId, String sessionId,
                                               Map<String, Object> request, String idempotencyKey) {
        Session session = ownedSession(userId, sessionId);
        ensureWritable(session);
        Map<String, Object> body = copy(request);
        String key = requireIdempotency(idempotencyKey);
        return idempotent(userId, "assessment.checkpoint." + sessionId, key, body, () -> {
            long sequence = longValue(body.get("checkpointSeq"), "checkpointSeq");
            synchronized (session) {
                if (sequence < session.lastCheckpointSeq) {
                    throw conflict("ASM_CHECKPOINT_CONFLICT", "checkpointSeq cannot move backwards");
                }
                session.lastCheckpointSeq = sequence;
                session.lastCheckpoint = new LinkedHashMap<>(body);
            }
            return Map.of("requestId", requestId(), "serverNow", Instant.now().toString(),
                    "acceptedCheckpointSeq", session.lastCheckpointSeq);
        });
    }

    public Map<String, Object> completeAssessment(long userId, String sessionId, String idempotencyKey) {
        Session session = ownedSession(userId, sessionId);
        String key = requireIdempotency(idempotencyKey);
        return idempotent(userId, "assessment.complete." + sessionId, key, Map.of(), () -> {
            synchronized (session) {
                if (session.status == Status.COMPLETED) return sessionCompletion(session);
                if (session.status == Status.CANCELLED || session.status == Status.EXPIRED) {
                    throw conflict("ASM_SESSION_STATE_CONFLICT", "session is not completable");
                }
                session.status = Status.COMPLETED;
                session.closedAt = Instant.now();
            }
            return sessionCompletion(session);
        });
    }

    public Map<String, Object> assessmentReport(long userId, String sessionId) {
        Session session = ownedSession(userId, sessionId);
        if (session.status != Status.COMPLETED && session.status != Status.AUTO_SUBMITTED) {
            throw new B2AssessmentException("ASM_REPORT_PROCESSING", "report is not ready", 202, true);
        }
        double score = 0d;
        double max = 0d;
        Map<String, Integer> byType = new LinkedHashMap<>();
        for (Exercise exercise : session.exercises) {
            Attempt attempt = session.latest.get(exercise.id);
            if (attempt == null || attempt.score == null) continue;
            score += attempt.score.score;
            max += attempt.score.maxScore;
            byType.merge(exercise.questionType, 1, Integer::sum);
        }
        return Map.of("requestId", requestId(), "data", reportMap(reportSequence.incrementAndGet(), "DAILY", score, max,
                Map.of("completedCount", session.latest.size(), "totalCount", session.exercises.size(), "questionTypeCounts", byType), session));
    }

    public Map<String, Object> listPapers(String examCode) {
        List<Map<String, Object>> items = new ArrayList<>();
        for (Paper paper : papers.values()) {
            if (examCode == null || examCode.isBlank() || paper.examCode.equals(examCode)) items.add(paperView(paper));
        }
        return page(items, null, 20);
    }

    public Map<String, Object> getPaper(long paperId) {
        Paper paper = papers.get(paperId);
        if (paper == null) throw notFound("paper not found");
        return Map.of("requestId", requestId(), "data", paperView(paper));
    }

    public Map<String, Object> createExamSession(long userId, Map<String, Object> request, String idempotencyKey) {
        Map<String, Object> body = copy(request);
        String key = requireIdempotency(idempotencyKey);
        return idempotent(userId, "exam.sessions", key, body, () -> {
            long paperId = body.containsKey("paperId") ? longValue(body.get("paperId"), "paperId") : 1001L;
            Paper paper = papers.get(paperId);
            if (paper == null) throw notFound("paper not found");
            Session session = new Session(UUID.randomUUID().toString(), userId, "MOCK_EXAM", true);
            session.startedAt = Instant.now();
            session.deadlineAt = session.startedAt.plusSeconds(paper.durationSec);
            session.paperId = paper.id;
            session.examCode = text(body.getOrDefault("examCode", paper.examCode));
            int position = 1;
            for (Long questionId : paper.questionIds) {
                QuestionVersion q = questions.get(questionId);
                if (q != null) session.exercises.add(materialize(session, q, "EXAM", null, position++));
            }
            sessions.put(session.id, session);
            return sessionView(session, true);
        });
    }

    public Map<String, Object> getExamSession(long userId, String sessionId) {
        Session session = ownedSession(userId, sessionId);
        if (!session.exam) throw conflict("ASM_SESSION_STATE_CONFLICT", "not an exam session");
        autoSubmitIfExpired(session);
        return sessionView(session, true);
    }

    public Map<String, Object> examHeartbeat(long userId, String sessionId, Map<String, Object> request, String idempotencyKey) {
        Session session = ownedExam(userId, sessionId);
        Map<String, Object> body = copy(request);
        String key = requireIdempotency(idempotencyKey);
        return idempotent(userId, "exam.heartbeat." + sessionId, key, body, () -> {
            autoSubmitIfExpired(session);
            session.lastHeartbeatAt = Instant.now();
            if ("HIDDEN".equals(text(body.get("visibilityState"))) || "BLURRED".equals(text(body.get("focusState")))) {
                recordAntiCheatInternal(session, body, "FOCUS_LOST");
            }
            long clientEpoch = body.containsKey("clientEpochMs") ? longValue(body.get("clientEpochMs"), "clientEpochMs") : 0L;
            long offset = clientEpoch == 0L ? 0L : System.currentTimeMillis() - clientEpoch;
            return Map.of("requestId", requestId(), "serverNow", Instant.now().toString(),
                    "status", session.status.name(), "remainingSec", remainingSeconds(session), "clockOffsetMs", offset);
        });
    }

    public Map<String, Object> recordAntiCheatEvent(long userId, String sessionId, Map<String, Object> request, String idempotencyKey) {
        Session session = ownedExam(userId, sessionId);
        Map<String, Object> body = copy(request);
        String key = firstNonBlank(idempotencyKey, text(body.get("clientEventId")));
        key = requireIdempotency(key);
        return idempotent(userId, "exam.anti-cheat." + sessionId, key, body, () -> {
            String type = text(body.get("eventType"));
            if (!ANTI_CHEAT_TYPES.contains(type)) throw invalid("eventType is invalid");
            recordAntiCheatInternal(session, body, type);
            return Map.of("requestId", requestId(), "accepted", true, "serverNow", Instant.now().toString(),
                    "riskLevel", session.riskLevel);
        });
    }

    public Map<String, Object> examAnswerSheet(long userId, String sessionId) {
        Session session = ownedExam(userId, sessionId);
        List<Map<String, Object>> items = new ArrayList<>();
        for (Exercise exercise : session.exercises) {
            Attempt answer = session.latest.get(exercise.id);
            items.add(Map.of("exerciseId", exercise.id, "position", exercise.position,
                    "status", answer == null ? "UNANSWERED" : "ANSWERED",
                    "reviewMark", session.reviewMarks.getOrDefault(exercise.id, "NONE")));
        }
        return Map.of("requestId", requestId(), "data", Map.of("sessionId", session.id, "items", items));
    }

    public Map<String, Object> updateAnswerSheetMark(long userId, String sessionId,
                                                       Map<String, Object> request, String idempotencyKey) {
        Session session = ownedExam(userId, sessionId);
        Map<String, Object> body = copy(request);
        String key = requireIdempotency(idempotencyKey);
        return idempotent(userId, "exam.answer-sheet.mark." + sessionId, key, body, () -> {
            long exerciseId = longValue(body.get("exerciseId"), "exerciseId");
            exercise(session, exerciseId);
            String mark = text(body.getOrDefault("reviewMark", "NONE"));
            if (!Set.of("NONE", "REVIEW").contains(mark)) throw invalid("reviewMark is invalid");
            session.reviewMarks.put(exerciseId, mark);
            return examAnswerSheet(userId, sessionId);
        });
    }

    public Map<String, Object> submitExamAnswer(long userId, String sessionId,
                                                 Map<String, Object> request, String idempotencyKey) {
        Session session = ownedExam(userId, sessionId);
        ensureWritable(session);
        Map<String, Object> body = copy(request);
        long exerciseId = longValue(body.get("exerciseId"), "exerciseId");
        Exercise exercise = exercise(session, exerciseId);
        String key = firstNonBlank(idempotencyKey, text(body.get("clientSubmissionId")));
        key = requireIdempotency(key);
        return idempotent(userId, "exam.answers." + sessionId, key, body, () -> {
            synchronized (session) {
                if (session.deadlineAt != null && Instant.now().isAfter(session.deadlineAt)) {
                    throw conflict("ASM_SESSION_STATE_CONFLICT", "exam deadline has passed");
                }
                int revision = intValue(body.getOrDefault("revision", 1), "revision");
                Attempt previous = session.latest.get(exercise.id);
                if (previous != null && revision <= previous.revision) {
                    throw conflict("ASM_REVISION_CONFLICT", "revision must increase");
                }
                Attempt attempt = new Attempt(session.id, exercise.id, revision, text(body.get("clientSubmissionId")),
                        answerMap(body.get("answer")), Instant.now(), bodyHash(body), null);
                session.latest.put(exercise.id, attempt);
                attempts.add(attempt);
                session.lastCheckpointSeq++;
            }
            Map<String, Object> accepted = new LinkedHashMap<>();
            accepted.put("requestId", requestId());
            accepted.put("exerciseId", exercise.id);
            accepted.put("accepted", true);
            accepted.put("revision", intValue(body.getOrDefault("revision", 1), "revision"));
            accepted.put("scoringStatus", "ACCEPTED");
            accepted.put("isCorrect", null);
            accepted.put("score", null);
            accepted.put("maxScore", null);
            accepted.put("serverNow", Instant.now().toString());
            return accepted;
        });
    }

    public Map<String, Object> saveExamCheckpoint(long userId, String sessionId,
                                                   Map<String, Object> request, String idempotencyKey) {
        return saveCheckpoint(userId, sessionId, request, idempotencyKey);
    }

    public Map<String, Object> submitExam(long userId, String sessionId, String idempotencyKey) {
        Session session = ownedExam(userId, sessionId);
        String key = requireIdempotency(idempotencyKey);
        return idempotent(userId, "exam.submit." + sessionId, key, Map.of(), () -> finalizeExam(session, false));
    }

    public Map<String, Object> getExamReport(long userId, String sessionId) {
        Session session = ownedExam(userId, sessionId);
        if (session.report == null) throw new B2AssessmentException("ASM_REPORT_PROCESSING", "report is not ready", 202, true);
        return Map.of("requestId", requestId(), "data", session.report);
    }

    public Map<String, Object> examHistory(long userId, String examCode) {
        List<Map<String, Object>> items = new ArrayList<>();
        for (Session session : sessions.values()) {
            if (session.userId == userId && session.exam && (examCode == null || examCode.isBlank() || examCode.equals(session.examCode))) {
                Map<String, Object> item = new LinkedHashMap<>();
                item.put("sessionId", session.id);
                item.put("examCode", session.examCode);
                item.put("status", session.status.name());
                item.put("completedAt", session.closedAt == null ? null : session.closedAt.toString());
                item.put("reportId", session.report == null ? null : session.report.get("reportId"));
                items.add(item);
            }
        }
        items.sort(Comparator.comparing(item -> String.valueOf(item.get("sessionId"))));
        return page(items, null, 20);
    }

    public Map<String, Object> masteryOverview(long userId) {
        int pendingRetry = 0, d1 = 0, d7 = 0, mastered = 0, consolidated = 0;
        for (Mistake mistake : mistakes.values()) if (mistake.userId == userId) {
            switch (mistake.mistakeStatus) {
                case "PENDING_RETRY", "REOPENED" -> pendingRetry++;
                case "DELAY_VERIFY_D1" -> d1++;
                case "DELAY_VERIFY_D7" -> d7++;
                case "MASTERED" -> mastered++;
                default -> { }
            }
            if ("CONSOLIDATED".equals(mistake.masteryStatus)) consolidated++;
        }
        return Map.of("requestId", requestId(), "data", Map.of("dueReviewCount", pendingRetry + d1 + d7,
                "pendingRetryCount", pendingRetry, "d1DueCount", d1, "d7DueCount", d7,
                "masteredCount", mastered, "consolidatedCount", consolidated));
    }

    public Map<String, Object> listMistakes(long userId, Map<String, String> filters) {
        List<Map<String, Object>> items = new ArrayList<>();
        for (Mistake mistake : mistakes.values()) if (mistake.userId == userId && matches(mistake, filters)) items.add(mistakeView(mistake));
        items.sort(Comparator.comparing(item -> String.valueOf(item.get("nextActionAt"))));
        return page(items, filters == null ? null : filters.get("cursor"), limit(filters == null ? null : filters.get("limit")));
    }

    public Map<String, Object> getMistake(long userId, long mistakeId) {
        Mistake mistake = ownedMistake(userId, mistakeId);
        return Map.of("requestId", requestId(), "data", mistakeView(mistake));
    }

    public Map<String, Object> startMistakeRetry(long userId, long mistakeId, String idempotencyKey) {
        Mistake mistake = ownedMistake(userId, mistakeId);
        String key = requireIdempotency(idempotencyKey);
        return idempotent(userId, "mastery.retry." + mistakeId, key, Map.of("mistakeId", mistakeId), () -> {
            QuestionVersion q = questions.get(mistake.questionId);
            if (q == null) throw notFound("question version not found");
            Verification verification = new Verification(verificationSequence.incrementAndGet(), mistake.id, userId, "D0", Instant.now());
            verification.exerciseId = exerciseSequence.incrementAndGet();
            verifications.put(verification.id, verification);
            return Map.of("requestId", requestId(), "verificationId", verification.id, "mistakeId", mistake.id,
                    "stage", "D0", "dueAt", verification.dueAt.toString(), "question", publicQuestion(q));
        });
    }

    public Map<String, Object> listVerifications(long userId, String stage, String result) {
        List<Map<String, Object>> items = new ArrayList<>();
        for (Verification verification : verifications.values()) if (verification.userId == userId
                && (stage == null || stage.isBlank() || stage.equals(verification.stage))
                && (result == null || result.isBlank() || result.equals(verification.result))) items.add(verificationView(verification));
        items.sort(Comparator.comparing(item -> String.valueOf(item.get("dueAt"))));
        return page(items, null, 50);
    }

    public Map<String, Object> submitVerification(long userId, long verificationId,
                                                   Map<String, Object> request, String idempotencyKey) {
        Verification verification = verifications.get(verificationId);
        if (verification == null || verification.userId != userId) throw notFound("verification not found");
        Map<String, Object> body = copy(request);
        String key = firstNonBlank(idempotencyKey, text(body.get("clientSubmissionId")));
        key = requireIdempotency(key);
        return idempotent(userId, "mastery.verification." + verificationId, key, body, () -> {
            String stage = text(body.get("stage"));
            if (!verification.stage.equals(stage)) throw conflict("ASM_STAGE_CONFLICT", "verification stage does not match");
            if (verification.result.equals("PASSED") || verification.result.equals("FAILED")) return verificationView(verification);
            if (Instant.now().isBefore(verification.dueAt)) {
                verification.result = "NOT_DUE";
                return verificationView(verification);
            }
            Mistake mistake = ownedMistake(userId, verification.mistakeId);
            QuestionVersion question = questions.get(mistake.questionId);
            Score score = score(question, answerMap(body.get("answer")), false);
            verification.score = score.score;
            verification.maxScore = score.maxScore;
            verification.submittedAt = Instant.now();
            if (score.isCorrect != null && score.isCorrect) {
                verification.result = "PASSED";
                advanceMastery(mistake, verification);
            } else {
                verification.result = "FAILED";
                mistake.mistakeStatus = "PENDING_RETRY";
                mistake.masteryStatus = "LEARNING";
                mistake.nextActionAt = Instant.now();
                mistake.reasonTrace.add(Map.of("ruleVersion", RULE_VERSION, "stage", stage, "result", "FAILED"));
            }
            return verificationView(verification);
        });
    }

    public Map<String, Object> dailyReport(long userId, LocalDate date) {
        LocalDate target = date == null ? LocalDate.now(DEFAULT_ZONE) : date;
        return report(userId, "DAILY", target, target);
    }

    public Map<String, Object> weeklyReport(long userId, LocalDate weekStart) {
        LocalDate start = weekStart == null ? LocalDate.now(DEFAULT_ZONE).with(java.time.DayOfWeek.MONDAY) : weekStart;
        return report(userId, "WEEKLY", start, start.plusDays(6));
    }

    public Map<String, Object> createShareAsset(long userId, Map<String, Object> request, String idempotencyKey) {
        String key = requireIdempotency(idempotencyKey);
        Map<String, Object> body = copy(request);
        return idempotent(userId, "mastery.share-assets", key, body, () -> {
            long reportId = longValue(body.get("reportId"), "reportId");
            return Map.of("requestId", requestId(), "data", Map.of("shareAssetId", "share_" + reportId + "_" + userId,
                    "expiresAt", Instant.now().plus(Duration.ofDays(7)).toString(), "downloadUrl", "https://invalid.local/share/" + reportId));
        });
    }

    private Map<String, Object> createAssessmentSessionInternal(long userId, Map<String, Object> body, LocalDate date) {
        String type = text(body.getOrDefault("sessionType", "DAILY_STREAM"));
        int target = normalizeTargetCount(intValue(body.getOrDefault("targetCount", type.equals("DAILY_STREAM") ? 15 : 5), "targetCount"));
        Session session = new Session(UUID.randomUUID().toString(), userId, type, false);
        session.startedAt = Instant.now();
        session.streamRevision = text(body.getOrDefault("streamRevision", "r1"));
        session.seed = stableSeed(userId, date, text(body.getOrDefault("planVersion", "phase1")), session.streamRevision);
        session.requestedQuota = quota(target);
        List<QuestionVersion> selected = selectDailyCandidates(target, session.seed, session.requestedQuota);
        int position = 1;
        for (QuestionVersion q : selected) session.exercises.add(materialize(session, q, q.sourceBucket, q.verificationStage, position++));
        session.actualQuota = countBuckets(session.exercises);
        session.degraded = selected.size() < target;
        if (session.degraded) session.degradeReasons.add("CANDIDATE_SHORTFALL");
        sessions.put(session.id, session);
        return sessionView(session, false);
    }

    private List<QuestionVersion> selectDailyCandidates(int target, String seed, Map<String, Integer> quota) {
        Map<String, List<QuestionVersion>> pools = new LinkedHashMap<>();
        for (String bucket : List.of("NEW", "REVIEW", "MISTAKE")) {
            List<QuestionVersion> pool = new ArrayList<>();
            for (QuestionVersion q : questions.values()) if (bucket.equals(q.sourceBucket)) pool.add(q);
            pool.sort(Comparator.comparing(q -> sha256(seed + "|" + q.sourceBucket + "|" + q.id + "|" + q.itemId)));
            pools.put(bucket, pool);
        }
        List<QuestionVersion> result = new ArrayList<>();
        Set<Long> usedItems = new LinkedHashSet<>();
        Map<String, List<String>> borrowOrder = Map.of("NEW", List.of("REVIEW", "MISTAKE"),
                "REVIEW", List.of("MISTAKE", "NEW"), "MISTAKE", List.of("REVIEW", "NEW"));
        for (String bucket : List.of("NEW", "REVIEW", "MISTAKE")) {
            int needed = quota.getOrDefault(bucket, 0);
            int before = result.size();
            addFromPool(result, usedItems, pools.get(bucket), needed);
            int missing = needed - (result.size() - before);
            for (String fallback : borrowOrder.get(bucket)) if (missing > 0) {
                int borrowedBefore = result.size();
                addFromPool(result, usedItems, pools.get(fallback), missing);
                missing -= result.size() - borrowedBefore;
            }
        }
        if (result.size() > target) return result.subList(0, target);
        return result;
    }

    private void addFromPool(List<QuestionVersion> result, Set<Long> usedItems, List<QuestionVersion> pool, int count) {
        if (pool == null || count <= 0) return;
        int added = 0;
        for (QuestionVersion q : pool) {
            if (added >= count) break;
            if (usedItems.add(q.itemId)) { result.add(q); added++; }
        }
    }

    private int countSource(List<QuestionVersion> values, String source) {
        int count = 0;
        for (QuestionVersion q : values) if (source.equals(q.sourceBucket)) count++;
        return count;
    }

    private Map<String, Object> scoreAndStore(Session session, Exercise exercise, Map<String, Object> body, boolean exam) {
        synchronized (session) {
            if (session.status == Status.SUBMITTING || session.status == Status.COMPLETED || session.status == Status.AUTO_SUBMITTED) {
                throw conflict("ASM_SESSION_STATE_CONFLICT", "session is closed");
            }
            if (session.deadlineAt != null && Instant.now().isAfter(session.deadlineAt)) {
                throw conflict("ASM_SESSION_STATE_CONFLICT", "deadline has passed");
            }
            int revision = intValue(body.getOrDefault("revision", 1), "revision");
            Attempt previous = session.latest.get(exercise.id);
            if (previous != null && revision <= previous.revision) throw conflict("ASM_REVISION_CONFLICT", "revision must increase");
            Map<String, Object> answer = answerMap(body.get("answer"));
            Score score = score(questions.get(exercise.questionId), answer, false);
            Attempt attempt = new Attempt(session.id, exercise.id, revision, text(body.get("clientSubmissionId")), answer,
                    Instant.now(), bodyHash(body), score);
            session.latest.put(exercise.id, attempt);
            attempts.add(attempt);
            session.lastCheckpointSeq++;
            if (score.isCorrect != null && !score.isCorrect && hasAttempted(answer)) registerMistake(session, exercise, score, answer);
            Map<String, Object> result = new LinkedHashMap<>();
            result.put("requestId", requestId());
            result.put("exerciseId", exercise.id);
            result.put("accepted", true);
            result.put("revision", revision);
            result.put("scoringStatus", score.status);
            result.put("isCorrect", score.isCorrect);
            result.put("score", score.score);
            result.put("maxScore", score.maxScore);
            result.put("errorCauseCandidates", score.errors);
            result.put("masteryEffect", score.isCorrect != null && !score.isCorrect
                    ? Map.of("status", "LEARNING", "mistakeCreated", true) : Map.of("status", "UNCHANGED"));
            result.put("feedback", score.feedback);
            result.put("serverNow", Instant.now().toString());
            return result;
        }
    }

    private Score score(QuestionVersion question, Map<String, Object> answer, boolean exam) {
        if (question == null) return new Score(0d, 0d, null, "REJECTED", List.of("OTHER"), "QUESTION_NOT_FOUND");
        return switch (question.type) {
            case "CHOICE", "LISTEN_CHOICE" -> scoreChoice(question, answer);
            case "FILL_BLANK" -> scoreFillBlank(question, answer);
            case "DRAG_SORTER" -> scoreDragSorter(question, answer);
            default -> new Score(0d, question.maxScore, null, "PENDING_MANUAL", List.of(), "规则扩展位已保留，等待对应评分器");
        };
    }

    private Score scoreChoice(QuestionVersion question, Map<String, Object> answer) {
        Set<String> actual = new LinkedHashSet<>(asStringList(answer.get("selectedOptionKeys")));
        Set<String> expected = new LinkedHashSet<>(asStringList(question.expected.get("selectedOptionKeys")));
        boolean correct = !actual.isEmpty() && actual.equals(expected);
        double score = correct ? question.maxScore : 0d;
        String error = correct ? null : errorFor(question, "CHOICE");
        return new Score(score, question.maxScore, correct, "SCORED", error == null ? List.of() : List.of(error), correct ? "回答正确" : "请根据解析复习该知识点");
    }

    private Score scoreFillBlank(QuestionVersion question, Map<String, Object> answer) {
        Object raw = answer.get("blanks");
        if (!(raw instanceof Collection<?> values)) return new Score(0d, question.maxScore, false, "SCORED", List.of("SPELLING_WRONG"), "请完成所有空格");
        Map<String, List<String>> expected = new HashMap<>();
        Object expectedRaw = question.expected.get("blanks");
        if (expectedRaw instanceof Map<?, ?> map) for (Map.Entry<?, ?> entry : map.entrySet()) expected.put(String.valueOf(entry.getKey()), asStringList(entry.getValue()));
        int correct = 0;
        for (Object value : values) if (value instanceof Map<?, ?> item) {
            String id = String.valueOf(item.get("blankId"));
            String text = normalizeText(item.get("text"));
            List<String> accepted = expected.getOrDefault(id, List.of());
            if (accepted.stream().map(B2AssessmentEngine::normalizeText).anyMatch(text::equals)) correct++;
        }
        int total = Math.max(expected.size(), 1);
        boolean isCorrect = correct == total;
        return new Score(question.maxScore * correct / total, question.maxScore, isCorrect, "SCORED",
                isCorrect ? List.of() : List.of(correct == 0 ? "SPELLING_WRONG" : "GRAMMAR_FORM"),
                isCorrect ? "全部填空正确" : "逐空检查拼写和词形");
    }

    private Score scoreDragSorter(QuestionVersion question, Map<String, Object> answer) {
        List<String> actual = asStringList(answer.get("orderedTokenIds"));
        List<String> expected = asStringList(question.expected.get("orderedTokenIds"));
        if (actual.size() != new LinkedHashSet<>(actual).size() || !new LinkedHashSet<>(expected).containsAll(actual)) {
            return new Score(0d, question.maxScore, false, "SCORED", List.of("DRAG_MISOPERATION"), "请检查每个词块是否只出现一次");
        }
        int positions = 0;
        for (int i = 0; i < Math.min(actual.size(), expected.size()); i++) if (actual.get(i).equals(expected.get(i))) positions++;
        boolean correct = actual.equals(expected);
        return new Score(correct ? question.maxScore : question.maxScore * positions / Math.max(expected.size(), 1), question.maxScore,
                correct, "SCORED", correct ? List.of() : List.of("SENTENCE_STRUCTURE_ERROR"), correct ? "语序正确" : "请复习句子结构");
    }

    private void registerMistake(Session session, Exercise exercise, Score score, Map<String, Object> answer) {
        String error = score.errors.isEmpty() ? "OTHER" : score.errors.get(0);
        Mistake existing = mistakes.values().stream().filter(item -> item.userId == session.userId && item.itemId == exercise.itemId
                && error.equals(item.errorCategory) && !"MASTERED".equals(item.mistakeStatus)).findFirst().orElse(null);
        if (existing != null) {
            existing.wrongCount++;
            existing.lastErrorAt = Instant.now();
            existing.mistakeStatus = "PENDING_RETRY";
            existing.masteryStatus = "LEARNING";
            existing.nextActionAt = Instant.now();
            existing.reasonTrace.add(Map.of("ruleVersion", RULE_VERSION, "event", "REOPENED"));
            return;
        }
        Mistake mistake = new Mistake(mistakeSequence.incrementAndGet(), session.userId, exercise.itemId, exercise.questionId, error);
        mistake.wrongAnswerAvailable = answer != null && !answer.isEmpty();
        mistake.reasonTrace.add(Map.of("ruleVersion", RULE_VERSION, "questionType", questions.get(exercise.questionId).type,
                "sourceBucket", exercise.sourceBucket));
        mistakes.put(mistake.id, mistake);
    }

    private void advanceMastery(Mistake mistake, Verification verification) {
        if ("D0".equals(verification.stage)) {
            mistake.mistakeStatus = "DELAY_VERIFY_D1";
            mistake.d0CorrectedAt = Instant.now();
            mistake.d1DueAt = mistake.d0CorrectedAt.plus(Duration.ofHours(24));
            mistake.d7DueAt = mistake.d0CorrectedAt.plus(Duration.ofHours(168));
            mistake.nextActionAt = mistake.d1DueAt;
            Verification d1 = new Verification(verificationSequence.incrementAndGet(), mistake.id, mistake.userId, "D1", mistake.d1DueAt);
            d1.exerciseId = exerciseSequence.incrementAndGet();
            verifications.put(d1.id, d1);
            Verification d7 = new Verification(verificationSequence.incrementAndGet(), mistake.id, mistake.userId, "D7", mistake.d7DueAt);
            d7.exerciseId = exerciseSequence.incrementAndGet();
            verifications.put(d7.id, d7);
        } else if ("D1".equals(verification.stage)) {
            if (!"DELAY_VERIFY_D1".equals(mistake.mistakeStatus)) throw conflict("ASM_STAGE_CONFLICT", "D1 is not pending");
            mistake.mistakeStatus = "DELAY_VERIFY_D7";
            mistake.d1VerifiedAt = Instant.now();
            mistake.nextActionAt = mistake.d7DueAt;
        } else if ("D7".equals(verification.stage)) {
            if (!"DELAY_VERIFY_D7".equals(mistake.mistakeStatus)) throw conflict("ASM_STAGE_CONFLICT", "D7 is not pending");
            mistake.mistakeStatus = "MASTERED";
            mistake.masteryStatus = "MASTERED";
            mistake.d7VerifiedAt = Instant.now();
            mistake.resolvedAt = mistake.d7VerifiedAt;
            mistake.nextActionAt = null;
        }
    }

    private Map<String, Object> finalizeExam(Session session, boolean automatic) {
        synchronized (session) {
            if (session.report != null) return Map.of("requestId", requestId(), "data", session.report);
            session.status = automatic ? Status.AUTO_SUBMITTED : Status.SUBMITTING;
            double score = 0d, max = 0d;
            Map<String, Integer> byType = new LinkedHashMap<>();
            for (Exercise exercise : session.exercises) {
                Score itemScore = new Score(0d, questions.get(exercise.questionId).maxScore, false, "SCORED", List.of("OTHER"), "未作答");
                Attempt attempt = session.latest.get(exercise.id);
                if (attempt != null) itemScore = score(questions.get(exercise.questionId), attempt.answer, true);
                score += itemScore.score;
                max += itemScore.maxScore;
                byType.merge(questions.get(exercise.questionId).type, itemScore.isCorrect != null && itemScore.isCorrect ? 1 : 0, Integer::sum);
            }
            session.closedAt = Instant.now();
            session.status = automatic ? Status.AUTO_SUBMITTED : Status.COMPLETED;
            session.report = reportMap(reportSequence.incrementAndGet(), "EXAM_DIAGNOSTIC", score, max,
                    Map.of("accuracy", max == 0d ? 0d : score / max, "correctByQuestionType", byType,
                            "antiCheatStatus", session.riskLevel), session);
            return Map.of("requestId", requestId(), "data", session.report);
        }
    }

    private Map<String, Object> report(long userId, String type, LocalDate start, LocalDate end) {
        Instant from = start.atStartOfDay(DEFAULT_ZONE).toInstant();
        Instant to = end.plusDays(1).atStartOfDay(DEFAULT_ZONE).toInstant();
        int submitted = 0, correct = 0;
        Set<Long> mastered = new LinkedHashSet<>();
        Map<String, Integer> errors = new LinkedHashMap<>();
        synchronized (attempts) {
            for (Attempt attempt : attempts) if (attempt.serverReceivedAt.isAfter(from) && attempt.serverReceivedAt.isBefore(to)) {
                Session session = sessions.get(attempt.sessionId);
                if (session != null && session.userId == userId && attempt.score != null) {
                    submitted++;
                    if (Boolean.TRUE.equals(attempt.score.isCorrect)) correct++;
                    for (String error : attempt.score.errors) errors.merge(error, 1, Integer::sum);
                }
            }
        }
        for (Mistake mistake : mistakes.values()) if (mistake.userId == userId && "MASTERED".equals(mistake.masteryStatus)
                && mistake.d7VerifiedAt != null && !mistake.d7VerifiedAt.isBefore(from) && mistake.d7VerifiedAt.isBefore(to)) mastered.add(mistake.itemId);
        Map<String, Object> metrics = new LinkedHashMap<>();
        metrics.put("submittedCount", submitted);
        metrics.put("correctCount", correct);
        metrics.put("accuracy", submitted == 0 ? 0d : (double) correct / submitted);
        metrics.put("masteredIncrement", mastered.size());
        metrics.put("errorCategoryCounts", errors);
        Map<String, Object> report = reportMap(reportSequence.incrementAndGet(), type, null, null, metrics, null);
        return Map.of("requestId", requestId(), "data", report);
    }

    private Map<String, Object> reportMap(long id, String type, Double score, Double max, Map<String, Object> metrics, Session session) {
        Map<String, Object> report = new LinkedHashMap<>();
        report.put("reportId", id);
        report.put("reportType", type);
        report.put("status", "READY");
        report.put("score", score);
        report.put("reportedMaxScore", max);
        report.put("percentile", null);
        report.put("cohortCount", null);
        report.put("calculationVersion", "ASM-REPORT-1");
        report.put("metrics", metrics);
        report.put("evidence", List.of(Map.of("source", "asm_answer_submission", "calculationVersion", "ASM-REPORT-1")));
        report.put("explanation", Map.of("ruleVersion", RULE_VERSION, "message", "指标由规则化作答与掌握事件聚合生成"));
        if (session != null) report.put("sessionId", session.id);
        return report;
    }

    private Map<String, Object> sessionCompletion(Session session) {
        double score = 0d, max = 0d;
        for (Exercise exercise : session.exercises) {
            Attempt attempt = session.latest.get(exercise.id);
            if (attempt != null && attempt.score != null) { score += attempt.score.score; max += attempt.score.maxScore; }
        }
        return Map.of("requestId", requestId(), "sessionId", session.id, "status", session.status.name(),
                "score", score, "maxScore", max, "completedCount", session.latest.size(), "totalCount", session.exercises.size());
    }

    private Map<String, Object> sessionView(Session session, boolean exam) {
        autoSubmitIfExpired(session);
        List<Map<String, Object>> exercises = new ArrayList<>();
        for (Exercise exercise : session.exercises) exercises.add(exerciseView(session, exercise));
        List<Map<String, Object>> answerSheet = new ArrayList<>();
        for (Exercise exercise : session.exercises) answerSheet.add(Map.of("exerciseId", exercise.id,
                "status", session.latest.containsKey(exercise.id) ? "ANSWERED" : "UNANSWERED",
                "reviewMark", session.reviewMarks.getOrDefault(exercise.id, "NONE"),
                "latestRevision", session.latest.containsKey(exercise.id) ? session.latest.get(exercise.id).revision : 0));
        Map<String, Object> view = new LinkedHashMap<>();
        view.put("requestId", requestId());
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("sessionId", session.id);
        data.put("sessionType", session.type);
        data.put("status", session.status.name());
        data.put("serverNow", Instant.now().toString());
        data.put("startedAt", session.startedAt == null ? null : session.startedAt.toString());
        data.put("deadlineAt", session.deadlineAt == null ? null : session.deadlineAt.toString());
        data.put("remainingSec", remainingSeconds(session));
        data.put("lastCheckpointSeq", session.lastCheckpointSeq);
        data.put("exercises", exercises);
        data.put("answerSheet", answerSheet);
        data.put("requestedQuota", session.requestedQuota);
        data.put("actualQuota", session.actualQuota);
        data.put("degraded", session.degraded);
        data.put("degradeReasons", session.degradeReasons);
        data.put("seedVersion", "HMAC-SHA256-v1");
        data.put("algorithmVersion", ALGORITHM_VERSION);
        view.put("data", data);
        return view;
    }

    private Map<String, Object> exerciseView(Session session, Exercise exercise) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("sessionId", session.id);
        result.put("exerciseId", exercise.id);
        result.put("questionId", exercise.questionId);
        result.put("itemId", exercise.itemId);
        result.put("questionType", exercise.questionType);
        result.put("position", exercise.position);
        result.put("sourceBucket", exercise.sourceBucket);
        result.put("verificationStage", exercise.verificationStage);
        result.put("prompt", publicQuestion(questions.get(exercise.questionId)).get("prompt"));
        result.put("interaction", questions.get(exercise.questionId).interaction);
        result.put("feedbackPolicy", session.exam ? "AFTER_SUBMIT" : "IMMEDIATE");
        result.put("contentVersion", questions.get(exercise.questionId).version);
        return result;
    }

    private Map<String, Object> publicQuestion(QuestionVersion question) {
        if (question == null) return Map.of();
        return Map.of("questionId", question.id, "questionType", question.type, "prompt", question.prompt,
                "interaction", question.interaction, "contentVersion", question.version);
    }

    private Map<String, Object> mistakeView(Mistake mistake) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("mistakeId", mistake.id);
        result.put("itemId", mistake.itemId);
        result.put("questionId", mistake.questionId);
        result.put("mistakeStatus", mistake.mistakeStatus);
        result.put("masteryStatus", mistake.masteryStatus);
        result.put("errorCategory", mistake.errorCategory);
        result.put("wrongAnswerAvailable", mistake.wrongAnswerAvailable);
        result.put("d1DueAt", optionalString(mistake.d1DueAt));
        result.put("d7DueAt", optionalString(mistake.d7DueAt));
        result.put("nextActionAt", optionalString(mistake.nextActionAt));
        result.put("reasonTrace", mistake.reasonTrace);
        return result;
    }

    private Map<String, Object> verificationView(Verification verification) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("verificationId", verification.id);
        result.put("mistakeId", verification.mistakeId);
        result.put("stage", verification.stage);
        result.put("result", verification.result);
        result.put("dueAt", verification.dueAt.toString());
        result.put("score", verification.score);
        result.put("maxScore", verification.maxScore);
        result.put("nextState", mistakes.get(verification.mistakeId).mistakeStatus);
        return result;
    }

    private Map<String, Object> paperView(Paper paper) {
        List<Map<String, Object>> sections = List.of(Map.of("sectionCode", "CORE", "questionCount", paper.questionIds.size(),
                "maxScore", 100, "feedbackPolicy", "AFTER_SUBMIT"));
        return Map.of("paperId", paper.id, "examCode", paper.examCode, "paperVersion", paper.version,
                "title", paper.title, "durationSec", paper.durationSec, "sections", sections,
                "questionIds", paper.questionIds);
    }

    private void recordAntiCheatInternal(Session session, Map<String, Object> body, String fallbackType) {
        String type = text(body.getOrDefault("eventType", fallbackType));
        Map<String, Object> metadata = new LinkedHashMap<>();
        Object raw = body.get("metadata");
        if (raw instanceof Map<?, ?> map) for (Map.Entry<?, ?> entry : map.entrySet()) {
            Object value = entry.getValue();
            if (value == null || value instanceof Number || value instanceof Boolean || value instanceof String) metadata.put(String.valueOf(entry.getKey()), value);
        }
        session.antiCheatEvents.add(Map.of("clientEventId", text(body.getOrDefault("clientEventId", UUID.randomUUID().toString())),
                "eventType", type, "serverOccurredAt", Instant.now().toString(), "sequence", body.getOrDefault("sequence", 0),
                "deviceHash", text(body.getOrDefault("deviceHash", "")), "metadata", metadata, "ruleVersion", "ASM-AC-1"));
        if (Set.of("VISIBILITY_HIDDEN", "FOCUS_LOST", "FULLSCREEN_EXIT").contains(type)) session.focusLossCount++;
        if ("CLOCK_SKEW".equals(type) || "CLIENT_TIME_BACKWARD".equals(type)) session.clockAnomaly = true;
        session.riskLevel = session.focusLossCount > 3 || session.clockAnomaly ? "SUSPECTED_REVIEW"
                : session.focusLossCount >= 3 ? "WARNING" : "CLEAR";
    }

    private void autoSubmitIfExpired(Session session) {
        if (session.exam && session.deadlineAt != null && Instant.now().isAfter(session.deadlineAt)
                && session.status != Status.COMPLETED && session.status != Status.AUTO_SUBMITTED) finalizeExam(session, true);
    }

    private Session ownedExam(long userId, String sessionId) {
        Session session = ownedSession(userId, sessionId);
        if (!session.exam) throw conflict("ASM_SESSION_STATE_CONFLICT", "not an exam session");
        return session;
    }

    private Session ownedSession(long userId, String sessionId) {
        Session session = sessions.get(sessionId);
        if (session == null || session.userId != userId) throw notFound("session not found");
        return session;
    }

    private Mistake ownedMistake(long userId, long mistakeId) {
        Mistake mistake = mistakes.get(mistakeId);
        if (mistake == null || mistake.userId != userId) throw notFound("mistake not found");
        return mistake;
    }

    private Exercise exercise(Session session, long exerciseId) {
        return session.exercises.stream().filter(item -> item.id == exerciseId).findFirst()
                .orElseThrow(() -> notFound("exercise not found"));
    }

    private void ensureWritable(Session session) {
        autoSubmitIfExpired(session);
        if (session.status == Status.COMPLETED || session.status == Status.AUTO_SUBMITTED || session.status == Status.SUBMITTING) {
            throw conflict("ASM_SESSION_STATE_CONFLICT", "session is not writable");
        }
    }

    private int remainingSeconds(Session session) {
        if (session.deadlineAt == null) return 0;
        return Math.max(0, (int) Duration.between(Instant.now(), session.deadlineAt).toSeconds());
    }

    private Exercise materialize(Session session, QuestionVersion q, String source, String stage, int position) {
        return new Exercise(exerciseSequence.incrementAndGet(), q.id, q.itemId, q.type, position, source, stage);
    }

    private Map<String, Object> idempotent(long userId, String route, String key, Map<String, Object> request, Supplier<Map<String, Object>> action) {
        String scoped = userId + "|" + route + "|" + key;
        String hash = bodyHash(request);
        synchronized (idempotency) {
            IdempotentResult previous = idempotency.get(scoped);
            if (previous != null) {
                if (!previous.requestHash.equals(hash)) throw conflict("ASM_IDEMPOTENCY_KEY_REUSE", "same idempotency key has a different request");
                return previous.response;
            }
            Map<String, Object> response = action.get();
            idempotency.put(scoped, new IdempotentResult(hash, response));
            return response;
        }
    }

    private static String requireIdempotency(String key) {
        if (key == null || key.isBlank() || key.trim().length() < 8) throw invalid("Idempotency-Key is required");
        return key.trim();
    }

    private static String bodyHash(Map<String, Object> value) { return sha256(String.valueOf(new java.util.TreeMap<>(value))); }

    private static String stableSeed(long userId, LocalDate date, String planVersion, String revision) {
        return sha256(DAILY_SECRET + "|ASM_DAILY_STREAM_V1|" + userId + "|" + date + "|" + planVersion + "|" + revision);
    }

    private static String sha256(String value) {
        try { return Base64.getUrlEncoder().withoutPadding().encodeToString(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8))); }
        catch (Exception error) { throw new IllegalStateException(error); }
    }

    private static Map<String, Integer> quota(int target) {
        return switch (target) {
            case 15 -> Map.of("NEW", 6, "REVIEW", 6, "MISTAKE", 3);
            case 16 -> Map.of("NEW", 6, "REVIEW", 6, "MISTAKE", 4);
            case 17 -> Map.of("NEW", 7, "REVIEW", 7, "MISTAKE", 3);
            case 18 -> Map.of("NEW", 7, "REVIEW", 7, "MISTAKE", 4);
            case 19 -> Map.of("NEW", 8, "REVIEW", 7, "MISTAKE", 4);
            default -> Map.of("NEW", 8, "REVIEW", 8, "MISTAKE", 4);
        };
    }

    private static int normalizeTargetCount(int count) { return Math.max(15, Math.min(20, count <= 0 ? 15 : count)); }
    private static Map<String, Integer> countBuckets(List<Exercise> exercises) {
        Map<String, Integer> result = new LinkedHashMap<>();
        for (Exercise exercise : exercises) result.merge(exercise.sourceBucket, 1, Integer::sum);
        return result;
    }
    private static String requestId() { return "req_b2_" + UUID.randomUUID().toString().replace("-", ""); }
    private static String optionalString(Instant value) { return value == null ? null : value.toString(); }
    private static String errorFor(QuestionVersion q, String ignored) { return q.errorCategory == null ? "OTHER" : q.errorCategory; }
    private static String normalizeText(Object value) { return value == null ? "" : java.text.Normalizer.normalize(String.valueOf(value), java.text.Normalizer.Form.NFC).trim().replaceAll("\\s+", " ").toLowerCase(java.util.Locale.ROOT); }
    private static String text(Object value) { return value == null ? "" : String.valueOf(value).trim(); }
    private static String firstNonBlank(String first, String second) { return first != null && !first.isBlank() ? first : second; }
    private static long longValue(Object value, String name) { try { long parsed = Long.parseLong(String.valueOf(value)); if (parsed < 0) throw new NumberFormatException(); return parsed; } catch (Exception error) { throw invalid(name + " is invalid"); } }
    private static int intValue(Object value, String name) { try { return Math.toIntExact(longValue(value, name)); } catch (Exception error) { throw invalid(name + " is invalid"); } }
    private static List<String> asStringList(Object value) { if (!(value instanceof Collection<?> values)) return List.of(); List<String> result = new ArrayList<>(); for (Object item : values) result.add(text(item)); return result; }
    private static Map<String, Object> answerMap(Object value) { if (!(value instanceof Map<?, ?> raw)) throw invalid("answer must be an object"); Map<String, Object> result = new LinkedHashMap<>(); for (Map.Entry<?, ?> entry : raw.entrySet()) { String key = String.valueOf(entry.getKey()); if (Set.of("score", "isCorrect", "correctAnswer", "maxScore", "scoringStatus").contains(key)) throw invalid("answer contains server-only field: " + key); result.put(key, entry.getValue()); } return result; }
    private static boolean hasAttempted(Map<String, Object> answer) { if (answer == null || answer.isEmpty()) return false; for (Object value : answer.values()) { if (value instanceof Collection<?> values && !values.isEmpty()) return true; if (value instanceof Map<?, ?> values && !values.isEmpty()) return true; if (value != null && !String.valueOf(value).isBlank()) return true; } return false; }
    private static Map<String, Object> copy(Map<String, Object> value) { return value == null ? new LinkedHashMap<>() : new LinkedHashMap<>(value); }
    private static int limit(String value) { try { return Math.max(1, Math.min(50, Integer.parseInt(value))); } catch (Exception ignored) { return 20; } }
    private static Map<String, Object> page(List<Map<String, Object>> items, String cursor, int limit) { boolean more = items.size() > limit; List<Map<String, Object>> visible = more ? items.subList(0, limit) : items; Map<String, Object> page = new LinkedHashMap<>(); page.put("limit", limit); page.put("hasMore", more); page.put("nextCursor", more ? Base64.getUrlEncoder().encodeToString(String.valueOf(limit).getBytes(StandardCharsets.UTF_8)) : null); Map<String, Object> result = new LinkedHashMap<>(); result.put("page", page); result.put("items", visible); return result; }
    private static boolean matches(Mistake mistake, Map<String, String> filters) { if (filters == null) return true; return (filters.get("errorCategory") == null || filters.get("errorCategory").isBlank() || filters.get("errorCategory").equals(mistake.errorCategory)) && (filters.get("mistakeStatus") == null || filters.get("mistakeStatus").isBlank() || filters.get("mistakeStatus").equals(mistake.mistakeStatus)) && (filters.get("masteryStatus") == null || filters.get("masteryStatus").isBlank() || filters.get("masteryStatus").equals(mistake.masteryStatus)); }
    private static B2AssessmentException invalid(String message) { return new B2AssessmentException("ASM_SCHEMA_INVALID", message, 400, false); }
    private static B2AssessmentException conflict(String code, String message) { return new B2AssessmentException(code, message, 409, false); }
    private static B2AssessmentException notFound(String message) { return new B2AssessmentException("ASM_NOT_FOUND", message, 404, false); }

    private void seedQuestions() {
        for (int i = 0; i < 30; i++) {
            long id = 42001L + i;
            String type = switch (i % 3) { case 0 -> "CHOICE"; case 1 -> "FILL_BLANK"; default -> "DRAG_SORTER"; };
            String bucket = i < 12 ? "NEW" : i < 24 ? "REVIEW" : "MISTAKE";
            Map<String, Object> prompt = new LinkedHashMap<>();
            Map<String, Object> expected = new LinkedHashMap<>();
            Map<String, Object> interaction = new LinkedHashMap<>();
            if ("CHOICE".equals(type)) {
                prompt.put("stem", "Select the best answer for item " + id + ".");
                prompt.put("options", List.of(Map.of("key", "A", "text", "option A"), Map.of("key", "B", "text", "option B"), Map.of("key", "C", "text", "option C")));
                expected.put("selectedOptionKeys", List.of(i % 2 == 0 ? "B" : "A"));
                interaction.put("mode", "SINGLE");
            } else if ("FILL_BLANK".equals(type)) {
                prompt.put("stem", "Complete the sentence for item " + id + ".");
                prompt.put("blanks", List.of(Map.of("blankId", "b1", "candidates", List.of("learn", "learns"))));
                expected.put("blanks", Map.of("b1", List.of(i % 2 == 0 ? "learn" : "learns")));
                interaction.put("mode", "TEXT");
            } else {
                prompt.put("stem", "Put the sentence blocks in order for item " + id + ".");
                prompt.put("tokens", List.of(Map.of("tokenId", "t1", "text", "Learning"), Map.of("tokenId", "t2", "text", "works"), Map.of("tokenId", "t3", "text", "daily")));
                expected.put("orderedTokenIds", List.of("t1", "t2", "t3"));
                interaction.put("mode", "ORDER");
            }
            questions.put(id, new QuestionVersion(id, "q-2026.08.1", type, 88000L + i, prompt, interaction, expected, 1d,
                    type.equals("FILL_BLANK") ? "SPELLING_WRONG" : type.equals("DRAG_SORTER") ? "SENTENCE_STRUCTURE_ERROR" : "MEANING_CONFUSION", bucket, null));
        }
    }

    private void seedPapers() { List<Long> questionIds = new ArrayList<>(questions.keySet()); questionIds.sort(Long::compareTo); papers.put(1001L, new Paper(1001L, "CET4", "cet4-sim-2026.08.1", "CET-4 Phase 1 模拟卷", 120 * 60, questionIds.subList(0, 9))); }

    private static final Set<String> ANTI_CHEAT_TYPES = Set.of("VISIBILITY_HIDDEN", "FOCUS_LOST", "FULLSCREEN_EXIT", "HEARTBEAT_MISSED", "MULTI_DEVICE", "CLOCK_SKEW", "CLIENT_TIME_BACKWARD", "ELAPSED_GAP", "PASTE_USED", "RAPID_SEQUENCE", "ANSWER_AFTER_DEADLINE", "CHECKPOINT_CONFLICT");

    private enum Status { CREATED, IN_PROGRESS, INTERRUPTED, SUBMITTING, COMPLETED, AUTO_SUBMITTED, CANCELLED, EXPIRED }
    private record IdempotentResult(String requestHash, Map<String, Object> response) { }
    private record Score(double score, double maxScore, Boolean isCorrect, String status, List<String> errors, String feedback) { }
    private record QuestionVersion(long id, String version, String type, long itemId, Map<String, Object> prompt, Map<String, Object> interaction, Map<String, Object> expected, double maxScore, String errorCategory, String sourceBucket, String verificationStage) { }
    private record Exercise(long id, long questionId, long itemId, String questionType, int position, String sourceBucket, String verificationStage) { }
    private record Attempt(String sessionId, long exerciseId, int revision, String clientSubmissionId, Map<String, Object> answer, Instant serverReceivedAt, String requestHash, Score score) { }
    private record Paper(long id, String examCode, String version, String title, int durationSec, List<Long> questionIds) { }

    private static final class Session {
        final String id; final long userId; final String type; final boolean exam;
        Status status = Status.IN_PROGRESS; Instant startedAt; Instant deadlineAt; Instant closedAt; Instant lastHeartbeatAt;
        long lastCheckpointSeq; long paperId; String examCode; String streamRevision; String seed;
        boolean degraded; String riskLevel = "CLEAR"; boolean clockAnomaly; int focusLossCount;
        final List<Exercise> exercises = new ArrayList<>(); final Map<Long, Attempt> latest = new ConcurrentHashMap<>();
        final Map<Long, String> reviewMarks = new ConcurrentHashMap<>(); final List<Map<String, Object>> antiCheatEvents = Collections.synchronizedList(new ArrayList<>());
        final List<String> degradeReasons = new ArrayList<>(); Map<String, Object> lastCheckpoint = Map.of();
        Map<String, Integer> requestedQuota = Map.of(); Map<String, Integer> actualQuota = Map.of(); Map<String, Object> report;
        Session(String id, long userId, String type, boolean exam) { this.id = id; this.userId = userId; this.type = type; this.exam = exam; }
    }

    private static final class Mistake {
        final long id; final long userId; final long itemId; final long questionId; final String errorCategory;
        String mistakeStatus = "PENDING_RETRY"; String masteryStatus = "LEARNING"; int wrongCount = 1;
        boolean wrongAnswerAvailable; Instant d0CorrectedAt; Instant d1DueAt; Instant d1VerifiedAt; Instant d7DueAt; Instant d7VerifiedAt; Instant resolvedAt; Instant nextActionAt = Instant.now(); Instant lastErrorAt = Instant.now();
        final List<Map<String, Object>> reasonTrace = Collections.synchronizedList(new ArrayList<>());
        Mistake(long id, long userId, long itemId, long questionId, String errorCategory) { this.id = id; this.userId = userId; this.itemId = itemId; this.questionId = questionId; this.errorCategory = errorCategory; }
    }

    private static final class Verification {
        final long id; final long mistakeId; final long userId; final String stage; final Instant dueAt; long exerciseId;
        String result = "PENDING"; Double score; Double maxScore; Instant submittedAt;
        Verification(long id, long mistakeId, long userId, String stage, Instant dueAt) { this.id = id; this.mistakeId = mistakeId; this.userId = userId; this.stage = stage; this.dueAt = dueAt; }
    }
}
