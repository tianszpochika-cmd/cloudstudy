package com.englishflow.notification.domain;

public record OfflineConflict(String clientEventId, String entityType, String entityId, long clientVersion, long serverVersion, String resolutionCode) {
    public OfflineConflict {
        if (clientEventId == null || clientEventId.isBlank() || entityType == null || entityId == null || resolutionCode == null || resolutionCode.isBlank()) throw new IllegalArgumentException("conflict fields are required");
        if (clientVersion < 1 || serverVersion < 1) throw new IllegalArgumentException("conflict versions are invalid");
    }
}
