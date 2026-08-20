package com.englishflow.modules.onboarding;

import java.util.List;

record PlacementQuestion(
        String questionId,
        int stepIndex,
        int totalSteps,
        String dimension,
        int difficulty,
        String stemText,
        String helperText,
        List<PlacementOption> options,
        String correctKey,
        int timeLimitSec
) {
    PlacementQuestion {
        options = List.copyOf(options);
    }
}

record PlacementOption(String key, String text) {
}
