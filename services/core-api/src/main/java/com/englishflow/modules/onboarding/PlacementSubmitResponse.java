package com.englishflow.modules.onboarding;

public record PlacementSubmitResponse(
        boolean isCompleted,
        PublicPlacementQuestion nextQuestion,
        PlacementReport finalReport,
        int answeredCount,
        String status
) {
}
