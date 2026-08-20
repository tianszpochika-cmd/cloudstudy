package com.englishflow.modules.onboarding;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

final class PlacementSession {
    enum Status { ACTIVE, COMPLETED, SKIPPED, EXPIRED }

    private final String sessionId;
    private final long userId;
    private final Instant startedAt;
    private final List<PlacementAnswer> answers = new ArrayList<>();
    private Status status = Status.ACTIVE;
    private PlacementReport report;

    PlacementSession(String sessionId, long userId, Instant startedAt) {
        this.sessionId = sessionId;
        this.userId = userId;
        this.startedAt = startedAt;
    }

    String sessionId() { return sessionId; }
    long userId() { return userId; }
    Instant startedAt() { return startedAt; }
    Status status() { return status; }
    List<PlacementAnswer> answers() { return List.copyOf(answers); }
    PlacementReport report() { return report; }
    void add(PlacementAnswer answer) { answers.add(answer); }
    void complete(PlacementReport next) { report = next; status = Status.COMPLETED; }
    void skip(PlacementReport next) { report = next; status = Status.SKIPPED; }
}

record PlacementAnswer(String questionId, String selectedKey, boolean correct, int timeSpentSec, Instant submittedAt) {
}

record PlacementReport(
        int score,
        int level,
        String cefrLevel,
        int estimatedVocabulary,
        PlacementRadarScores radarScores,
        String recommendedAdvice,
        String source,
        Instant completedAt
) {
}

record PlacementRadarScores(int vocab, int grammar, int listening, int speed, int scenario) {
}
