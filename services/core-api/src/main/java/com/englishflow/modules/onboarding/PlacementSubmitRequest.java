package com.englishflow.modules.onboarding;

public record PlacementSubmitRequest(
        String sessionUuid,
        String sessionId,
        String questionId,
        String selectedAnswer,
        String selectedKey,
        Integer timeSpentSec
) {
    String effectiveSessionId() { return nonBlank(sessionUuid) != null ? nonBlank(sessionUuid) : nonBlank(sessionId); }
    String effectiveSelectedKey() { return nonBlank(selectedAnswer) != null ? nonBlank(selectedAnswer) : nonBlank(selectedKey); }
    private static String nonBlank(String value) { return value == null || value.isBlank() ? null : value.trim(); }
}
