package com.englishflow.modules.onboarding;

import java.time.Instant;
import java.util.List;

public record PlacementStartResponse(
        String sessionId,
        int stepIndex,
        int totalSteps,
        PublicPlacementQuestion question,
        Instant startedAt,
        String status
) {
    static PlacementStartResponse from(PlacementSession session, PublicPlacementQuestion question) {
        return new PlacementStartResponse(session.sessionId(), question.stepIndex(), question.totalSteps(), question,
                session.startedAt(), session.status().name());
    }
}

record PublicPlacementQuestion(
        String questionId,
        String sessionId,
        int stepIndex,
        int totalSteps,
        String dimension,
        int difficulty,
        String stemText,
        String helperText,
        List<PlacementOption> options,
        int timeLimitSec
) {
}
