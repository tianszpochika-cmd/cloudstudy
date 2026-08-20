package com.englishflow.modules.auth;

public record TokenRefreshRequest(
        String refreshToken,
        String deviceId,
        String devicePublicId
) {
    public TokenRefreshRequest(String refreshToken, String deviceId) {
        this(refreshToken, deviceId, null);
    }

    public String effectiveDeviceId() {
        if (deviceId != null && !deviceId.isBlank()) return deviceId.trim();
        return devicePublicId == null ? null : devicePublicId.trim();
    }
}
